# Google Apps Script Web App: Sheet → Database → Calendar

## What this pilot does

The web interface runs on Google Apps Script. It reads a weekly source
spreadsheet's `TUẦN` tab and its seven weekday tabs, normalizes Main and
Secondary Tasks, writes a confirmed snapshot to the fixed test
`Scheduler Database`, then previews and imports timed tasks to the test
Calendar. No Python web host, Cloud Run service, HMAC secret, or
service-account credential is required.

The source workbook is read only. The destination is fixed to the test workbook
ID in `apps_script_web/Code.gs`, and its title is checked before any write. The
Calendar is fixed by the exact test title `AI Scheduler API TEST`; the script
stops unless exactly one such Calendar is visible.

## Pilot resources

- Default source spreadsheet: `1S8ev72pAVVSWEruT7zPziOr954VyiLxPEkFL1sZB01I`
- Source tab: `TUẦN`
- Destination workbook: `Scheduler Database`
- Destination spreadsheet ID: `1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM`
- Calendar: `AI Scheduler API TEST`
- Time zone: `Asia/Ho_Chi_Minh`

The source ID field accepts a different weekly spreadsheet ID or its URL. The
source must have the same `TUẦN` layout described in `CHUẨN HOÁ DATABASE.md`.
Only the selected pilot test database and Calendar can be written by this
version.

## Create and deploy

1. Open [script.google.com](https://script.google.com/) while signed in to the
   Google account that can access all three test resources. Create a **new
   standalone Apps Script project**.
2. Replace `Code.gs` with `apps_script_web/Code.gs`.
3. Add an HTML file named `Index` and paste `apps_script_web/Index.html`.
   Set `APP_VERSION` at the top of `Code.gs` before each release; the deployed
   web app shows that value next to **Scheduler Control**.
4. Open **Project Settings**, set the project time zone to `Asia/Ho_Chi_Minh`,
   enable **Show "appsscript.json" manifest file in editor**, then replace the
   manifest contents with
   `apps_script_web/appsscript.json`.
5. Save, then choose **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Only myself**
6. Deploy, approve the requested Google Sheets and Calendar permissions, then
   open the web app URL.

Keep the deployment restricted to your account. Do not select a public access
option: the app runs with the deployer's Google permissions.

## Update an existing deployment

Saving changes in the Apps Script editor does not update an already deployed
web app. After copying the latest `Code.gs` and `Index.html`:

1. Save the project.
2. Choose **Deploy → Manage deployments**.
3. Edit the existing Web App deployment, select **New version**, and deploy.
   Keep the same access setting (**Only myself**).
4. Reload the Web App and confirm the version beside **Scheduler Control**
   matches `APP_VERSION` in the deployed `Code.gs`.

The Web App does not accept optimized JSON. Optimize and import drafts through
the VS Code extension.

## Use

1. Confirm the source spreadsheet ID/URL, then choose **Đọc và xem trước**.
   This step reads the source and does not write to either destination.
2. Review the week, task order, fixed/flexible start labels, and task rows. The
   preview shows the default flexible-day start (07:30), between-task break
   (15 minutes), and daily `Ngủ đêm` time (03:00 for 5 hours); these settings
   can be changed before preview. Results open in a seven-day, 24-hour calendar
   grid by default. Use **Switch** above the results to show the existing data
   table; press it again to return to the calendar. Overlapping blocks are
   displayed side by side in the grid.
3. For the existing direct workflow, choose **Ghi vào Scheduler Database** and
   confirm. The matching week tab is
   created if missing; an existing tab must have the exact expected headers.
   Re-running replaces only task values in `A:J` and `M:Y` for that tab and
   preserves its formatting and headers. Scheduling warnings remain visible in
   the preview but disable direct snapshot writing.
4. For the VS Code workflow, choose **Chuẩn hóa dữ liệu**. This only reads the
   source and creates a versioned JSON transfer package; it does not write the
   database. New exports use `schema_version: 4`, include Main Task
   classification and a separate `secondary_tasks` array. Flexible Main and
   Secondary task `clock` values are null; fixed-task and `Ngủ đêm` clocks
   remain populated and immutable. Secondary tasks retain duration and include
   `suggested_clock`. Scheduling warnings do not block JSON download.
5. Choose **Tải về JSON** and copy the unchanged package into
   `transfers\incoming`. In VS Code, use **Scheduler: Open Weekly Preview**.
   The local extension creates/reuses an editable `transfers\optimized` draft
   and displays a seven-day, 24-hour time grid. The assistant revises the same
   draft while the preview refreshes; no Google write occurs until the user
   selects the extension's explicit import button.
6. The extension independently validates the draft, writes only task values
   into the matching existing week tab of the fixed Scheduler Database, keeps
   headers/formatting, and reads the rows back for verification. It uses the
   existing local OAuth refresh token; Python is not manually run for each
   import. See `VSCODE_OPTIMIZATION_WORKFLOW.md` and
   `GOOGLE_ACCESS_SETUP.md`.
7. After a VS Code import, choose its week in **Tuần trong Scheduler Database**
   in this web app. The selector lists existing tabs with the required schema;
   this enables Calendar preview even though Apps Script did not write the tab.
8. Choose **Xem trước import Calendar**. Review create/update/unchanged/skip
   counts and the weekly time-grid simulation. Blocks use their task duration,
   overlap side-by-side, and continue in the next date column when crossing
   midnight. Hover over a block for date, source order, duration, and status.
9. Choose **Import vào Calendar test**. The app lists dates and weekdays from
   the written Scheduler Database tab, not from a fixed Monday-Sunday template.
   Select one or more dates and choose whether to delete Scheduler-managed
   events, create/update events, or both.
10. Choose **Bắt đầu đồng bộ** to scan the live test Calendar. Review the current
   Calendar events and the proposed create/update/delete actions, then confirm
   to apply. The app deletes only events tagged as managed by this Scheduler
   for the selected source dates; personal and untagged events are never
   deleted. With both options selected, managed events for those dates are
   deleted and recreated from the selected database rows.

## Time and import behavior

- `DURING` is read from MASTER column G in decimal hours.
- ICON is derived from MASTER A/B and stored in database column D; COLOR is
  derived from MASTER B/F and stored in column I. The original task name is
  unchanged. Calendar summaries and the VS Code calendar preview prefix the
  derived ICON; DESCRIPTION does not contain it.
- The normalized JSON DESCRIPTION includes CATEGORY and CLASS but keeps CLOCK
  in its own field. On approved VS Code import, the database DESCRIPTION is
  finalized with the scheduled CLOCK and DURING.
- Task sequence is read left to right from READY task columns
  `O,Q,S,U,W,Y,AA,AC,AE,AG,AI,AK`; `STT` preserves that source order per day.
- Tasks with MASTER column I (`Start Time`) and the daily `Ngủ đêm` event are
  protected time blocks during ordinary scheduling. Duplicate Start Times,
  overlaps between fixed blocks, or a fixed-task/sleep overlap are retained and
  shown in the preview with a warning instead of stopping preview.
- Flexible tasks are first fitted into gaps between protected blocks, within
  the configured default-start-to-next-day window. READY order is a preference:
  the scheduler minimizes ordering changes while preserving original durations
  whenever feasible. A valid schedule will not overlap fixed tasks, sleep, or
  other Main Tasks.
- Only if no full-duration schedule exists may flexible durations shrink, by at
  most 15 minutes for tasks up to 1 hour and 30 minutes for longer tasks. The
  scheduler minimizes total shrink first; fixed-task and sleep durations never
  change. If a valid schedule still cannot be found, preview places flexible
  tasks from the configured start in source order, keeps original durations,
  and displays overlaps. Warning-bearing snapshots cannot be written directly;
  normalized JSON remains downloadable for correction.
- Secondary Tasks are placed within each BUỔI window without applying Main
  Task break settings. If no free slot satisfies the window and context
  constraints, preview places the unchanged-duration task at a fallback time
  within its window so the collision is visible. This warning blocks direct
  snapshot writing but does not block JSON export.
- A reduced task's `DURING` is the scheduled duration, and its description
  records `ORIGINAL_DURING` and `SCHEDULE_ADJUSTMENT`. The preview labels the
  adjusted duration.
- The UI displays both scheduling parameters. The actual V3.2 configuration
  address has not been verified; do not treat these initial values as confirmed
  V3.2 settings. Change them and preview again if needed.
- One `Ngủ đêm` task is generated for each day, with default description
  `Ngủ đêm hôm nay`; Calendar import identifies it by task name and accepts
  any description. Its default start and duration are 03:00 and 5 hours.
  Configure these values in the UI. It is stored after that day's Main Tasks
  with the next STT, but acts as a protected interval that flexible tasks cannot
  overlap.
- Every task in the ordinary preview gets a `CLOCK`. Flexible tasks may cross
  midnight; `CLOCK` and Calendar end time use the actual date. A valid generated
  schedule has no task overlaps, while fallback previews deliberately preserve
  collisions for diagnosis.
- Calendar preview/import validates `STT` order and imports every task. An old
  database snapshot with blank `CLOCK` must be regenerated with the new code.
- Calendar sync date choices come from actual `NGÀY` values in the written
  database. Weekday labels are calculated from each date. The app scans current
  Calendar events for the selected dates and displays them before any changes.
- Delete is restricted to this app's tagged Scheduler events whose recorded
  source date is selected. It does not delete personal, untagged, or unrelated
  events. Select delete-only to clear managed events for a date; select both
  options to replace those managed events with the selected database snapshot.
- Hard intervals from neighboring dates are considered when they intersect a
  day's scheduling window. The scheduler tries not to cross protected intervals
  or overlap tasks from neighboring dates; fallback previews can show such
  conflicts rather than omitting a task.
- Calendar changes are limited to the Calendar titled `AI Scheduler API TEST`.
  Calendar access must be writable by the account deploying the app.
- New events without a mapped color use Calendar's default color. If a managed
  event later has no color mapping, its previous explicit color is preserved.
- An untagged event with the same task title and exact time blocks import rather
  than being silently duplicated; inspect that event manually.
- Source mapping supports Main Tasks and Secondary Tasks. Secondary Task
  source/placement rules are documented in `SECONDARY_TASK_DATA_SPEC.md`; those
  tasks do not use the Main Task break setting. Production resources and
  automated AI optimization remain outside this pilot.
- The VS Code assistant is used through a user-mediated JSON file workflow; the
  Apps Script does not call an AI API or receive VS Code context. No Gemini key
  is needed. The local extension validates direct Sheet imports; this web app
  handles source normalization, confirmed snapshots, and Calendar validation.
- Cross-midnight `CLOCK` values use the ASCII `(+1 day)` suffix. The Calendar
  reader also accepts legacy `(+1 ngày)` and corrupted `(+1 ng?y)` values so
  existing database rows remain readable.

## Local checks

The Apps Script services require Google authorization and cannot be fully
executed by the local Python tests. The project still runs its existing
normalizer and endpoint regression tests:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s .\tests -v
node .\tests\test_apps_script_web.js
```

The Apps Script files should also pass JavaScript syntax checks before copying
them into the Apps Script editor.
