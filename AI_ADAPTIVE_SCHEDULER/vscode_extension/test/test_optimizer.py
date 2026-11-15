import copy
import datetime
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from optimizer import (
    _fallback_secondary_placement,
    _schedule_secondary_tasks,
    _secondary_conflict_pair_count,
    optimize_schedule,
)


def create_week(fixed_conflict=False):
    weekdays = [
        "THỨ HAI",
        "THỨ BA",
        "THỨ TƯ",
        "THỨ NĂM",
        "THỨ SÁU",
        "THỨ BẢY",
        "CHỦ NHẬT",
    ]
    tasks = []
    secondary = []
    for offset, weekday in enumerate(weekdays):
        date = datetime.date(2026, 11, 9) + datetime.timedelta(days=offset)
        date_text = date.isoformat()
        tasks.append({
            "task_id": f"SLEEP-{offset}",
            "date": date_text,
            "weekday": weekday,
            "source_order": 3,
            "schedule_order": 3,
            "task_type": "sleep",
            "task_name": "Ngủ đêm",
            "duration_hours": 5,
            "original_duration_hours": 5,
            "fixed_start": "03:00",
            "clock": "03:00 - 08:00",
            "color": "GRAY",
            "source": {"generated": True},
        })
        if offset == 0:
            tasks.extend([
                {
                    "task_id": "FLEX-1",
                    "date": date_text,
                    "weekday": weekday,
                    "source_order": 1,
                    "schedule_order": 1,
                    "task_type": "flexible",
                    "task_name": "Flexible work",
                    "duration_hours": 1,
                    "original_duration_hours": 1,
                    "fixed_start": None,
                    "clock": None,
                    "color": "BLUE",
                    "source": {"ready_cell": "O16", "master_row": 3},
                },
                {
                    "task_id": "FIXED-1",
                    "date": date_text,
                    "weekday": weekday,
                    "source_order": 2,
                    "schedule_order": 2,
                    "task_type": "fixed",
                    "task_name": "Fixed work",
                    "duration_hours": 1,
                    "original_duration_hours": 1,
                    "fixed_start": "10:00",
                    "clock": "10:00 - 11:00",
                    "color": "RED",
                    "source": {"ready_cell": "Q16", "master_row": 4},
                },
            ])
            if fixed_conflict:
                tasks.append({
                    "task_id": "FIXED-2",
                    "date": date_text,
                    "weekday": weekday,
                    "source_order": 4,
                    "schedule_order": 4,
                    "task_type": "fixed",
                    "task_name": "Conflicting fixed work",
                    "duration_hours": 1,
                    "original_duration_hours": 1,
                    "fixed_start": "10:30",
                    "clock": "10:30 - 11:30",
                    "color": "RED",
                    "source": {"ready_cell": "S16", "master_row": 5},
                })
            else:
                secondary.append({
                    "task_id": "SEC-BREAKFAST",
                    "date": date_text,
                    "weekday": weekday,
                    "source_order": 1,
                    "period_order": 1,
                    "task_type": "secondary",
                    "task_name": "AUS",
                    "period": "SÁNG",
                    "window_start": "06:00",
                    "window_end": "10:00",
                    "window_label": "06:00-10:00",
                    "group": "SINH HOẠT",
                    "category": "",
                    "class": "SINH HOẠT",
                    "context_type": "breakfast",
                    "icon": "⛅️",
                    "description": "Breakfast",
                    "duration_minutes": 20,
                    "duration_hours": 1 / 3,
                    "original_duration_hours": 1 / 3,
                    "fixed_start": None,
                    "clock": None,
                    "suggested_clock": "08:10 - 08:30",
                    "color": "MÀU HOA ANH ĐÀO",
                    "source": {
                        "day_tab": weekday,
                        "task_cell": "J4",
                        "duration_cell": "K4",
                        "catalog_row": 3,
                    },
                })

    next(task for task in tasks if task["task_type"] == "flexible").pop(
        "fixed_start"
    )
    return {
        "format": "AI_ADAPTIVE_SCHEDULER_TRANSFER",
        "schema_version": 4,
        "kind": "normalized_input",
        "source": {
            "spreadsheet_id": "source",
            "spreadsheet_title": "Source",
            "source_tab": "TUẦN",
            "destination_tab": "09/11 - 15/11/ 2026",
            "week_start": "2026-11-09",
            "week_end": "2026-11-15",
        },
        "schedule_settings": {
            "defaultStartTime": "07:30",
            "defaultStartMinutes": 450,
            "breakMinutes": 15,
            "sleepStartTime": "03:00",
            "sleepStartMinutes": 180,
            "sleepDurationHours": 5,
        },
        "source_fingerprint": "preserve-me",
        "tasks": tasks,
        "secondary_tasks": secondary,
    }


class OptimizerTests(unittest.TestCase):
    def test_solves_week_and_preserves_task_source_fields(self):
        source = create_week()
        result = optimize_schedule(source, time_limit=5)
        schedule = result["optimized_schedule"]
        self.assertIn(result["report"]["solver_status"], ("OPTIMAL", "FEASIBLE"))
        self.assertEqual(result["report"]["reduced_main_count"], 0)
        self.assertFalse(result["report"]["duration_reduction_phase_attempted"])
        self.assertEqual(schedule["kind"], "optimized_schedule")
        self.assertEqual(schedule["source_fingerprint"], source["source_fingerprint"])
        self.assertEqual(
            [task["task_id"] for task in schedule["tasks"]],
            [task["task_id"] for task in source["tasks"]],
        )
        self.assertEqual(
            schedule["secondary_tasks"][0]["duration_minutes"],
            source["secondary_tasks"][0]["duration_minutes"],
        )
        self.assertTrue(all(task.get("clock") for task in schedule["tasks"]))
        self.assertTrue(all(task.get("clock") for task in schedule["secondary_tasks"]))
        self.assertIsNone(
            next(task for task in schedule["tasks"] if task["task_type"] == "flexible")[
                "fixed_start"
            ]
        )
        self.assertLessEqual(
            schedule["secondary_tasks"][0]["clock"].split(" - ")[1],
            "10:00",
        )
        self.assertEqual(
            source["tasks"][0]["schedule_order"],
            next(
                task["schedule_order"]
                for task in schedule["tasks"]
                if task["task_id"] == source["tasks"][0]["task_id"]
            ),
        )

    def test_fixed_anchor_conflicts_are_reported_while_other_tasks_are_solved(self):
        source = create_week(fixed_conflict=True)
        result = optimize_schedule(source, time_limit=5)
        schedule = result["optimized_schedule"]
        self.assertIn(result["report"]["solver_status"], ("OPTIMAL", "FEASIBLE"))
        self.assertEqual(
            result["report"]["candidate_quality"],
            "solver_with_conflicts",
        )
        self.assertEqual(len(result["report"]["source_anchor_conflicts"]), 1)
        self.assertEqual(len(schedule["tasks"]), len(source["tasks"]))
        self.assertTrue(all(task.get("clock") for task in schedule["tasks"]))
        self.assertEqual(schedule["source_fingerprint"], source["source_fingerprint"])

    def test_secondary_overlaps_are_soft_and_duration_is_preserved(self):
        source = create_week()
        sleep = next(task for task in source["tasks"] if task["task_type"] == "sleep")
        sleep["duration_hours"] = 6
        sleep["original_duration_hours"] = 6
        sleep["clock"] = "03:00 - 09:00"
        source["secondary_tasks"][0]["window_end"] = "08:00"
        result = optimize_schedule(source, time_limit=5)
        schedule = result["optimized_schedule"]
        secondary = schedule["secondary_tasks"][0]
        self.assertIn(result["report"]["solver_status"], ("OPTIMAL", "FEASIBLE"))
        self.assertGreater(result["report"]["secondary_conflict_pair_count"], 0)
        self.assertEqual(secondary["duration_minutes"], 20)
        self.assertIsNone(secondary["fixed_start"])
        self.assertLessEqual(secondary["clock"].split(" - ")[1], "08:00")

    def test_secondary_placement_accounts_for_main_ending_next_day(self):
        schedule = {
            "tasks": [{
                "task_id": "OVERNIGHT-MAIN",
                "task_type": "flexible",
                "date": "2026-11-09",
                "clock": "05:30 - 06:30 (+1 day)",
            }],
            "secondary_tasks": [{
                "task_id": "NEXT-MORNING-SEC",
                "task_type": "secondary",
                "date": "2026-11-10",
                "period": "SÁNG",
                "window_start": "06:00",
                "window_end": "10:00",
                "duration_minutes": 15,
                "clock": "06:10 - 06:25",
                "suggested_clock": "06:10 - 06:25",
                "source_order": 1,
                "period_order": 1,
            }],
        }
        self.assertEqual(_secondary_conflict_pair_count(schedule), 1)
        _schedule_secondary_tasks(schedule)
        self.assertEqual(
            schedule["secondary_tasks"][0]["clock"],
            "06:30 - 06:45",
        )
        self.assertEqual(_secondary_conflict_pair_count(schedule), 0)

    def test_overfull_secondary_window_stays_visible_without_shortening(self):
        source = create_week()
        source["secondary_tasks"][0]["window_end"] = "06:10"
        source["secondary_tasks"][0]["window_label"] = "06:00-06:10"
        result = optimize_schedule(source, time_limit=5)
        schedule = result["optimized_schedule"]
        self.assertIn(result["report"]["solver_status"], ("OPTIMAL", "FEASIBLE"))
        self.assertEqual(result["report"]["secondary_window_violation_count"], 1)
        self.assertEqual(len(schedule["tasks"]), len(source["tasks"]))
        self.assertTrue(all(task.get("clock") for task in schedule["tasks"]))
        self.assertIsNone(schedule["secondary_tasks"][0]["fixed_start"])
        self.assertEqual(schedule["secondary_tasks"][0]["duration_minutes"], 20)
        self.assertEqual(schedule["source_fingerprint"], source["source_fingerprint"])

    def test_fallback_repairs_secondary_overlap_without_changing_source_duration(self):
        date = "2026-11-09"
        schedule = {
            "tasks": [{
                "task_id": "FIXED-MAIN",
                "task_type": "fixed",
                "date": date,
                "clock": "08:00 - 09:00",
            }],
            "secondary_tasks": [
                {
                    "task_id": f"SEC-{index}",
                    "task_type": "secondary",
                    "task_name": f"Routine {index}",
                    "date": date,
                    "period": "SÁNG",
                    "window_start": "06:00",
                    "window_end": "10:00",
                    "duration_minutes": 15,
                    "suggested_clock": "08:10 - 08:25",
                    "source_order": index,
                    "period_order": index,
                }
                for index in (1, 2)
            ],
        }

        _fallback_secondary_placement(schedule)

        self.assertEqual(_secondary_conflict_pair_count(schedule), 0)
        self.assertEqual(
            len({task["clock"] for task in schedule["secondary_tasks"]}),
            2,
        )
        self.assertTrue(all(
            task["duration_minutes"] == 15
            and "scheduled_duration_minutes" not in task
            for task in schedule["secondary_tasks"]
        ))

    def test_fallback_keeps_reduced_secondary_in_authorized_evening(self):
        date = "2026-11-09"
        task = {
            "task_id": "EVENING-REDUCED-ENTERTAINMENT",
            "task_type": "secondary",
            "task_name": "Giải trí",
            "date": date,
            "period": "CHIỀU",
            "window_start": "15:00",
            "window_end": "17:00",
            "duration_minutes": 30,
            "duration_hours": 0.5,
            "scheduled_duration_minutes": 15,
            "scheduled_duration_hours": 0.25,
            "suggested_clock": "16:30 - 17:00",
            "source_order": 1,
            "period_order": 1,
            "context_type": "routine",
        }
        schedule = {
            "tasks": [{
                "task_id": "AFTERNOON-MAIN",
                "task_type": "fixed",
                "date": date,
                "fixed_start": "15:00",
                "clock": "15:00 - 17:00",
            }],
            "secondary_tasks": [task],
        }

        _fallback_secondary_placement(schedule)

        self.assertEqual(task["placement_period"], "TỐI")
        self.assertEqual(task["clock"], "20:00 - 20:15")
        self.assertEqual(task["duration_minutes"], 30)
        self.assertEqual(task["scheduled_duration_minutes"], 15)
        self.assertEqual(_secondary_conflict_pair_count(schedule), 0)

    def test_evening_secondary_reduction_is_minimal_and_only_after_transfer(self):
        date = "2026-11-09"
        schedule = {
            "tasks": [
                {
                    "task_id": "AFTERNOON-MAIN",
                    "task_type": "fixed",
                    "date": date,
                    "fixed_start": "15:00",
                    "clock": "15:00 - 17:00",
                },
                {
                    "task_id": "EVENING-MAIN",
                    "task_type": "fixed",
                    "date": date,
                    "fixed_start": "17:00",
                    "clock": "17:00 - 22:30",
                },
            ],
            "secondary_tasks": [
                {
                    "task_id": "EVENING-ENTERTAINMENT",
                    "task_type": "secondary",
                    "task_name": "Giải trí",
                    "date": date,
                    "period": "CHIỀU",
                    "window_start": "15:00",
                    "window_end": "17:00",
                    "duration_minutes": 60,
                    "suggested_clock": "16:00 - 17:00",
                    "source_order": 1,
                    "period_order": 1,
                    "context_type": "rest",
                    "fixed_start": None,
                },
            ],
        }

        result = _schedule_secondary_tasks(
            schedule, allow_duration_reduction=True, time_limit=5
        )

        self.assertTrue(result["feasible"])
        task = schedule["secondary_tasks"][0]
        self.assertEqual(task["placement_period"], "TỐI")
        self.assertEqual(task["scheduled_duration_minutes"], 30)
        self.assertEqual(task["clock"], "22:30 - 23:00")
        self.assertEqual(result["reduced_secondary_minutes"], 30)

    def test_infeasible_main_constraints_still_return_preview(self):
        source = create_week()
        flexible = next(task for task in source["tasks"] if task["task_type"] == "flexible")
        flexible["duration_hours"] = 30
        flexible["original_duration_hours"] = 30
        result = optimize_schedule(source, time_limit=5)
        schedule = result["optimized_schedule"]
        optimized_flexible = next(
            task for task in schedule["tasks"] if task["task_id"] == flexible["task_id"]
        )
        self.assertEqual(result["report"]["solver_status"], "INFEASIBLE")
        self.assertEqual(result["report"]["candidate_quality"], "best_effort_preview")
        self.assertEqual(optimized_flexible["duration_hours"], 30)
        self.assertTrue(optimized_flexible["clock"])

    def test_input_is_not_mutated(self):
        source = create_week()
        before = copy.deepcopy(source)
        optimize_schedule(source, time_limit=5)
        self.assertEqual(source, before)


if __name__ == "__main__":
    unittest.main()
