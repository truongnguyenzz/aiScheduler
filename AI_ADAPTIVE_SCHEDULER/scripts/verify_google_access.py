from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import os
from pathlib import Path
import sys
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


ROOT = Path(__file__).resolve().parents[1]
AUTH_DIR = Path(os.environ["LOCALAPPDATA"]) / "AI_Adaptive_SCHEDULER"
CLIENT_FILE = AUTH_DIR / "credentials.json"
TOKEN_FILE = AUTH_DIR / ".google-token.json"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events",
]
TEST_TAB = "Access Test"
TEST_CALENDAR_MARKER = "test"


def get_credentials() -> Credentials:
    if not CLIENT_FILE.is_file():
        raise FileNotFoundError(
            f"Missing {CLIENT_FILE}. Follow GOOGLE_ACCESS_SETUP.md to create "
            "a Google OAuth Desktop client and save its JSON file there."
        )

    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    credentials = None
    if TOKEN_FILE.is_file():
        credentials = Credentials.from_authorized_user_file(
            str(TOKEN_FILE), SCOPES
        )

    if credentials and not credentials.has_scopes(SCOPES):
        credentials = None

    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())

    if not credentials or not credentials.valid:
        flow = InstalledAppFlow.from_client_secrets_file(
            str(CLIENT_FILE), SCOPES
        )
        credentials = flow.run_local_server(port=0)

    TOKEN_FILE.write_text(credentials.to_json(), encoding="utf-8")
    return credentials


def verify_sheet(service, spreadsheet_id: str) -> str:
    spreadsheet = (
        service.spreadsheets()
        .get(
            spreadsheetId=spreadsheet_id,
            fields="properties(title),sheets(properties(title))",
        )
        .execute()
    )
    title = spreadsheet["properties"]["title"]
    tab_names = [
        sheet["properties"]["title"] for sheet in spreadsheet.get("sheets", [])
    ]
    if TEST_TAB not in tab_names:
        raise ValueError(
            f"Test spreadsheet must contain a tab named {TEST_TAB!r}; "
            f"found: {tab_names}"
        )

    cell = f"'{TEST_TAB}'!A1"
    values_api = service.spreadsheets().values()
    before = (
        values_api.get(
            spreadsheetId=spreadsheet_id,
            range=cell,
            valueRenderOption="FORMULA",
        )
        .execute()
        .get("values", [])
    )
    if any(value != "" for row in before for value in row):
        raise ValueError(
            f"{cell} must be empty in the dedicated test spreadsheet; "
            "the script will not overwrite existing content."
        )

    marker = f"AI_SCHEDULER_ACCESS_TEST_{uuid4().hex}"
    write_started = False
    try:
        write_started = True
        values_api.update(
            spreadsheetId=spreadsheet_id,
            range=cell,
            valueInputOption="RAW",
            body={"values": [[marker]]},
        ).execute()
        values_api.update(
            spreadsheetId=spreadsheet_id,
            range=cell,
            valueInputOption="RAW",
            body={"values": [[marker + "_UPDATED"]]},
        ).execute()
        result = (
            values_api.get(spreadsheetId=spreadsheet_id, range=cell)
            .execute()
            .get("values", [])
        )
        if result != [[marker + "_UPDATED"]]:
            raise RuntimeError("The updated Sheet value did not match.")
    finally:
        if write_started:
            values_api.clear(
                spreadsheetId=spreadsheet_id,
                range=cell,
                body={},
            ).execute()

    print(f"Google Sheets: read and write verified for {title!r}; {cell} cleared.")
    return title


def verify_calendar(service, calendar_id: str, timezone_name: str) -> str:
    calendar = (
        service.calendarList()
        .get(calendarId=calendar_id)
        .execute()
    )
    summary = calendar.get("summary", "")
    access_role = calendar.get("accessRole", "")
    if TEST_CALENDAR_MARKER not in summary.casefold():
        raise ValueError(
            "Calendar test stopped: the target calendar name must include "
            "'test' (for example, 'AI Scheduler API TEST')."
        )
    if access_role not in {"owner", "writer"}:
        raise ValueError(
            f"Calendar test requires owner or writer access; got {access_role!r}."
        )

    timezone = ZoneInfo(timezone_name)
    start = datetime.now(timezone).replace(second=0, microsecond=0)
    start = start.replace(minute=0) + timedelta(days=2, hours=1)
    end = start + timedelta(minutes=5)
    marker = f"AI Scheduler API TEST {uuid4().hex[:12]}"
    event_id = None

    try:
        event = (
            service.events()
            .insert(
                calendarId=calendar_id,
                body={
                    "summary": marker,
                    "description": "Temporary API access verification event.",
                    "start": {
                        "dateTime": start.isoformat(),
                        "timeZone": timezone_name,
                    },
                    "end": {
                        "dateTime": end.isoformat(),
                        "timeZone": timezone_name,
                    },
                },
            )
            .execute()
        )
        event_id = event["id"]
        service.events().patch(
            calendarId=calendar_id,
            eventId=event_id,
            body={"summary": marker + " UPDATED"},
        ).execute()
        updated = (
            service.events()
            .get(calendarId=calendar_id, eventId=event_id)
            .execute()
        )
        if updated.get("summary") != marker + " UPDATED":
            raise RuntimeError("The updated Calendar event title did not match.")
    finally:
        if event_id:
            service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
            ).execute()

    print(
        "Google Calendar: read, create, update, and delete verified for "
        f"{summary!r}; temporary event removed."
    )
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verify Google Sheets and Calendar access using dedicated test "
            "resources. The script clears its test cell and deletes its event."
        )
    )
    parser.add_argument("--spreadsheet-id", required=True)
    parser.add_argument("--calendar-id", required=True)
    parser.add_argument("--timezone", default="Asia/Ho_Chi_Minh")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        ZoneInfo(args.timezone)
        credentials = get_credentials()
        sheets = build("sheets", "v4", credentials=credentials, cache_discovery=False)
        calendar = build(
            "calendar", "v3", credentials=credentials, cache_discovery=False
        )
        verify_sheet(sheets, args.spreadsheet_id)
        verify_calendar(calendar, args.calendar_id, args.timezone)
    except (
        FileNotFoundError,
        ValueError,
        HttpError,
        OSError,
        RuntimeError,
        ZoneInfoNotFoundError,
    ) as error:
        print(f"Google access verification failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
