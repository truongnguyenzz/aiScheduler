# Google Sheets and Calendar access check

This is a local, one-time access check. It does not connect to or write to the
official calendar unless you explicitly pass that calendar ID. Use a dedicated
test spreadsheet and a dedicated test calendar.

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or
   select a project.
2. In **APIs & Services → Library**, enable **Google Sheets API** and
   **Google Calendar API**.
3. In **Google Auth Platform** (or **APIs & Services → OAuth consent screen**),
   configure the app as **External** if prompted. During development, keep it
   in **Testing** and add your Google account as a test user.
4. Create an OAuth client with application type **Desktop app**.
5. Download its JSON file. Store it locally at
   `%LOCALAPPDATA%\AI_Adaptive_SCHEDULER\credentials.json` (usually
   `C:\Users\<your-user>\AppData\Local\AI_Adaptive_SCHEDULER\credentials.json`).
   In PowerShell, create the destination folder with:

   ```powershell
   New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\AI_Adaptive_SCHEDULER"
   ```

   Do not put credentials or tokens in this project folder, send them in chat,
   or commit them.

The script uses OAuth with the Google account you choose in the browser. The
first run opens Google's consent screen. The local refresh token is saved in
`%LOCALAPPDATA%\AI_Adaptive_SCHEDULER\.google-token.json`, outside the
OneDrive-synced project. Revoke the app's access from your Google Account
security settings when you no longer need it.

## 2. Create isolated test resources

1. Create a new, empty Google spreadsheet named `AI Scheduler API TEST`.
2. Rename one tab to `Access Test` and leave cell `A1` empty.
3. Create a separate Google Calendar named `AI Scheduler API TEST`.
4. Give the Google account used for OAuth **Make changes to events** access to
   that calendar. Do not use your primary calendar for this check.
5. Copy the spreadsheet ID from its URL. Copy the test calendar ID from
   **Calendar settings → Integrate calendar**.

The Sheets API scope grants read/write access to spreadsheets available to the
authorized account; Google does not offer a per-spreadsheet OAuth scope. The
Calendar scopes permit reading the calendar list and managing events, while the
script restricts its test to the calendar ID supplied on the command line and
refuses calendars whose name does not contain `test`.

## 3. Install and run

In PowerShell, from the project root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-google.txt
.\.venv\Scripts\python.exe .\scripts\verify_google_access.py --spreadsheet-id "YOUR_SPREADSHEET_ID" --calendar-id "YOUR_TEST_CALENDAR_ID"
```

Replace the two ID placeholders. Keep the quotes. The script:

- Reads the spreadsheet and confirms the `Access Test` tab exists.
- Requires `Access Test!A1` to be empty, writes and updates a temporary marker,
  verifies it, and clears the cell.
- Reads the calendar and requires its name to contain `test` and your access to
  be `owner` or `writer`.
- Creates a five-minute event two days ahead, updates its title, verifies the
  change, and deletes the temporary event.

It does not modify or delete existing Sheet content or Calendar events. If the
process is interrupted after a temporary event is created, remove the event
whose title begins `AI Scheduler API TEST` from the test calendar.

## 4. What counts as verified

Successful output for both services confirms the account authorized in the
browser can read and write the specified test resources. This verifies API
access from the local Python environment; it does not yet integrate the
project's scheduling data or authorize writes to production resources.

## Import sample tasks from the test Sheet to the test Calendar

After the sample rows are present in `Calendar Import Test`, run:

```powershell
.\.venv\Scripts\python.exe .\scripts\import_sample_to_test_calendar.py
```

The command reads rows from the existing `Calendar Import Test` tab and creates
or updates corresponding event blocks in the calendar named `AI Scheduler API
TEST`. It does not write to the Sheet, create tabs, delete Calendar events, or
access the real workbook/calendar. It validates all rows before importing,
checks task type and duration rules, includes the row's task fields in each
event description, and verifies the resulting Calendar events. Rerunning it
does not create duplicates. It ignores cancelled events and creates active
replacements when needed. Rows removed from the Sheet do not cause events to be
deleted; remove test events manually when finished. Events appear on the
`AI Scheduler API TEST` calendar at the date and times specified in the Sheet;
make sure that calendar is visible in the Google Calendar sidebar.

## VS Code Scheduler extension

The local extension uses the same OAuth files in
`%LOCALAPPDATA%\AI_Adaptive_SCHEDULER`:

- `credentials.json`
- `.google-token.json`

Authorize the Sheets scope once using the documented setup before the first
direct import. The extension refreshes the saved OAuth access token locally
when needed; it does not start Python, open a consent screen, or request a new
approval on every import. No credential or token is stored in the workspace.
If the Google account revokes access, the refresh token expires, or the saved
token lacks `https://www.googleapis.com/auth/spreadsheets`, repair authorization
once before retrying.

The extension is restricted in code to the Scheduler Database workbook ID and
requires an existing week tab with the exact database headers. Its Sheets API
scope can technically access other spreadsheets available to the Google
account, so keep the OAuth client/token local and never share them. Calendar
access and writes are not part of this extension.
