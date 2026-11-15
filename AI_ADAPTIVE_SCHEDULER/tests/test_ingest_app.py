import hashlib
import hmac
import json
import os
import time
import unittest
from unittest.mock import patch

from ingest_service.app import app
import ingest_service.app as ingest_app
from tests.test_normalizer import make_payload


SECRET = "local-test-secret"


def signed_headers(body: bytes, timestamp: int | None = None) -> dict[str, str]:
    sent_at = str(timestamp if timestamp is not None else int(time.time()))
    nonce = "test-run-nonce"
    signed_content = sent_at.encode() + b"\n" + nonce.encode() + b"\n" + body
    signature = hmac.new(
        SECRET.encode(), signed_content, hashlib.sha256
    ).hexdigest()
    return {
        "X-Scheduler-Timestamp": sent_at,
        "X-Scheduler-Nonce": nonce,
        "X-Scheduler-Signature": signature,
        "Content-Type": "application/json",
    }


class IngestEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.secret_patch = patch.dict(os.environ, {"INGEST_HMAC_SECRET": SECRET})
        self.secret_patch.start()
        self.allowlist_patch = patch.object(
            ingest_app, "ALLOWED_SOURCE_IDS", {"test-source-id"}
        )
        self.allowlist_patch.start()

    def tearDown(self):
        self.allowlist_patch.stop()
        self.secret_patch.stop()

    def test_health_is_available(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_preview_requires_valid_signature(self):
        payload = make_payload()
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        response = self.client.post(
            "/v1/normalize?mode=preview",
            data=body,
            headers=signed_headers(body),
        )
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["status"], "preview")
        self.assertEqual(result["destination_tab"], "09/11 - 15/11/ 2026")
        self.assertEqual(result["task_count"], 1)

    def test_rejects_bad_signature(self):
        body = json.dumps(make_payload()).encode()
        headers = signed_headers(body)
        headers["X-Scheduler-Signature"] = "0" * 64
        response = self.client.post(
            "/v1/normalize?mode=preview", data=body, headers=headers
        )
        self.assertEqual(response.status_code, 401)

    def test_rejects_expired_request(self):
        body = json.dumps(make_payload()).encode()
        old_timestamp = int(time.time()) - 600
        response = self.client.post(
            "/v1/normalize?mode=preview",
            data=body,
            headers=signed_headers(body, timestamp=old_timestamp),
        )
        self.assertEqual(response.status_code, 401)

    def test_rejects_unallowlisted_source(self):
        payload = make_payload()
        payload["source_spreadsheet_id"] = "other-source"
        body = json.dumps(payload).encode()
        response = self.client.post(
            "/v1/normalize?mode=preview",
            data=body,
            headers=signed_headers(body),
        )
        self.assertEqual(response.status_code, 403)

    def test_rejects_unknown_mode(self):
        body = json.dumps(make_payload()).encode()
        response = self.client.post(
            "/v1/normalize?mode=unexpected",
            data=body,
            headers=signed_headers(body),
        )
        self.assertEqual(response.status_code, 400)

    def test_commit_writes_the_validated_week_snapshot(self):
        body = json.dumps(make_payload(), ensure_ascii=False).encode("utf-8")
        with (
            patch.object(ingest_app, "DESTINATION_SPREADSHEET_ID", "test-database"),
            patch.object(ingest_app, "_sheets_service") as service_factory,
            patch.object(
                ingest_app,
                "_destination_tab",
                return_value=(123, "09/11 - 15/11/ 2026"),
            ),
            patch.object(ingest_app, "_write_snapshot") as write_snapshot,
        ):
            response = self.client.post(
                "/v1/normalize?mode=commit",
                data=body,
                headers=signed_headers(body),
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "written")
        self.assertEqual(response.get_json()["task_count"], 1)
        write_snapshot.assert_called_once()
        written_rows = write_snapshot.call_args.args[2]
        self.assertEqual(len(written_rows), 1)
        service_factory.assert_called_once()


if __name__ == "__main__":
    unittest.main()
