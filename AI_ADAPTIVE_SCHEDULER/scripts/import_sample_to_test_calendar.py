from __future__ import annotations

from datetime import date, datetime, time
import os
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


SPREADSHEET_ID = "1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM"
SPREADSHEET_TITLE = "AI Scheduler API TEST"
SHEET_TAB = "Calendar Import Test"
CALENDAR_TITLE = "AI Scheduler API TEST"
BATCH_ID = "ai_adaptive_scheduler_sample_v1"
TIMEZONE = "Asia/Ho_Chi_Minh"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]
HEADERS = [
    "task_id",
    "task_type",
    "name",
    "description",
    "date",
    "fixed_start_time",
    "default_duration_minutes",
    "min_duration_minutes",
    "max_duration_minutes",
    "planned_duration_minutes",
    "period",
    "group",
    "calendar_start_time",
    "calendar_end_time",
]


def get_credentials() -> Credentials:
    auth_dir = Path(os.environ["LOCALAPPDATA"]) / "AI_Adaptive_SCHEDULER"
    token_file = auth_dir / ".google-token.json"
    if not token_file.is_file():
        raise FileNotFoundError(
            f"OAuth token not found: {token_file}. Run the access setup first."
        )

    credentials = Credentials.from_authorized_user_file(
        str(token_file), SCOPES
    )
    if not credentials.has_scopes(SCOPES):
        raise RuntimeError(
            "Saved OAuth token lacks the required Sheets and Calendar scopes."
        )
    if credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
    return credentials


def read_sample_tab(sheets_service) -> list[list[object]]:
    spreadsheet = (
        sheets_service.spreadsheets()
        .get(
            spreadsheetId=SPREADSHEET_ID,
            fields="properties(title),sheets(properties(title))",
        )
        .execute()
    )
    title = spreadsheet.get("properties", {}).get("title")
    if title != SPREADSHEET_TITLE:
        raise RuntimeError(
            f"Refusing to modify unexpected spreadsheet {title!r}."
        )

    tab_names = {
        sheet["properties"]["title"]
        for sheet in spreadsheet.get("sheets", [])
    }
    if SHEET_TAB not in tab_names:
        raise RuntimeError(
            f"Required source tab {SHEET_TAB!r} does not exist. "
            "The importer only reads the Sheet; it never creates or edits tabs."
        )

    values = (
        sheets_service.spreadsheets()
        .values()
        .get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"'{SHEET_TAB}'!A1:N100",
            valueRenderOption="UNFORMATTED_VALUE",
        )
        .execute()
        .get("values", [])
    )
    if not values or values[0][:len(HEADERS)] != HEADERS:
        raise RuntimeError(
            f"Tab {SHEET_TAB!r} does not have the expected A1:N1 headers."
        )
    rows = []
    seen_task_ids = set()
    for row_number, raw_row in enumerate(values[1:], start=2):
        row = raw_row[:len(HEADERS)] + [""] * max(
            0, len(HEADERS) - len(raw_row)
        )
        if not any(value != "" for value in row):
            continue
        if not row[0]:
            raise ValueError(f"Missing task_id in {SHEET_TAB}!A{row_number}.")
        task_id = str(row[0]).strip()
        if task_id in seen_task_ids:
            raise ValueError(f"Duplicate task_id {task_id!r} in the Sheet.")
        seen_task_ids.add(task_id)
        rows.append(row)
    if not rows:
        raise RuntimeError(
            f"No task rows found in {SHEET_TAB!r}; no Calendar events imported."
        )
    return rows


def get_test_calendar(calendar_service) -> tuple[str, str]:
    page_token = None
    matches = []
    while True:
        result = (
            calendar_service.calendarList()
            .list(pageToken=page_token, maxResults=250)
            .execute()
        )
        matches.extend(
            item
            for item in result.get("items", [])
            if item.get("summary") == CALENDAR_TITLE
        )
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected exactly one calendar named {CALENDAR_TITLE!r}; "
            f"found {len(matches)}."
        )
    calendar = matches[0]
    if calendar.get("accessRole") not in {"owner", "writer"}:
        raise RuntimeError(
            "Test Calendar does not grant event-write permission."
        )
    return calendar["id"], calendar["summary"]


def build_event(row: list[object]) -> dict[str, object]:
    task_id, task_type, name, description, day = row[:5]
    if not task_id or not task_type or not name or not day or not row[9]:
        raise ValueError(f"Missing required task field in row {row!r}.")
    task_id = str(task_id).strip()
    task_type = str(task_type).strip()
    if task_type not in {"secondary", "main_fixed", "main_flexible"}:
        raise ValueError(f"Unsupported task_type {task_type!r} for {task_id}.")
    planned_minutes = int(row[9])
    if planned_minutes <= 0:
        raise ValueError(f"Duration must be positive for task {task_id}.")
    start_text, end_text = str(row[12]), str(row[13])
    local_zone = ZoneInfo(TIMEZONE)
    task_date = date.fromisoformat(str(day))
    start = datetime.combine(
        task_date,
        time.fromisoformat(start_text),
        tzinfo=local_zone,
    )
    end = datetime.combine(
        task_date,
        time.fromisoformat(end_text),
        tzinfo=local_zone,
    )
    if end <= start or int((end - start).total_seconds() // 60) != planned_minutes:
        raise ValueError(f"Invalid time/duration for task {task_id}.")
    if task_type == "main_fixed":
        if not row[5] or str(row[5]) != start_text:
            raise ValueError(f"Fixed start does not match calendar start for {task_id}.")
        if not row[6] or int(row[6]) != planned_minutes:
            raise ValueError(f"Fixed duration does not match planned duration for {task_id}.")
    if task_type == "main_flexible":
        if row[7] == "" or row[8] == "":
            raise ValueError(f"Flexible task {task_id} must have Min and Max duration.")
        if not int(row[7]) <= planned_minutes <= int(row[8]):
            raise ValueError(f"Planned duration is outside Min/Max for {task_id}.")
    if task_type == "secondary" and (not row[10] or not row[11]):
        raise ValueError(f"Secondary task {task_id} requires period and group.")

    details = [
        f"Task ID: {task_id}",
        f"Task type: {task_type}",
        f"Planned duration: {planned_minutes} minutes",
    ]
    if row[10]:
        details.extend([f"Period: {row[10]}", f"Group: {row[11]}"])
    if row[5]:
        details.append(f"Fixed start: {row[5]}")
    if row[6] != "":
        details.append(f"Default duration: {row[6]} minutes")
    if row[7] != "":
        details.append(f"Minimum duration: {row[7]} minutes")
    if row[8] != "":
        details.append(f"Maximum duration: {row[8]} minutes")

    return {
        "summary": str(name),
        "description": str(description) + "\n\n" + "\n".join(details),
        "start": {"dateTime": start.isoformat(), "timeZone": TIMEZONE},
        "end": {"dateTime": end.isoformat(), "timeZone": TIMEZONE},
        "extendedProperties": {
            "private": {
                "schedulerTestBatch": BATCH_ID,
                "schedulerTaskId": str(task_id),
                "schedulerTaskDate": str(day),
            }
        },
    }


def import_events(calendar_service, calendar_id: str, rows: list[list[object]]) -> None:
    prepared = []
    seen_tasks = set()
    for row in rows:
        task_id, day = str(row[0]).strip(), str(row[4]).strip()
        task_key = (task_id, day)
        if task_key in seen_tasks:
            raise ValueError(f"Duplicate Calendar event key for task {task_id}.")
        seen_tasks.add(task_key)
        prepared.append((task_id, day, build_event(row)))

    inserted = []
    updated = []
    unchanged = []
    active_events_by_key = {}
    for task_id, day, _ in prepared:
        page_token = None
        matching_events = []
        while True:
            result = (
                calendar_service.events()
                .list(
                    calendarId=calendar_id,
                    privateExtendedProperty=[
                        f"schedulerTestBatch={BATCH_ID}",
                        f"schedulerTaskId={task_id}",
                        f"schedulerTaskDate={day}",
                    ],
                    showDeleted=False,
                    maxResults=250,
                    pageToken=page_token,
                )
                .execute()
            )
            matching_events.extend(result.get("items", []))
            page_token = result.get("nextPageToken")
            if not page_token:
                break
        if len(matching_events) > 1:
            raise RuntimeError(
                f"Multiple active Calendar events exist for task {task_id} "
                f"on {day}; "
                "refusing to create or alter any event."
            )
        if matching_events:
            active_events_by_key[(task_id, day)] = matching_events[0]

    synced_events = []
    expected_by_event_id = {}
    for task_id, day, expected in prepared:
        task_key = (task_id, day)
        existing = active_events_by_key.get(task_key)
        if existing is None:
            event = (
                calendar_service.events()
                .insert(calendarId=calendar_id, body=expected)
                .execute()
            )
            inserted.append(event)
            synced_events.append(event)
            expected_by_event_id[event["id"]] = expected
            continue

        marker = existing.get("extendedProperties", {}).get("private", {})
        if (
            marker.get("schedulerTestBatch") != BATCH_ID
            or marker.get("schedulerTaskId") != task_id
            or marker.get("schedulerTaskDate") != day
            or existing.get("status") == "cancelled"
        ):
            raise RuntimeError(
                f"Unexpected Calendar event for task {task_id} on {day}."
            )
        fields = ("summary", "description", "start", "end")
        if any(existing.get(field) != expected.get(field) for field in fields):
            event = (
                calendar_service.events()
                .patch(
                    calendarId=calendar_id,
                    eventId=existing["id"],
                    body=expected,
                )
                .execute()
            )
            updated.append(event)
        else:
            event = existing
            unchanged.append(event)
        synced_events.append(event)
        expected_by_event_id[event["id"]] = expected

    for event in synced_events:
        checked = (
            calendar_service.events()
            .get(calendarId=calendar_id, eventId=event["id"])
            .execute()
        )
        expected = expected_by_event_id[event["id"]]
        if (
            checked.get("id") != event["id"]
            or checked.get("status") == "cancelled"
            or checked.get("summary") != expected["summary"]
            or checked.get("description") != expected["description"]
            or checked.get("start", {}).get("dateTime")
            != expected["start"]["dateTime"]
            or checked.get("end", {}).get("dateTime")
            != expected["end"]["dateTime"]
        ):
            raise RuntimeError(
                f"Calendar verification failed for event {event.get('id')}."
            )
        print(
            f"Verified: {checked.get('summary')} | "
            f"{checked.get('start', {}).get('dateTime')} – "
            f"{checked.get('end', {}).get('dateTime')}"
        )
    print(
        f"Calendar sync complete: {len(inserted)} created, "
        f"{len(updated)} updated, {len(unchanged)} unchanged."
    )


def main() -> int:
    try:
        credentials = get_credentials()
        sheets_service = build(
            "sheets", "v4", credentials=credentials, cache_discovery=False
        )
        calendar_service = build(
            "calendar", "v3", credentials=credentials, cache_discovery=False
        )
        rows = read_sample_tab(sheets_service)
        print(f"Read {len(rows)} task rows from {SPREADSHEET_TITLE}/{SHEET_TAB}.")
        calendar_id, calendar_title = get_test_calendar(calendar_service)
        print(f"Import target confirmed: {calendar_title!r} (test calendar only).")
        import_events(calendar_service, calendar_id, rows)
    except (
        FileNotFoundError,
        HttpError,
        OSError,
        RuntimeError,
        ValueError,
        ZoneInfoNotFoundError,
    ) as error:
        print(f"Test sample import failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
