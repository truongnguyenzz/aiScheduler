from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

from flask import Flask, jsonify, request
import google.auth
from google.auth.exceptions import GoogleAuthError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from ingest_service.normalizer import DATABASE_HEADERS, NormalizationError, normalize_payload


DESTINATION_SPREADSHEET_ID = os.environ.get("SCHEDULER_DATABASE_ID", "")
DESTINATION_SPREADSHEET_TITLE = "Scheduler Database"
ALLOWED_SOURCE_IDS = {
    item.strip()
    for item in os.environ.get("ALLOWED_SOURCE_SPREADSHEET_IDS", "").split(",")
    if item.strip()
}
MAX_CLOCK_SKEW_SECONDS = 300
MAX_REQUEST_BYTES = 1_000_000

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES


class RequestAuthenticationError(Exception):
    pass


def _verify_request(raw_body: bytes) -> None:
    secret = os.environ.get("INGEST_HMAC_SECRET", "")
    timestamp = request.headers.get("X-Scheduler-Timestamp", "")
    nonce = request.headers.get("X-Scheduler-Nonce", "")
    supplied_signature = request.headers.get("X-Scheduler-Signature", "")
    if not secret or not timestamp or not nonce or not supplied_signature:
        raise RequestAuthenticationError("Missing request authentication.")
    if len(nonce) > 128 or not nonce.isascii():
        raise RequestAuthenticationError("Invalid request nonce.")
    try:
        sent_at = int(timestamp)
    except ValueError as error:
        raise RequestAuthenticationError("Invalid request timestamp.") from error
    if abs(int(time.time()) - sent_at) > MAX_CLOCK_SKEW_SECONDS:
        raise RequestAuthenticationError("Request timestamp is outside allowed skew.")
    signed_content = timestamp.encode() + b"\n" + nonce.encode() + b"\n" + raw_body
    expected_signature = hmac.new(
        secret.encode("utf-8"), signed_content, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, supplied_signature.lower()):
        raise RequestAuthenticationError("Invalid request signature.")


def _sheets_service():
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def _destination_tab(sheets_service, tab_name: str) -> tuple[int, str]:
    spreadsheet = (
        sheets_service.spreadsheets()
        .get(
            spreadsheetId=DESTINATION_SPREADSHEET_ID,
            fields="properties(title),sheets(properties(sheetId,title,gridProperties(rowCount)))",
        )
        .execute()
    )
    title = spreadsheet.get("properties", {}).get("title")
    if title != DESTINATION_SPREADSHEET_TITLE:
        raise RuntimeError(
            f"Destination spreadsheet title mismatch: {title!r}."
        )
    matching = [
        sheet["properties"]
        for sheet in spreadsheet.get("sheets", [])
        if sheet["properties"].get("title") == tab_name
    ]
    if len(matching) > 1:
        raise RuntimeError(f"Multiple destination tabs named {tab_name!r}.")
    if matching:
        properties = matching[0]
        sheet_id = properties["sheetId"]
        header_values = (
            sheets_service.spreadsheets()
            .values()
            .get(
                spreadsheetId=DESTINATION_SPREADSHEET_ID,
                range=f"'{tab_name}'!A1:J1",
                valueRenderOption="FORMATTED_VALUE",
            )
            .execute()
            .get("values", [])
        )
        if not header_values or header_values[0] != DATABASE_HEADERS:
            raise RuntimeError(
                f"Destination tab {tab_name!r} has unexpected headers; "
                "refusing to overwrite it."
            )
        return sheet_id, tab_name

    created = (
        sheets_service.spreadsheets()
        .batchUpdate(
            spreadsheetId=DESTINATION_SPREADSHEET_ID,
            body={
                "requests": [
                    {"addSheet": {"properties": {"title": tab_name}}}
                ]
            },
        )
        .execute()
    )
    properties = created["replies"][0]["addSheet"]["properties"]
    sheet_id = properties["sheetId"]
    sheets_service.spreadsheets().values().update(
        spreadsheetId=DESTINATION_SPREADSHEET_ID,
        range=f"'{tab_name}'!A1:J1",
        valueInputOption="RAW",
        body={"values": [DATABASE_HEADERS]},
    ).execute()
    return sheet_id, tab_name


def _write_snapshot(sheets_service, tab_name: str, rows: list[list[Any]]) -> None:
    if not rows:
        raise RuntimeError("Refusing to write an empty weekly snapshot.")

    old_values = (
        sheets_service.spreadsheets()
        .values()
        .get(
            spreadsheetId=DESTINATION_SPREADSHEET_ID,
            range=f"'{tab_name}'!A2:J",
            valueRenderOption="UNFORMATTED_VALUE",
        )
        .execute()
        .get("values", [])
    )
    write_count = max(len(old_values), len(rows))
    padded_rows = rows + [[""] * len(DATABASE_HEADERS) for _ in range(write_count - len(rows))]
    sheets_service.spreadsheets().values().update(
        spreadsheetId=DESTINATION_SPREADSHEET_ID,
        range=f"'{tab_name}'!A2:J{write_count + 1}",
        valueInputOption="RAW",
        body={"values": padded_rows},
    ).execute()


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "Request payload exceeds the 1 MB limit."}), 413


@app.post("/v1/normalize")
def normalize():
    try:
        raw_body = request.get_data(cache=True)
        _verify_request(raw_body)
        payload = json.loads(raw_body)
        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be a JSON object."}), 400
        source_id = str(payload.get("source_spreadsheet_id", "")).strip()
        if not ALLOWED_SOURCE_IDS:
            return jsonify({"error": "Source allowlist is not configured."}), 503
        if source_id not in ALLOWED_SOURCE_IDS:
            return jsonify({"error": "Source spreadsheet is not allowed."}), 403
        result = normalize_payload(payload)
        mode = request.args.get("mode", "commit")
        if mode not in {"preview", "commit"}:
            return jsonify({"error": "mode must be 'preview' or 'commit'."}), 400
        if mode == "preview":
            return jsonify(
                {
                    "status": "preview",
                    "destination_tab": result["destination_tab"],
                    "task_count": result["task_count"],
                    "unassigned_clock_count": result["unassigned_clock_count"],
                    "headers": result["headers"],
                    "rows": result["rows"],
                }
            )
        if not DESTINATION_SPREADSHEET_ID:
            return jsonify({"error": "Destination is not configured."}), 503
        sheets_service = _sheets_service()
        _, tab_name = _destination_tab(sheets_service, result["destination_tab"])
        _write_snapshot(sheets_service, tab_name, result["rows"])
        return jsonify(
            {
                "status": "written",
                "destination_tab": tab_name,
                "task_count": result["task_count"],
                "unassigned_clock_count": result["unassigned_clock_count"],
            }
        )
    except RequestAuthenticationError as error:
        return jsonify({"error": str(error)}), 401
    except (NormalizationError, json.JSONDecodeError) as error:
        return jsonify({"error": str(error)}), 400
    except (GoogleAuthError, HttpError, OSError, RuntimeError) as error:
        app.logger.exception("Sheet normalization request failed.")
        return jsonify(
            {"error": "Google Sheets operation failed; check service logs."}
        ), 502
