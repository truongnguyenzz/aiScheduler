from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import re
import unicodedata
from typing import Any


DATABASE_HEADERS = [
    "NGÀY",
    "THỨ",
    "STT",
    "ICON",
    "CÔNG VIỆC",
    "DESCRIPTION",
    "DURING",
    "CLOCK",
    "MÀU NỀN",
    "ID TASK",
]

WEEKDAYS_VI = (
    "THỨ HAI",
    "THỨ BA",
    "THỨ TƯ",
    "THỨ NĂM",
    "THỨ SÁU",
    "THỨ BẢY",
    "CHỦ NHẬT",
)

READY_TASK_OFFSETS = tuple(range(0, 23, 2))
MAX_DURATION_DECIMAL_PLACES = 2


class NormalizationError(ValueError):
    """Raised when source data cannot be mapped without guessing."""


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalized_name(value: Any) -> str:
    text = unicodedata.normalize("NFC", _text(value))
    return " ".join(text.split()).casefold()


def _parse_date(value: Any, field: str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = _text(value)
    if not text:
        raise NormalizationError(f"{field} is empty.")
    for pattern in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, pattern).date()
        except ValueError:
            continue
    raise NormalizationError(f"{field} has unsupported date value {text!r}.")


def _parse_decimal(value: Any, field: str) -> Decimal:
    if isinstance(value, bool) or value is None or _text(value) == "":
        raise NormalizationError(f"{field} is missing or not numeric.")
    text = _text(value).replace(",", ".")
    try:
        result = Decimal(text)
    except InvalidOperation as error:
        raise NormalizationError(
            f"{field} has invalid decimal value {_text(value)!r}."
        ) from error
    if not result.is_finite():
        raise NormalizationError(f"{field} must be a finite number.")
    decimals = max(0, -result.as_tuple().exponent)
    if decimals > MAX_DURATION_DECIMAL_PLACES:
        raise NormalizationError(
            f"{field} supports at most {MAX_DURATION_DECIMAL_PLACES} "
            "decimal places."
        )
    return result


def _parse_start_time(value: Any, field: str) -> time | None:
    if value is None or _text(value) == "":
        return None
    if isinstance(value, datetime):
        return value.time().replace(second=0, microsecond=0)
    if isinstance(value, time):
        return value.replace(second=0, microsecond=0)
    if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
        fraction = Decimal(str(value))
        if fraction < 0 or fraction >= 1:
            raise NormalizationError(
                f"{field} numeric value must be a Google Sheets time fraction."
            )
        total_minutes = int(
            (fraction * Decimal(24 * 60)).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
        if total_minutes == 24 * 60:
            total_minutes = 0
        return time(hour=total_minutes // 60, minute=total_minutes % 60)

    text = _text(value)
    for pattern in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M:%S %p"):
        try:
            parsed = datetime.strptime(text, pattern).time()
            return parsed.replace(second=0, microsecond=0)
        except ValueError:
            continue
    raise NormalizationError(
        f"{field} has unsupported time value {text!r}; expected HH:MM."
    )


def _source_address(value: Any) -> str:
    address = _text(value)
    if not address or not re.fullmatch(r"[A-Z]{1,3}\d+", address):
        raise NormalizationError(
            f"Invalid READY source cell {address!r}; expected an A1 address."
        )
    return address


def _internal_task_id(
    source_id: str, task_date: date, ready_cell: str
) -> str:
    value = f"{source_id}|{task_date.isoformat()}|{ready_cell}".encode("utf-8")
    digest = hashlib.sha256(value).hexdigest()[:24].upper()
    return f"ADP-{digest}"


def _format_source_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return format(value, "f")
    return str(value).strip()


def _icon(group_class: str, task_class: str) -> str:
    group = unicodedata.normalize("NFC", group_class).upper()
    task_type = unicodedata.normalize("NFC", task_class).upper()
    if task_type == "SYSTEM" or "SYSTEM" in group:
        return "⚙️"
    if "BẢN SẮC" in group:
        return "🎭"
    if "ĐẠO ĐỒ" in group:
        return "🧘"
    if "SỰ NGHIỆP" in group:
        return "💼"
    return ""


def _calendar_color(task_class: str, gi: Decimal) -> str:
    if gi != 0:
        return "MAUVE"
    normalized_class = unicodedata.normalize("NFC", task_class).strip().upper()
    if normalized_class == "SYSTEM":
        return "RED"
    if normalized_class in {"KNOWLEDGES", "CASUAL SKILLS", "NỘI TẠI"}:
        return "GREEN"
    if normalized_class in {"DƯỠNG SINH", "SIÊU SINH", "TRƯỜNG SINH"}:
        return "YELLOW"
    return ""


def _description(
    task_id: str,
    task_class: str,
    name: str,
    content: str,
    pr: Any,
    gi: Decimal,
    duration: Decimal,
) -> str:
    normalized_content = _text(content)
    if normalized_content.startswith("[") and normalized_content.endswith("]"):
        normalized_content = normalized_content[1:-1].strip()
    if normalized_content:
        normalized_content = f"-> {normalized_content}"
    return "\n".join(
        (
            f"INTERNAL_TASK_ID: {task_id}",
            f"CLASS: {task_class}",
            f"CÔNG VIỆC: {name}",
            f"NỘI DUNG: {normalized_content}",
            f"PR: {_format_source_value(pr)}",
            f"GI: {format(gi, 'f')}",
            f"DURING: {format(duration, 'f')}",
        )
    )


def normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Map READY task references to MASTER data and normalized database rows."""
    source_id = _text(payload.get("source_spreadsheet_id"))
    if not source_id:
        raise NormalizationError("source_spreadsheet_id is required.")
    if _text(payload.get("source_sheet_name")) != "TUẦN":
        raise NormalizationError("source_sheet_name must be 'TUẦN'.")

    ready_rows = payload.get("ready_rows")
    master_rows = payload.get("master_rows")
    if not isinstance(ready_rows, list) or len(ready_rows) != 7:
        raise NormalizationError("ready_rows must contain exactly 7 weekday rows.")
    if not isinstance(master_rows, list) or not master_rows:
        raise NormalizationError("master_rows must contain MASTER rows.")

    day_entries: list[tuple[int, date, list[dict[str, Any]]]] = []
    for index, row in enumerate(ready_rows):
        if not isinstance(row, dict):
            raise NormalizationError(f"READY row {index + 16} is invalid.")
        row_number = row.get("row_number")
        if row_number != index + 16:
            raise NormalizationError(
                f"READY rows must map to M16:M22; got row {row_number!r}."
            )
        task_date = _parse_date(row.get("date"), f"READY M{row_number}")
        items = row.get("tasks", [])
        if not isinstance(items, list):
            raise NormalizationError(f"READY tasks on row {row_number} must be a list.")
        day_entries.append((row_number, task_date, items))

    dates = [entry[1] for entry in day_entries]
    if any(dates[index + 1] - dates[index] != timedelta(days=1) for index in range(6)):
        raise NormalizationError(
            "READY dates M16:M22 must be seven consecutive dates."
        )
    if dates[0].weekday() != 0:
        raise NormalizationError("READY M16 must be a Monday.")

    master_by_name: dict[str, dict[str, Any]] = {}
    inherited_group = ""
    for master in master_rows:
        if not isinstance(master, dict):
            raise NormalizationError("Each MASTER row must be an object.")
        row_number = master.get("row_number")
        if not isinstance(row_number, int) or row_number < 3:
            raise NormalizationError(
                f"Invalid MASTER row number {row_number!r}."
            )
        values = master.get("values")
        if not isinstance(values, list) or len(values) < 9:
            raise NormalizationError(
                f"MASTER row {row_number} must contain A:I."
            )
        group_value = _text(values[0])
        if group_value:
            inherited_group = group_value
        name = _text(values[2])
        if not name:
            continue
        key = _normalized_name(name)
        if key in master_by_name:
            previous = master_by_name[key]["row_number"]
            raise NormalizationError(
                f"Duplicate normalized MASTER task name {name!r} at rows "
                f"{previous} and {row_number}."
            )
        master_by_name[key] = {
            "row_number": row_number,
            "values": values,
            "group_class": group_value or inherited_group,
        }

    normalized_rows: list[list[Any]] = []
    task_count_by_day: dict[date, int] = {}
    seen_ready_cells: set[str] = set()
    for _, task_date, tasks in day_entries:
        for task in tasks:
            if not isinstance(task, dict):
                raise NormalizationError("Each READY task must be an object.")
            name = _text(task.get("name"))
            if not name:
                continue
            ready_cell = _source_address(task.get("cell"))
            if ready_cell in seen_ready_cells:
                raise NormalizationError(
                    f"Duplicate READY source cell {ready_cell}."
                )
            seen_ready_cells.add(ready_cell)
            master = master_by_name.get(_normalized_name(name))
            if master is None:
                raise NormalizationError(
                    f"READY task {name!r} at {ready_cell} was not found in "
                    "MASTER column C."
                )

            values = master["values"]
            task_class = _text(values[1])
            master_name = _text(values[2])
            content = _text(values[3])
            pr = values[4]
            gi = _parse_decimal(values[5], f"MASTER F{master['row_number']} (GI)")
            duration = _parse_decimal(
                values[6], f"MASTER G{master['row_number']} (DURING)"
            )
            if duration <= 0:
                raise NormalizationError(
                    f"MASTER G{master['row_number']} (DURING) must be positive."
                )

            start_time = _parse_start_time(
                values[8], f"MASTER I{master['row_number']} (Start Time)"
            )
            clock = ""
            if start_time is not None:
                duration_seconds = int(
                    (duration * Decimal(3600)).quantize(
                        Decimal("1"), rounding=ROUND_HALF_UP
                    )
                )
                start_seconds = (start_time.hour * 60 + start_time.minute) * 60
                end_seconds = start_seconds + duration_seconds
                if end_seconds >= 24 * 60 * 60:
                    raise NormalizationError(
                        f"Task {master_name!r} crosses midnight; overnight "
                        "CLOCK behavior has not been approved."
                    )
                end_time = time(
                    hour=end_seconds // 3600,
                    minute=(end_seconds % 3600) // 60,
                    second=end_seconds % 60,
                )
                time_format = "%H:%M:%S" if end_time.second else "%H:%M"
                clock = f"{start_time.strftime('%H:%M')} - {end_time.strftime(time_format)}"

            task_count_by_day[task_date] = task_count_by_day.get(task_date, 0) + 1
            task_id = _internal_task_id(source_id, task_date, ready_cell)
            description = _description(
                task_id, task_class, master_name, content, pr, gi, duration
            )
            normalized_rows.append(
                [
                    task_date.isoformat(),
                    WEEKDAYS_VI[task_date.weekday()],
                    task_count_by_day[task_date],
                    _icon(master["group_class"], task_class),
                    master_name,
                    description,
                    float(duration),
                    clock,
                    _calendar_color(task_class, gi),
                    task_id,
                ]
            )

    if not normalized_rows:
        raise NormalizationError(
            "No READY tasks were found; refusing to replace the weekly snapshot."
        )

    start_date, end_date = dates[0], dates[-1]
    tab_name = (
        f"{start_date:%d/%m} - {end_date:%d/%m}/ {end_date:%Y}"
    )
    return {
        "source_spreadsheet_id": source_id,
        "source_sheet_name": "TUẦN",
        "week_start": start_date.isoformat(),
        "week_end": end_date.isoformat(),
        "destination_tab": tab_name,
        "headers": DATABASE_HEADERS,
        "rows": normalized_rows,
        "task_count": len(normalized_rows),
        "unassigned_clock_count": sum(1 for row in normalized_rows if not row[7]),
    }
