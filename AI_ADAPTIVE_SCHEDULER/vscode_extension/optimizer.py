#!/usr/bin/env python3
"""Local CP-SAT scheduler for normalized AI Adaptive Scheduler transfers."""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import math
import re
import sys
import time
import unicodedata
from collections import defaultdict
from typing import Any


_CLOCK_PART = re.compile(
    r"^(\d{2}):(\d{2})(?::(\d{2}))?(?: \(\+(\d+) (?:day|ng.y)\))?$"
)
_SECONDS_PER_DAY = 24 * 60 * 60
_CENTIHOUR_SECONDS = 36


def _clock_part_seconds(value: str) -> int | None:
    match = _CLOCK_PART.fullmatch(value)
    if not match:
        return None
    hour, minute, second, day_offset = (
        int(match.group(1)),
        int(match.group(2)),
        int(match.group(3) or 0),
        int(match.group(4) or 0),
    )
    if hour > 23 or minute > 59 or second > 59:
        return None
    return day_offset * _SECONDS_PER_DAY + hour * 3600 + minute * 60 + second


def _parse_clock(value: Any) -> tuple[int, int] | None:
    if not isinstance(value, str):
        return None
    parts = value.split(" - ")
    if len(parts) != 2:
        return None
    start = _clock_part_seconds(parts[0])
    end = _clock_part_seconds(parts[1])
    if start is None or end is None or end <= start:
        return None
    return start, end


def _time_seconds(value: Any) -> int:
    if not isinstance(value, str):
        raise ValueError(f"Expected HH:mm time, received {value!r}.")
    match = re.fullmatch(r"(\d{2}):(\d{2})", value)
    if not match:
        raise ValueError(f"Invalid HH:mm time: {value!r}.")
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour > 23 or minute > 59:
        raise ValueError(f"Invalid HH:mm time: {value!r}.")
    return hour * 3600 + minute * 60


def _date_day(value: Any) -> int:
    if not isinstance(value, str):
        raise ValueError("Every task must have an ISO date.")
    parsed = dt.date.fromisoformat(value)
    return (parsed - dt.date(1970, 1, 1)).days


def _duration_seconds(hours: Any, label: str) -> int:
    try:
        value = float(hours)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} has an invalid duration.") from error
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{label} has a non-positive or non-finite duration.")
    return int(math.floor(value * 3600 + 0.5))


def _format_endpoint(offset: int) -> str:
    day_offset, seconds = divmod(offset, _SECONDS_PER_DAY)
    hour, remainder = divmod(seconds, 3600)
    minute, second = divmod(remainder, 60)
    time_text = f"{hour:02d}:{minute:02d}"
    if second:
        time_text += f":{second:02d}"
    if day_offset:
        time_text += f" (+{day_offset} day)"
    return time_text


def _format_clock(base_day: int, start: int, end: int) -> str:
    return (
        f"{_format_endpoint(start - base_day * _SECONDS_PER_DAY)} - "
        f"{_format_endpoint(end - base_day * _SECONDS_PER_DAY)}"
    )


def _prepare_input(package: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    if (
        not isinstance(package, dict)
        or package.get("format") != "AI_ADAPTIVE_SCHEDULER_TRANSFER"
        or package.get("kind") != "normalized_input"
        or package.get("schema_version") not in (2, 3, 4)
    ):
        raise ValueError("Input must be a normalized Scheduler transfer (schema v2-v4).")
    tasks = package.get("tasks")
    secondary = package.get("secondary_tasks", [])
    if not isinstance(tasks, list) or not isinstance(secondary, list):
        raise ValueError("Input tasks and secondary_tasks must be arrays.")
    settings = package.get("schedule_settings")
    if not isinstance(settings, dict):
        raise ValueError("Input is missing schedule_settings.")
    start = _time_seconds(settings.get("defaultStartTime"))
    if settings.get("defaultStartMinutes") != start // 60:
        raise ValueError("defaultStartMinutes does not match defaultStartTime.")
    if not isinstance(settings.get("breakMinutes"), int) or settings["breakMinutes"] < 0:
        raise ValueError("breakMinutes must be a non-negative integer.")

    ids: set[str] = set()
    for task in [*tasks, *secondary]:
        task_id = task.get("task_id") if isinstance(task, dict) else None
        if not isinstance(task_id, str) or not task_id or task_id in ids:
            raise ValueError("Input tasks must have unique, non-empty task_id values.")
        ids.add(task_id)
        _date_day(task.get("date"))
    return tasks, secondary, start


def _fallback_schedule(
    package: dict[str, Any],
    default_start: int,
) -> dict[str, Any]:
    """Keep every task visible when no fully feasible CP-SAT solution exists."""
    result = copy.deepcopy(package)
    result["kind"] = "optimized_schedule"
    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for task in result["tasks"]:
        if task.get("task_type") == "flexible":
            task["fixed_start"] = None
        by_date[task["date"]].append(task)
    for task in result.get("secondary_tasks", []):
        by_date[task["date"]].append(task)

    for task in result["tasks"]:
        if task.get("task_type") in ("fixed", "sleep"):
            if not _parse_clock(task.get("clock")):
                start = _time_seconds(task.get("fixed_start"))
                duration = _duration_seconds(task.get("duration_hours"), task["task_id"])
                base_day = _date_day(task["date"])
                task["clock"] = _format_clock(
                    base_day, base_day * _SECONDS_PER_DAY + start,
                    base_day * _SECONDS_PER_DAY + start + duration,
                )

    for task in result.get("secondary_tasks", []):
        task["fixed_start"] = None
        suggested = _parse_clock(task.get("suggested_clock"))
        if suggested:
            task["clock"] = task["suggested_clock"]
        else:
            base_day = _date_day(task["date"])
            start = _time_seconds(task["window_start"])
            duration = int(task["duration_minutes"]) * 60
            task["clock"] = _format_clock(
                base_day, base_day * _SECONDS_PER_DAY + start,
                base_day * _SECONDS_PER_DAY + start + duration,
            )

    break_seconds = int(package["schedule_settings"]["breakMinutes"]) * 60
    for date_text, day_tasks in by_date.items():
        base_day = _date_day(date_text)
        base = base_day * _SECONDS_PER_DAY
        occupied: list[tuple[int, int, str]] = []
        for task in day_tasks:
            if task.get("task_type") == "flexible":
                continue
            clock = _parse_clock(task.get("clock"))
            if clock:
                occupied.append((base + clock[0], base + clock[1], task["task_type"]))

        flexible_tasks = sorted(
            (task for task in day_tasks if task.get("task_type") == "flexible"),
            key=lambda task: task.get("source_order", 0),
        )
        for task in flexible_tasks:
            original_units = int(math.floor(float(task["original_duration_hours"]) * 100 + 0.5))
            lower = base + default_start
            upper = base + _SECONDS_PER_DAY + default_start
            chosen: tuple[int, int, int] | None = None
            duration = original_units * _CENTIHOUR_SECONDS
            latest = upper - duration
            for candidate in range(lower, latest + 1, 60):
                end = candidate + duration
                legal = True
                for other_start, other_end, other_type in occupied:
                    if candidate < other_end and end > other_start:
                        legal = False
                        break
                    if other_type != "secondary":
                        if end <= other_start and other_start - end < break_seconds:
                            legal = False
                            break
                        if other_end <= candidate and candidate - other_end < break_seconds:
                            legal = False
                            break
                if legal:
                    chosen = candidate, end, original_units
                    break
            if chosen is None:
                chosen = lower, lower + duration, original_units
            task["duration_hours"] = chosen[2] / 100
            task["clock"] = _format_clock(base_day, chosen[0], chosen[1])
            occupied.append((chosen[0], chosen[1], "flexible"))

    for date_text, day_tasks in by_date.items():
        main_tasks = [task for task in day_tasks if task.get("task_type") != "secondary"]
        sleeps = [task for task in main_tasks if task.get("task_type") == "sleep"]
        others = [task for task in main_tasks if task.get("task_type") != "sleep"]
        others.sort(key=lambda task: (_parse_clock(task["clock"]) or (0, 0))[0])
        for order, task in enumerate(others, start=1):
            task["schedule_order"] = order
        for order, task in enumerate(sleeps, start=len(others) + 1):
            task["schedule_order"] = order
    return result


_PERIOD_WINDOWS = {
    "SÁNG": (6 * 3600, 10 * 3600),
    "TRƯA": (10 * 3600, 14 * 3600),
    "CHIỀU": (15 * 3600, 17 * 3600),
    "TỐI": (17 * 3600, 23 * 3600),
}


def _normalized_task_name(task: dict[str, Any]) -> str:
    value = unicodedata.normalize(
        "NFD", str(task.get("task_name", "")).casefold()
    )
    return "".join(
        character
        for character in value
        if unicodedata.category(character) != "Mn"
    )


def _can_move_secondary_to_evening(task: dict[str, Any]) -> bool:
    return (
        task.get("context_type") == "personal_hygiene"
        or "giai tri" in _normalized_task_name(task)
    )


def _secondary_reduction_weight(task: dict[str, Any]) -> int | None:
    if task.get("fixed_start") is not None:
        return None
    context = task.get("context_type")
    if context not in ("routine", "rest", "news"):
        return None
    if "giai tri" in _normalized_task_name(task) or context == "rest":
        return 1
    if context == "routine":
        return 2
    return 3


def _secondary_window_options(task: dict[str, Any]) -> list[dict[str, Any]]:
    source_period = task["period"]
    options = [{
        "period": source_period,
        "start": _time_seconds(task["window_start"]),
        "end": _time_seconds(task["window_end"]),
        "moved": False,
    }]
    if (
        source_period != "TỐI"
        and _can_move_secondary_to_evening(task)
    ):
        evening_start, evening_end = _PERIOD_WINDOWS["TỐI"]
        options.append({
            "period": "TỐI",
            "start": evening_start,
            "end": evening_end,
            "moved": True,
        })
    return options


def _secondary_target(task: dict[str, Any], option: dict[str, Any]) -> int:
    if option["moved"]:
        if task.get("context_type") == "personal_hygiene":
            target = option["start"]
        else:
            target = 20 * 3600
    else:
        context_targets = {
            "breakfast": 7 * 3600 + 30 * 60,
            "morning_hygiene": 6 * 3600 + 15 * 60,
            "movement": 7 * 3600 + 30 * 60,
            "lunch": 12 * 3600,
            "evening_meal": 18 * 3600 + 30 * 60,
            "news": 19 * 3600 + 30 * 60,
        }
        suggested = _parse_clock(task.get("suggested_clock"))
        target = context_targets.get(
            task.get("context_type"),
            suggested[0] if suggested else option["start"],
        )
    latest = option["end"] - 60
    return min(max(target, option["start"]), latest)


def _schedule_secondary_tasks(
    schedule: dict[str, Any],
    allow_duration_reduction: bool = False,
    time_limit: float = 5.0,
) -> dict[str, Any]:
    """Solve Secondary placement, allowing only meaning-compatible evening moves."""
    from ortools.sat.python import cp_model

    tasks = schedule.get("secondary_tasks", [])
    for task in tasks:
        task.pop("placement_period", None)
        task.pop("placement_reason", None)
        task.pop("scheduled_duration_minutes", None)
        task.pop("scheduled_duration_hours", None)
        task_id = task["task_id"]
        duration = int(task["duration_minutes"])
        if duration <= 0:
            raise ValueError(f"Secondary Task {task_id} has invalid duration.")

    model = cp_model.CpModel()
    records: list[dict[str, Any]] = []
    intervals = []
    target_terms = []
    move_terms = []
    reduction_terms = []
    conflict_terms = []
    main_intervals: list[tuple[int, int]] = []
    first_fixed_start: dict[str, int] = {}

    for main in schedule.get("tasks", []):
        base = _date_day(main["date"]) * _SECONDS_PER_DAY
        clock = _parse_clock(main.get("clock"))
        if clock:
            main_intervals.append((base + clock[0], base + clock[1]))
        if main.get("task_type") == "fixed":
            fixed_start = _time_seconds(main["fixed_start"])
            first_fixed_start[main["date"]] = min(
                fixed_start,
                first_fixed_start.get(main["date"], fixed_start),
            )

    for index, task in enumerate(tasks):
        base = _date_day(task["date"]) * _SECONDS_PER_DAY
        options = _secondary_window_options(task)
        earliest = base + min(option["start"] for option in options)
        latest = base + max(option["end"] for option in options)
        start = model.NewIntVar(earliest, latest, f"secondary_start_{index}")
        end = model.NewIntVar(earliest + 60, latest, f"secondary_end_{index}")
        minute_remainder = model.NewIntVar(
            0, 59, f"secondary_minute_remainder_{index}"
        )
        model.AddModuloEquality(minute_remainder, start, 60)
        model.Add(minute_remainder == 0)

        original_minutes = int(task["duration_minutes"])
        reduction_weight = _secondary_reduction_weight(task)
        can_reduce = allow_duration_reduction and reduction_weight is not None
        minimum_minutes = (
            max(1, (original_minutes + 1) // 2)
            if can_reduce
            else original_minutes
        )
        duration = model.NewIntVar(
            minimum_minutes,
            original_minutes,
            f"secondary_duration_minutes_{index}",
        )
        interval = model.NewIntervalVar(
            start,
            duration * 60,
            end,
            f"secondary_interval_{index}",
        )
        intervals.append(interval)

        choices = []
        for option_index, option in enumerate(options):
            choice = model.NewBoolVar(
                f"secondary_window_{index}_{option_index}"
            )
            choices.append((choice, option))
            window_start = base + option["start"]
            window_end = base + option["end"]
            model.Add(start >= window_start).OnlyEnforceIf(choice)
            model.Add(end <= window_end).OnlyEnforceIf(choice)
            if can_reduce and option["period"] != "TỐI":
                model.Add(duration == original_minutes).OnlyEnforceIf(choice)

            target = base + _secondary_target(task, option)
            deviation = model.NewIntVar(
                0, _SECONDS_PER_DAY, f"secondary_deviation_{index}_{option_index}"
            )
            model.AddAbsEquality(deviation, start - target).OnlyEnforceIf(choice)
            model.Add(deviation == 0).OnlyEnforceIf(choice.Not())
            target_terms.append(deviation)
            if option["moved"]:
                move_terms.append(choice * (30 * 60))
        model.AddExactlyOne([choice for choice, _ in choices])

        if task.get("context_type") == "breakfast":
            model.Add(end <= base + 10 * 3600)
        elif task.get("context_type") == "morning_hygiene":
            fixed_start = first_fixed_start.get(task["date"])
            if fixed_start is not None:
                model.Add(end <= base + fixed_start)

        if can_reduce and reduction_weight is not None:
            reduction_terms.append(
                (original_minutes - duration) * reduction_weight
            )
        records.append({
            "task": task,
            "base": base,
            "start": start,
            "end": end,
            "duration": duration,
            "original_minutes": original_minutes,
            "choices": choices,
            "earliest": earliest,
            "latest": latest,
        })

    for record_index, record in enumerate(records):
        for main_index, (main_start, main_end) in enumerate(main_intervals):
            if (
                main_start >= record["latest"]
                or main_end <= record["earliest"]
            ):
                continue
            before = model.NewBoolVar(
                f"secondary_before_main_{record_index}_{main_index}"
            )
            after = model.NewBoolVar(
                f"main_before_secondary_{record_index}_{main_index}"
            )
            conflict = model.NewBoolVar(
                f"secondary_main_conflict_{record_index}_{main_index}"
            )
            model.Add(record["end"] <= main_start).OnlyEnforceIf(before)
            model.Add(main_end <= record["start"]).OnlyEnforceIf(after)
            model.AddExactlyOne([before, after, conflict])
            conflict_terms.append(conflict)

    for left_index, left in enumerate(records):
        for right_index, right in enumerate(records[left_index + 1:], left_index + 1):
            if (
                left["latest"] <= right["earliest"]
                or right["latest"] <= left["earliest"]
            ):
                continue
            left_before = model.NewBoolVar(
                f"secondary_{left_index}_before_{right_index}"
            )
            right_before = model.NewBoolVar(
                f"secondary_{right_index}_before_{left_index}"
            )
            conflict = model.NewBoolVar(
                f"secondary_conflict_{left_index}_{right_index}"
            )
            model.Add(left["end"] <= right["start"]).OnlyEnforceIf(left_before)
            model.Add(right["end"] <= left["start"]).OnlyEnforceIf(right_before)
            model.AddExactlyOne([left_before, right_before, conflict])
            conflict_terms.append(conflict)

    max_base_cost = (
        len(records) * _SECONDS_PER_DAY
        + len(records) * 30 * 60
    )
    duration_weight = max_base_cost + 1
    max_weighted_reduction = sum(
        record["original_minutes"] * (
            _secondary_reduction_weight(record["task"]) or 0
        )
        for record in records
    )
    conflict_weight = (
        max_weighted_reduction * duration_weight + max_base_cost + 1
    )
    model.Minimize(
        sum(conflict_terms) * conflict_weight
        + sum(target_terms)
        + sum(move_terms)
        + sum(reduction_terms) * duration_weight
    )
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max(1.0, min(time_limit, 30.0))
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.Solve(model)
    status_name = solver.StatusName(status)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "feasible": False,
            "solver_status": status_name,
            "moved_secondary_tasks": [],
            "reduced_secondary_count": 0,
            "reduced_secondary_minutes": 0,
        }

    moved: list[dict[str, Any]] = []
    reduced_count = 0
    reduced_minutes = 0
    for record in records:
        task = record["task"]
        chosen = next(
            option
            for choice, option in record["choices"]
            if solver.Value(choice)
        )
        start = solver.Value(record["start"])
        end = solver.Value(record["end"])
        task["clock"] = _format_clock(
            _date_day(task["date"]), start, end
        )
        task["fixed_start"] = None
        if chosen["moved"]:
            task["placement_period"] = chosen["period"]
            task["placement_reason"] = (
                f"Moved from {task['period']} to TỐI because the source "
                "window conflicts with the day's fixed Main schedule; "
                "the task meaning permits evening placement."
            )
            moved.append({
                "task_id": task["task_id"],
                "date": task["date"],
                "task_name": task["task_name"],
                "from_period": task["period"],
                "to_period": chosen["period"],
                "clock": task["clock"],
            })
        scheduled_minutes = solver.Value(record["duration"])
        if scheduled_minutes < record["original_minutes"]:
            task["scheduled_duration_minutes"] = scheduled_minutes
            task["scheduled_duration_hours"] = scheduled_minutes / 60
            task["duration_adjustment_reason"] = (
                "Duration was minimally reduced after full-duration placement "
                "and permitted evening placement proved insufficient."
            )
            reduced_count += 1
            reduced_minutes += record["original_minutes"] - scheduled_minutes
    return {
        "feasible": True,
        "solver_status": status_name,
        "moved_secondary_tasks": moved,
        "reduced_secondary_count": reduced_count,
        "reduced_secondary_minutes": reduced_minutes,
        "conflict_pair_count": _secondary_conflict_pair_count(schedule),
    }


def _secondary_conflict_pair_count(schedule: dict[str, Any]) -> int:
    tasks = [
        *schedule.get("tasks", []),
        *schedule.get("secondary_tasks", []),
    ]
    conflicts = 0
    for left_index, left in enumerate(tasks):
        left_clock = _parse_clock(left.get("clock"))
        if not left_clock:
            continue
        left_base = _date_day(left["date"]) * _SECONDS_PER_DAY
        left_start, left_end = left_base + left_clock[0], left_base + left_clock[1]
        for right in tasks[left_index + 1:]:
            if (
                left.get("task_type") != "secondary"
                and right.get("task_type") != "secondary"
            ):
                continue
            right_clock = _parse_clock(right.get("clock"))
            right_base = _date_day(right["date"]) * _SECONDS_PER_DAY
            if (
                right_clock
                and left_start < right_base + right_clock[1]
                and right_base + right_clock[0] < left_end
            ):
                conflicts += 1
    return conflicts


def _main_secondary_conflict_pair_count(schedule: dict[str, Any]) -> int:
    main_tasks = schedule.get("tasks", [])
    secondary_tasks = schedule.get("secondary_tasks", [])
    conflicts = 0
    for main in main_tasks:
        main_clock = _parse_clock(main.get("clock"))
        if not main_clock:
            continue
        main_base = _date_day(main["date"]) * _SECONDS_PER_DAY
        for secondary in secondary_tasks:
            secondary_clock = _parse_clock(secondary.get("clock"))
            if not secondary_clock:
                continue
            secondary_base = _date_day(secondary["date"]) * _SECONDS_PER_DAY
            if (
                main_base + main_clock[0] < secondary_base + secondary_clock[1]
                and secondary_base + secondary_clock[0]
                < main_base + main_clock[1]
            ):
                conflicts += 1
    return conflicts


def _secondary_window_violation_count(schedule: dict[str, Any]) -> int:
    violations = 0
    for task in schedule.get("secondary_tasks", []):
        clock = _parse_clock(task.get("clock"))
        if not clock:
            violations += 1
            continue
        period = task.get("placement_period", task["period"])
        window_start, window_end = (
            _PERIOD_WINDOWS[period]
            if period != task["period"]
            else (
                _time_seconds(task["window_start"]),
                _time_seconds(task["window_end"]),
            )
        )
        if task.get("context_type") == "breakfast":
            window_end = min(window_end, 10 * 3600)
        if task.get("context_type") == "morning_hygiene":
            fixed_starts = [
                _time_seconds(main["fixed_start"])
                for main in schedule["tasks"]
                if main["date"] == task["date"]
                and main.get("task_type") == "fixed"
            ]
            if fixed_starts:
                window_end = min(window_end, min(fixed_starts))
        if (
            clock[0] < window_start
            or clock[1] > window_end
            or clock[1] - clock[0]
            != int(task.get("scheduled_duration_minutes", task["duration_minutes"])) * 60
        ):
            violations += 1
    return violations


def _fallback_secondary_placement(schedule: dict[str, Any]) -> None:
    main_intervals = []
    for task in schedule.get("tasks", []):
        clock = _parse_clock(task.get("clock"))
        if clock:
            base = _date_day(task["date"]) * _SECONDS_PER_DAY
            main_intervals.append((base + clock[0], base + clock[1]))

    placed_by_date: dict[str, list[tuple[int, int]]] = defaultdict(list)
    tasks = schedule.get("secondary_tasks", [])
    for task in tasks:
        task.pop("placement_period", None)
        task.pop("placement_reason", None)
    for task in sorted(
        tasks,
        key=lambda item: (
            item["date"],
            item.get("period_order", 0),
            item.get("source_order", 0),
        ),
    ):
        base = _date_day(task["date"]) * _SECONDS_PER_DAY
        duration_minutes = int(
            task.get("scheduled_duration_minutes", task["duration_minutes"])
        )
        duration = duration_minutes * 60
        options = [dict(option) for option in _secondary_window_options(task)]
        if duration_minutes < int(task["duration_minutes"]):
            options = [
                option for option in options
                if option["period"] == "TỐI"
            ]
            if not options:
                raise ValueError(
                    f"Reduced Secondary Task {task['task_id']} has no "
                    "authorized evening placement."
                )
        if task.get("context_type") == "breakfast":
            for option in options:
                if option["period"] != "TỐI":
                    option["end"] = min(option["end"], 10 * 3600)
        if task.get("context_type") == "morning_hygiene":
            fixed_starts = [
                _time_seconds(main["fixed_start"])
                for main in schedule.get("tasks", [])
                if main["date"] == task["date"]
                and main.get("task_type") == "fixed"
            ]
            if fixed_starts:
                for option in options:
                    if option["period"] == task["period"]:
                        option["end"] = min(
                            option["end"], min(fixed_starts)
                        )
        options = [
            option for option in options
            if option["end"] - option["start"] >= duration
        ] or options
        chosen: tuple[int, dict[str, Any]] | None = None
        for option in options:
            target = _secondary_target(task, option)
            latest = option["end"] - duration
            starts = list(range(option["start"], latest + 1, 60))
            starts.sort(key=lambda start: (abs(start - target), start))
            for start in starts:
                absolute_start = base + start
                absolute_end = absolute_start + duration
                if all(
                    absolute_end <= other_start or absolute_start >= other_end
                    for other_start, other_end in [
                        *main_intervals,
                        *placed_by_date[task["date"]],
                    ]
                ):
                    chosen = start, option
                    break
            if chosen:
                break
        if chosen is None:
            option = options[0]
            start = min(
                max(_secondary_target(task, option), option["start"]),
                max(option["start"], option["end"] - duration),
            )
        else:
            start, option = chosen
        task["clock"] = _format_clock(
            _date_day(task["date"]),
            base + start,
            base + start + duration,
        )
        task["fixed_start"] = None
        if option["moved"]:
            task["placement_period"] = option["period"]
            task["placement_reason"] = (
                f"Moved from {task['period']} to TỐI because the source "
                "window conflicts with the day's fixed Main schedule; "
                "the task meaning permits evening placement."
            )
        placed_by_date[task["date"]].append(
            (base + start, base + start + duration)
        )


def _build_main_schedule(
    package: dict[str, Any],
    records: list[dict[str, Any]],
    solver: Any,
    flexible_units: dict[int, tuple[Any, int]],
) -> dict[str, Any]:
    result = copy.deepcopy(package)
    result["kind"] = "optimized_schedule"
    result_tasks = {task["task_id"]: task for task in result["tasks"]}
    for record in records:
        if record["task_type"] == "secondary":
            continue
        output = result_tasks[record["task"]["task_id"]]
        start = solver.Value(record["start"])
        end = solver.Value(record["end"])
        output["clock"] = _format_clock(record["base_day"], start, end)
        if record["task_type"] == "flexible":
            units = solver.Value(flexible_units[record["index"]][0])
            output["duration_hours"] = units / 100
            output["fixed_start"] = None

    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for task in result["tasks"]:
        by_date[task["date"]].append(task)
    for day_tasks in by_date.values():
        sleep_tasks = [
            task for task in day_tasks if task["task_type"] == "sleep"
        ]
        other_tasks = [
            task for task in day_tasks if task["task_type"] != "sleep"
        ]
        other_tasks.sort(
            key=lambda task: (_parse_clock(task["clock"]) or (0, 0))[0]
        )
        for order, task in enumerate(other_tasks, start=1):
            task["schedule_order"] = order
        for order, task in enumerate(sleep_tasks, start=len(other_tasks) + 1):
            task["schedule_order"] = order
    return result


def optimize_schedule(package: Any, time_limit: float = 20.0) -> dict[str, Any]:
    """Solve a normalized week and return a complete schedule plus audit metrics."""
    tasks, secondary, default_start = _prepare_input(package)
    try:
        from ortools.sat.python import cp_model
    except ImportError as error:
        raise RuntimeError(
            "OR-Tools is not installed. Run the one-time setup in "
            "VSCODE_OPTIMIZATION_WORKFLOW.md."
        ) from error

    started = time.monotonic()
    settings = package["schedule_settings"]
    week_start = package.get("source", {}).get("week_start")
    if not isinstance(week_start, str):
        raise ValueError("Input source.week_start is required.")
    _date_day(week_start)

    hint_schedule = _fallback_schedule(package, default_start)
    _fallback_secondary_placement(hint_schedule)
    model = cp_model.CpModel()
    records: list[dict[str, Any]] = []
    flexible_units: dict[int, tuple[Any, int]] = {}
    variable_starts: list[tuple[Any, int]] = []
    main_indices_by_date: dict[str, list[int]] = defaultdict(list)
    day_start = _time_seconds(settings["defaultStartTime"])
    break_seconds = int(settings["breakMinutes"]) * 60

    all_tasks = [(task, False) for task in tasks] + [(task, True) for task in secondary]
    for index, (task, is_secondary) in enumerate(all_tasks):
        if not isinstance(task, dict):
            raise ValueError("Every task record must be an object.")
        task_id = task["task_id"]
        base_day = _date_day(task["date"])
        base = base_day * _SECONDS_PER_DAY
        task_type = "secondary" if is_secondary else task.get("task_type")

        if task_type == "secondary":
            records.append({
                "task": task,
                "is_secondary": True,
                "index": index,
                "base_day": base_day,
                "base": base,
                "start": None,
                "end": None,
                "interval": None,
                "task_type": task_type,
                "anchor_start": None,
            })
            continue
        elif task_type == "flexible":
            if task.get("fixed_start") is not None:
                raise ValueError(
                    f"Flexible task {task_id} has a fixed_start and cannot "
                    "use the flexible-duration policy."
                )
            original_hours = float(task.get("original_duration_hours", 0))
            original_units = int(math.floor(original_hours * 100 + 0.5))
            if (
                original_units <= 0
                or abs(original_hours - original_units / 100) > 1e-7
            ):
                raise ValueError(
                    f"Flexible task {task_id} must have a positive duration "
                    "with at most two decimal places."
                )
            max_reduction = 25 if original_units <= 100 else 50
            minimum_units = max(2, original_units - max_reduction)
            duration_units = model.NewIntVar(
                minimum_units, original_units, f"duration_units_{index}"
            )
            duration_seconds = duration_units * _CENTIHOUR_SECONDS
            start_bound = base + day_start
            end_bound = base + _SECONDS_PER_DAY + day_start
            start_var = model.NewIntVar(
                start_bound,
                max(
                    start_bound,
                    end_bound - minimum_units * _CENTIHOUR_SECONDS,
                ),
                f"start_{index}",
            )
            end_var = model.NewIntVar(
                start_bound + minimum_units * _CENTIHOUR_SECONDS,
                max(
                    start_bound + minimum_units * _CENTIHOUR_SECONDS,
                    end_bound,
                ),
                f"end_{index}",
            )
            interval = model.NewIntervalVar(
                start_var, duration_seconds, end_var, f"interval_{index}"
            )
            model.Add(end_var <= end_bound)
            flexible_units[index] = duration_units, original_units
            variable_starts.append((start_var, base))
            hint_task = next(
                item for item in hint_schedule["tasks"]
                if item["task_id"] == task_id
            )
            hint_clock = _parse_clock(hint_task.get("clock"))
            hint_duration = int(round(
                float(hint_task["duration_hours"]) * 100
            ))
            model.AddHint(
                duration_units,
                min(original_units, max(minimum_units, hint_duration)),
            )
            model.AddHint(
                start_var,
                max(
                    start_bound,
                    min(
                        end_bound - minimum_units * _CENTIHOUR_SECONDS,
                        base + (hint_clock[0] if hint_clock else day_start),
                    ),
                ),
            )
        elif task_type in ("fixed", "sleep"):
            fixed_time = task.get("fixed_start")
            if task_type == "sleep":
                fixed_time = settings.get("sleepStartTime")
            duration = _duration_seconds(
                task.get("duration_hours"), f"Task {task_id}"
            )
            start_bound = base + _time_seconds(fixed_time)
            start_var = model.NewConstant(start_bound)
            interval = model.NewFixedSizeIntervalVar(
                start_var, duration, f"interval_{index}"
            )
        else:
            raise ValueError(f"Task {task_id} has unsupported task_type {task_type!r}.")

        if task_type != "secondary":
            main_indices_by_date[task["date"]].append(index)
        records.append({
            "task": task,
            "is_secondary": is_secondary,
            "index": index,
            "base_day": base_day,
            "base": base,
            "start": start_var,
            "end": end_var if task_type in ("secondary", "flexible") else start_bound + duration,
            "interval": interval,
            "task_type": task_type,
            "anchor_start": (
                start_bound
                if task_type in ("fixed", "sleep")
                else None
            ),
        })
    anchor_records = [
        record for record in records
        if record["task_type"] in ("fixed", "sleep")
    ]
    anchor_conflicts: list[dict[str, Any]] = []
    anchor_spans: list[tuple[int, int]] = []
    for left_index, left in enumerate(anchor_records):
        for right in anchor_records[left_index + 1:]:
            left_start = int(left["anchor_start"])
            right_start = int(right["anchor_start"])
            left_end = left_start + _duration_seconds(
                left["task"]["duration_hours"], left["task"]["task_id"]
            )
            right_end = right_start + _duration_seconds(
                right["task"]["duration_hours"], right["task"]["task_id"]
            )
            if left_start < right_end and right_start < left_end:
                anchor_conflicts.append({
                    "date": left["task"]["date"],
                    "task_ids": [left["task"]["task_id"], right["task"]["task_id"]],
                    "overlap_seconds": min(left_end, right_end) - max(left_start, right_start),
                })
    for record in anchor_records:
        start = int(record["anchor_start"])
        duration = _duration_seconds(
            record["task"]["duration_hours"], record["task"]["task_id"]
        )
        anchor_spans.append((start, start + duration))
    anchor_spans.sort()
    merged_anchor_spans: list[tuple[int, int]] = []
    for start, end in anchor_spans:
        if merged_anchor_spans and start <= merged_anchor_spans[-1][1]:
            previous_start, previous_end = merged_anchor_spans[-1]
            merged_anchor_spans[-1] = (previous_start, max(previous_end, end))
        else:
            merged_anchor_spans.append((start, end))
    protected_anchor_intervals = [
        model.NewFixedSizeIntervalVar(
            model.NewConstant(start),
            end - start,
            f"protected_anchor_{index}",
        )
        for index, (start, end) in enumerate(merged_anchor_spans)
    ]
    flexible_intervals = [
        record["interval"] for record in records
        if record["task_type"] == "flexible"
    ]
    model.AddNoOverlap(flexible_intervals + protected_anchor_intervals)
    allow_duration_reduction = model.NewBoolVar("allow_duration_reduction")
    for duration_units, original_units in flexible_units.values():
        model.Add(
            duration_units == original_units
        ).OnlyEnforceIf(allow_duration_reduction.Not())
    model.AddAssumption(allow_duration_reduction.Not())

    secondary_seed = copy.deepcopy(hint_schedule)
    secondary_seed_tasks = secondary_seed.get("secondary_tasks", [])
    main_secondary_conflict_terms: list[Any] = []
    for record in records:
        if record["task_type"] != "flexible":
            continue
        for task in secondary_seed_tasks:
            clock = _parse_clock(task.get("clock"))
            if not clock:
                continue
            base = _date_day(task["date"]) * _SECONDS_PER_DAY
            secondary_start = base + clock[0]
            secondary_end = base + clock[1]
            flexible_start = (
                _date_day(record["task"]["date"]) * _SECONDS_PER_DAY
                + day_start
            )
            flexible_end = flexible_start + _SECONDS_PER_DAY
            if secondary_start >= flexible_end or secondary_end <= flexible_start:
                continue
            before = model.NewBoolVar(
                f"main_before_secondary_{record['index']}_{task['task_id']}"
            )
            after = model.NewBoolVar(
                f"secondary_before_main_{record['index']}_{task['task_id']}"
            )
            conflict = model.NewBoolVar(
                f"main_secondary_conflict_{record['index']}_{task['task_id']}"
            )
            model.Add(
                record["end"] <= secondary_start
            ).OnlyEnforceIf(before)
            model.Add(
                secondary_end <= record["start"]
            ).OnlyEnforceIf(after)
            model.Add(before + after + conflict == 1)
            main_secondary_conflict_terms.append(conflict)

    order_literals: dict[tuple[int, int], Any] = {}
    for left_index, left in enumerate(records):
        if left["task_type"] == "secondary":
            continue
        for right in records[left_index + 1:]:
            if right["task_type"] == "secondary":
                continue
            if (
                left["task_type"] in ("fixed", "sleep")
                and right["task_type"] in ("fixed", "sleep")
                and any(
                    set(conflict["task_ids"]) == {
                        left["task"]["task_id"],
                        right["task"]["task_id"],
                    }
                    for conflict in anchor_conflicts
                )
            ):
                continue
            before = model.NewBoolVar(
                f"before_{left['index']}_{right['index']}"
            )
            order_literals[(left["index"], right["index"])] = before
            gap = (
                break_seconds
                if break_seconds and (
                    left["task_type"] == "flexible"
                    or right["task_type"] == "flexible"
                )
                else 0
            )
            model.Add(left["end"] + gap <= right["start"]).OnlyEnforceIf(before)
            model.Add(right["end"] + gap <= left["start"]).OnlyEnforceIf(
                before.Not()
            )

    inversion_terms: list[Any] = []
    for date_text in sorted(main_indices_by_date):
        date_records = [
            record for record in records
            if record["task_type"] != "secondary"
            and record["task"]["date"] == date_text
            and record["task_type"] != "sleep"
        ]
        date_records.sort(
            key=lambda record: (
                record["task"].get("source_order", 0),
                record["index"],
            )
        )
        for position, preferred in enumerate(date_records):
            for later in date_records[position + 1:]:
                a, b = preferred["index"], later["index"]
                if a < b:
                    before = order_literals.get((a, b))
                    if before is not None:
                        inversion_terms.append(1 - before)
                else:
                    before = order_literals.get((b, a))
                    if before is not None:
                        inversion_terms.append(before)

    compactness_terms = [start - base for start, base in variable_starts]
    lower_priority_bound = len(compactness_terms) * _SECONDS_PER_DAY
    inversion_weight = lower_priority_bound + 1
    order_and_compactness_bound = (
        len(inversion_terms) * inversion_weight
        + lower_priority_bound
    )
    reduction_weight = order_and_compactness_bound + 1
    maximum_reduction_units = sum(
        original_units - max(2, original_units - (
            25 if original_units <= 100 else 50
        ))
        for _, original_units in flexible_units.values()
    )
    main_secondary_conflict_weight = (
        maximum_reduction_units * reduction_weight
        + order_and_compactness_bound
        + 1
    )
    objective = (
        sum(
            (original_units - duration_units) * reduction_weight
            for duration_units, original_units in flexible_units.values()
        )
        + sum(main_secondary_conflict_terms)
        * main_secondary_conflict_weight
        + sum(inversion * inversion_weight for inversion in inversion_terms)
        + sum(compactness_terms)
    )
    model.Minimize(objective)

    def add_secondary_conflicts(
        secondary_schedule: dict[str, Any],
    ) -> list[Any]:
        terms = []
        for record in records:
            if record["task_type"] != "flexible":
                continue
            main_start_bound = record["base"] + day_start
            main_end_bound = main_start_bound + _SECONDS_PER_DAY
            for task in secondary_schedule.get("secondary_tasks", []):
                clock = _parse_clock(task.get("clock"))
                if not clock:
                    continue
                task_base = _date_day(task["date"]) * _SECONDS_PER_DAY
                secondary_start = task_base + clock[0]
                secondary_end = task_base + clock[1]
                if (
                    secondary_start >= main_end_bound
                    or secondary_end <= main_start_bound
                ):
                    continue
                before = model.NewBoolVar(
                    f"iter_main_before_secondary_{record['index']}_{task['task_id']}"
                )
                after = model.NewBoolVar(
                    f"iter_secondary_before_main_{record['index']}_{task['task_id']}"
                )
                conflict = model.NewBoolVar(
                    f"iter_main_secondary_conflict_{record['index']}_{task['task_id']}"
                )
                model.Add(
                    record["end"] <= secondary_start
                ).OnlyEnforceIf(before)
                model.Add(
                    secondary_end <= record["start"]
                ).OnlyEnforceIf(after)
                model.AddExactlyOne([before, after, conflict])
                terms.append(conflict)
        return terms

    solver = cp_model.CpSolver()
    solve_limit = max(1.0, min(float(time_limit), 120.0))
    solver.parameters.max_time_in_seconds = solve_limit
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    solver.parameters.log_search_progress = False
    status = solver.Solve(model)
    reduction_phase_attempted = False
    if status == cp_model.INFEASIBLE:
        reduction_phase_attempted = True
        model.ClearAssumptions()
        model.AddAssumption(allow_duration_reduction)
        solver.parameters.max_time_in_seconds = solve_limit
        status = solver.Solve(model)
    schedule_result = None
    secondary_result = None
    main_solution_status = (
        solver.StatusName(status)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        else None
    )
    main_solver_metrics = None
    if main_solution_status:
        main_solver_metrics = {
            "objective_value": round(solver.ObjectiveValue(), 3),
            "best_bound": round(solver.BestObjectiveBound(), 3),
            "reduced_main_count": sum(
                solver.Value(units) < original
                for units, original in flexible_units.values()
            ),
            "reduced_hours": round(sum(
                (original - solver.Value(units)) / 100
                for units, original in flexible_units.values()
            ), 2),
        }
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule_result = _build_main_schedule(
            package, records, solver, flexible_units
        )
        secondary_result = _schedule_secondary_tasks(
            schedule_result, time_limit=min(5.0, solve_limit)
        )
        best_conflicts = _secondary_conflict_pair_count(schedule_result)
        if best_conflicts and secondary_result["feasible"]:
            iterative_conflicts = add_secondary_conflicts(schedule_result)
            if iterative_conflicts:
                model.ClearAssumptions()
                model.AddAssumption(allow_duration_reduction.Not())
                model.Minimize(
                    objective
                    + sum(iterative_conflicts) * main_secondary_conflict_weight
                )
                solver.parameters.max_time_in_seconds = solve_limit
                iterative_status = solver.Solve(model)
                if iterative_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                    iterative_schedule = _build_main_schedule(
                        package, records, solver, flexible_units
                    )
                    iterative_secondary_result = _schedule_secondary_tasks(
                        iterative_schedule, time_limit=min(5.0, solve_limit)
                    )
                    iterative_conflicts_count = _secondary_conflict_pair_count(
                        iterative_schedule
                    )
                    if iterative_conflicts_count < best_conflicts:
                        schedule_result = iterative_schedule
                        secondary_result = iterative_secondary_result
                        best_conflicts = iterative_conflicts_count
                        main_solution_status = solver.StatusName(iterative_status)
                        main_solver_metrics = {
                            "objective_value": round(solver.ObjectiveValue(), 3),
                            "best_bound": round(solver.BestObjectiveBound(), 3),
                            "reduced_main_count": sum(
                                solver.Value(units) < original
                                for units, original in flexible_units.values()
                            ),
                            "reduced_hours": round(sum(
                                (original - solver.Value(units)) / 100
                                for units, original in flexible_units.values()
                            ), 2),
                        }

        if best_conflicts:
            reduction_phase_attempted = True
            model.ClearAssumptions()
            model.AddAssumption(allow_duration_reduction)
            solver.parameters.max_time_in_seconds = solve_limit
            reduced_status = solver.Solve(model)
            if reduced_status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                reduced_metrics = {
                    "objective_value": round(solver.ObjectiveValue(), 3),
                    "best_bound": round(solver.BestObjectiveBound(), 3),
                    "reduced_main_count": sum(
                        solver.Value(units) < original
                        for units, original in flexible_units.values()
                    ),
                    "reduced_hours": round(sum(
                        (original - solver.Value(units)) / 100
                        for units, original in flexible_units.values()
                    ), 2),
                }
                reduced_schedule = _build_main_schedule(
                    package, records, solver, flexible_units
                )
                reduced_secondary_result = _schedule_secondary_tasks(
                    reduced_schedule, time_limit=min(5.0, solve_limit)
                )
                reduced_conflicts = _secondary_conflict_pair_count(
                    reduced_schedule
                )
                if reduced_conflicts < best_conflicts:
                    schedule_result = reduced_schedule
                    secondary_result = reduced_secondary_result
                    best_conflicts = reduced_conflicts
                    main_solution_status = solver.StatusName(reduced_status)
                    main_solver_metrics = reduced_metrics

        if best_conflicts and secondary_result["feasible"]:
            reduced_secondary_schedule = copy.deepcopy(schedule_result)
            reduced_secondary_result = _schedule_secondary_tasks(
                reduced_secondary_schedule,
                allow_duration_reduction=True,
                time_limit=min(5.0, solve_limit),
            )
            if reduced_secondary_result["feasible"]:
                reduced_conflicts = _secondary_conflict_pair_count(
                    reduced_secondary_schedule
                )
                if reduced_conflicts < best_conflicts:
                    schedule_result = reduced_secondary_schedule
                    secondary_result = reduced_secondary_result
                    best_conflicts = reduced_conflicts

        if not secondary_result["feasible"]:
            _fallback_secondary_placement(schedule_result)
            moved = [
                {
                    "task_id": task["task_id"],
                    "date": task["date"],
                    "task_name": task["task_name"],
                    "from_period": task["period"],
                    "to_period": task.get("placement_period", task["period"]),
                    "clock": task.get("clock"),
                }
                for task in schedule_result.get("secondary_tasks", [])
                if task.get("placement_period")
            ]
            secondary_result = {
                "feasible": True,
                "solver_status": secondary_result["solver_status"],
                "moved_secondary_tasks": moved,
                "reduced_secondary_count": 0,
                "reduced_secondary_minutes": 0,
                "conflict_pair_count": _secondary_conflict_pair_count(
                    schedule_result
                ),
            }
        repaired_schedule = copy.deepcopy(schedule_result)
        _fallback_secondary_placement(repaired_schedule)
        current_score = (
            _secondary_conflict_pair_count(schedule_result),
            _secondary_window_violation_count(schedule_result),
        )
        repaired_score = (
            _secondary_conflict_pair_count(repaired_schedule),
            _secondary_window_violation_count(repaired_schedule),
        )
        if repaired_score < current_score:
            schedule_result = repaired_schedule

    elapsed = time.monotonic() - started
    status_name = main_solution_status or solver.StatusName(status)
    if (
        schedule_result is not None
        and secondary_result is not None
        and secondary_result["feasible"]
    ):
        secondary_conflict_count = _secondary_conflict_pair_count(schedule_result)
        secondary_window_violations = _secondary_window_violation_count(
            schedule_result
        )
        report = {
            "engine": "Google OR-Tools CP-SAT",
            "engine_version": __import__("ortools").__version__,
            "solver_status": status_name,
            "candidate_quality": (
                "solver_with_conflicts"
                if (
                    anchor_conflicts
                    or secondary_conflict_count
                    or secondary_window_violations
                )
                else "solver"
            ),
            "duration_reduction_phase_attempted": reduction_phase_attempted,
            "solve_seconds": round(elapsed, 3),
            "objective_value": main_solver_metrics["objective_value"],
            "best_bound": main_solver_metrics["best_bound"],
            "main_task_count": len(tasks),
            "secondary_task_count": len(secondary),
            "flexible_main_count": len(flexible_units),
            "reduced_main_count": main_solver_metrics["reduced_main_count"],
            "reduced_hours": main_solver_metrics["reduced_hours"],
            "main_secondary_conflict_pair_count": (
                _main_secondary_conflict_pair_count(schedule_result)
            ),
            "secondary_conflict_pair_count": secondary_conflict_count,
            "secondary_window_violation_count": secondary_window_violations,
            "secondary_solver_status": secondary_result["solver_status"],
            "moved_secondary_count": sum(
                task.get("placement_period") is not None
                for task in schedule_result.get("secondary_tasks", [])
            ),
            "moved_secondary_tasks": [
                {
                    "task_id": task["task_id"],
                    "date": task["date"],
                    "task_name": task["task_name"],
                    "from_period": task["period"],
                    "to_period": task["placement_period"],
                    "clock": task.get("clock"),
                }
                for task in schedule_result.get("secondary_tasks", [])
                if task.get("placement_period")
            ],
            "reduced_secondary_count": sum(
                task.get("scheduled_duration_minutes", task["duration_minutes"])
                < task["duration_minutes"]
                for task in schedule_result.get("secondary_tasks", [])
            ),
            "reduced_secondary_minutes": sum(
                task["duration_minutes"]
                - task.get("scheduled_duration_minutes", task["duration_minutes"])
                for task in schedule_result.get("secondary_tasks", [])
            ),
            "source_anchor_conflicts": anchor_conflicts,
        }
        return {"optimized_schedule": schedule_result, "report": report}

    fallback = schedule_result or _fallback_schedule(package, default_start)
    if schedule_result is None:
        secondary_result = _schedule_secondary_tasks(
            fallback, time_limit=min(5.0, solve_limit)
        )
        if not secondary_result["feasible"]:
            secondary_result = _schedule_secondary_tasks(
                fallback,
                allow_duration_reduction=True,
                time_limit=min(5.0, solve_limit),
            )
        if not secondary_result["feasible"]:
            _fallback_secondary_placement(fallback)
    secondary_conflict_count = _secondary_conflict_pair_count(fallback)
    secondary_window_violations = _secondary_window_violation_count(fallback)
    report = {
        "engine": "Google OR-Tools CP-SAT",
        "engine_version": __import__("ortools").__version__,
        "solver_status": status_name,
        "candidate_quality": "best_effort_preview",
        "duration_reduction_phase_attempted": reduction_phase_attempted,
        "solve_seconds": round(elapsed, 3),
        "main_task_count": len(tasks),
        "secondary_task_count": len(secondary),
        "flexible_main_count": sum(
            task.get("task_type") == "flexible" for task in tasks
        ),
        "reduced_main_count": sum(
            float(task.get("duration_hours", 0))
            < float(task.get("original_duration_hours", 0))
            for task in fallback["tasks"]
        ),
        "reduced_hours": round(sum(
            float(task.get("original_duration_hours", 0))
            - float(task.get("duration_hours", 0))
            for task in fallback["tasks"]
            if task.get("task_type") == "flexible"
        ), 2),
        "main_secondary_conflict_pair_count": None,
        "secondary_conflict_pair_count": secondary_conflict_count,
        "secondary_window_violation_count": secondary_window_violations,
        "secondary_solver_status": (
            secondary_result["solver_status"] if secondary_result else None
        ),
        "moved_secondary_count": (
            len(secondary_result["moved_secondary_tasks"])
            if secondary_result else 0
        ),
        "moved_secondary_tasks": (
            secondary_result["moved_secondary_tasks"]
            if secondary_result else []
        ),
        "reduced_secondary_count": (
            secondary_result["reduced_secondary_count"]
            if secondary_result else 0
        ),
        "reduced_secondary_minutes": (
            secondary_result["reduced_secondary_minutes"]
            if secondary_result else 0
        ),
        "source_anchor_conflicts": anchor_conflicts,
    }
    return {"optimized_schedule": fallback, "report": report}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--time-limit", type=float, default=20.0)
    arguments = parser.parse_args()
    try:
        package = json.load(sys.stdin)
        result = optimize_schedule(package, arguments.time_limit)
        json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.stdout.write("\n")
        return 0
    except Exception as error:
        print(f"Scheduler optimizer failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
