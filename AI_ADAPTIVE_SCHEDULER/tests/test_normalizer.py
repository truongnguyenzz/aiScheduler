from datetime import date, timedelta
import unittest

from ingest_service.normalizer import NormalizationError, normalize_payload


def make_payload():
    monday = date(2026, 11, 9)
    ready_rows = []
    for offset in range(7):
        tasks = (
            [{"cell": f"O{16 + offset}", "name": "Task cố định"}]
            if offset == 0
            else []
        )
        ready_rows.append(
            {
                "row_number": 16 + offset,
                "date": (monday + timedelta(days=offset)).isoformat(),
                "tasks": tasks,
            }
        )
    return {
        "source_spreadsheet_id": "test-source-id",
        "source_sheet_name": "TUẦN",
        "ready_rows": ready_rows,
        "master_rows": [
            {
                "row_number": 3,
                "values": [
                    "SỰ NGHIỆP",
                    "SYSTEM",
                    "Task cố định",
                    "[Nội dung mẫu]",
                    1,
                    0,
                    1.5,
                    "",
                    "08:00",
                ],
            }
        ],
    }


class NormalizePayloadTests(unittest.TestCase):
    def test_normalizes_main_task_and_computes_clock(self):
        result = normalize_payload(make_payload())
        self.assertEqual(result["destination_tab"], "09/11 - 15/11/ 2026")
        self.assertEqual(result["task_count"], 1)
        row = result["rows"][0]
        self.assertEqual(row[0], "2026-11-09")
        self.assertEqual(row[1], "THỨ HAI")
        self.assertEqual(row[3], "⚙️")
        self.assertEqual(row[6], 1.5)
        self.assertEqual(row[7], "08:00 - 09:30")
        self.assertEqual(row[8], "RED")
        self.assertTrue(row[9].startswith("ADP-"))
        self.assertIn("-> Nội dung mẫu", row[5])

    def test_nonzero_gi_overrides_class_color(self):
        payload = make_payload()
        payload["master_rows"][0]["values"][5] = 0.5
        result = normalize_payload(payload)
        self.assertEqual(result["rows"][0][8], "MAUVE")

    def test_fractional_hour_duration_preserves_seconds_in_clock(self):
        payload = make_payload()
        payload["master_rows"][0]["values"][6] = 1.67
        result = normalize_payload(payload)
        self.assertEqual(result["rows"][0][7], "08:00 - 09:40:12")

    def test_preserves_task_without_start_time_and_leaves_clock_blank(self):
        payload = make_payload()
        payload["master_rows"][0]["values"][8] = ""
        result = normalize_payload(payload)
        self.assertEqual(result["rows"][0][7], "")
        self.assertEqual(result["unassigned_clock_count"], 1)

    def test_rejects_duplicate_master_name(self):
        payload = make_payload()
        payload["master_rows"].append(
            {
                "row_number": 4,
                "values": ["SỰ NGHIỆP", "SYSTEM", "task   cố định", "", 1, 0, 1, "", "08:00"],
            }
        )
        with self.assertRaisesRegex(NormalizationError, "Duplicate normalized"):
            normalize_payload(payload)

    def test_rejects_unmatched_ready_task(self):
        payload = make_payload()
        payload["ready_rows"][0]["tasks"][0]["name"] = "Không có trong MASTER"
        with self.assertRaisesRegex(NormalizationError, "was not found"):
            normalize_payload(payload)

    def test_rejects_task_crossing_midnight(self):
        payload = make_payload()
        payload["master_rows"][0]["values"][8] = "23:00"
        with self.assertRaisesRegex(NormalizationError, "crosses midnight"):
            normalize_payload(payload)

    def test_internal_id_is_stable(self):
        payload = make_payload()
        first = normalize_payload(payload)["rows"][0][9]
        second = normalize_payload(payload)["rows"][0][9]
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
