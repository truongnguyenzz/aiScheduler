# Scheduler JSON Transfer Schema

**Schema version:** 4  
**Format identifier:** `AI_ADAPTIVE_SCHEDULER_TRANSFER`  
**Scope:** Main Tasks, Secondary Tasks and generated `Ngủ đêm`  
**Status:** Schema implemented; local OR-Tools optimizer and independent VS Code validation implemented; Apps Script deployment and new VSIX live verification remain

This specification defines the JSON exported by the Apps Script web app and
optimized locally by OR-Tools or manually reviewed in VS Code. New exports use schema v4; the VS Code
extension continues to accept legacy schema v2/v3 files. Secondary Tasks are
stored in a separate `secondary_tasks` array so Main Task ordering and sleep
invariants remain unchanged. The assistant does not call Apps Script. The
extension validates the editable draft before writing both database regions;
Calendar import remains in Apps Script.

## 1. File kinds and lifecycle

The same schema is used in two states:

1. `kind: "normalized_input"` — exported by **Chuẩn hóa dữ liệu**. It contains
   normalized input records. Fixed tasks and sleep have their original `CLOCK`;
   flexible tasks have `clock: null`.
2. `kind: "optimized_schedule"` — the editable working copy under
   `transfers/optimized`. The local CP-SAT optimizer fills placements and
   records an adjacent `.optimizer-report.json`; optional assistant review or
   manual edits affect only this same draft. Every task must have a valid
   `clock` before import; only eligible flexible Main durations may be reduced
   within policy. The preview may retain overlap/window issues so they can be
   inspected. Structural/source-integrity failures block import; timing issues
   require an explicit user confirmation before writing and remain reported as
   errors if the user proceeds.

The optimizer and assistant must preserve `source_fingerprint` and all immutable source
fields. The VS Code extension compares the optimized draft to the local
`normalized_input`; it does not calculate the fingerprint or compare it to the
live Sheet. It independently validates the schedule before direct import.
The Apps Script web app exports normalized input but does not accept optimized
JSON; optimized drafts are imported through the VS Code extension.

Never edit the source Sheet from the optimization step. Never overwrite the
downloaded `normalized_input`; save/revise the optimized draft separately.

## 2. Top-level fields

| Field | Type | Meaning |
|---|---|---|
| `format` | string | Must equal `AI_ADAPTIVE_SCHEDULER_TRANSFER`. |
| `schema_version` | integer | New exports use `4`; the extension also accepts legacy `2` and `3`. |
| `kind` | string | `normalized_input` or `optimized_schedule`. |
| `source` | object | Original workbook/tab and destination-week identity. |
| `schedule_settings` | object | Default start, inter-task break, and sleep configuration used for this export. |
| `tasks` | array | Every Main Task for the week plus exactly one generated sleep task per date. |
| `secondary_tasks` | array | All selected Secondary Tasks except `Ngủ khuya`; present in v4 and separate from Main ordering. |
| `scheduling_warnings` | array of strings | Optional advisory notes from Apps Script. An unschedulable preview can still be exported; suggested/fallback clocks may overlap. |
| `source_fingerprint` | string | Exported source marker. Preserve exactly; the VS Code direct import does not recompute it. |

Scheduling warnings are informational and do not invalidate normalization or
block JSON download. They are excluded from `source_fingerprint`. The Apps Script
preview displays overlapping blocks, but will not write a warning-bearing
schedule directly to Scheduler Database; use the JSON workflow to adjust it.

`source` contains:

| Field | Type | Meaning |
|---|---|---|
| `spreadsheet_id` | string | Source workbook ID. |
| `spreadsheet_title` | string | Source workbook title. |
| `source_tab` | string | Main Task source tab, currently `TUẦN`. |
| `destination_tab` | string | Scheduler Database tab for the week. |
| `week_start` | `YYYY-MM-DD` | First date, Monday. |
| `week_end` | `YYYY-MM-DD` | Last date, Sunday. |

`schedule_settings` contains:

| Field | Type | Meaning |
|---|---|---|
| `defaultStartTime` | `HH:mm` | Beginning of the flexible-task scheduling window. |
| `defaultStartMinutes` | integer | The same start expressed as minutes after midnight. Do not modify. |
| `breakMinutes` | integer | Configured minimum break applied around flexible Main Tasks; not a Secondary Task rule. |
| `sleepStartTime` | `HH:mm` | Fixed start time of the generated sleep block. |
| `sleepStartMinutes` | integer | The same sleep start expressed as minutes after midnight. Do not modify. |
| `sleepDurationHours` | number | Fixed sleep duration. |

## 3. Task fields

Each task has:

| Field | Type | Meaning / permission |
|---|---|---|
| `task_id` | string | Stable task identifier. Immutable and unique in the week. |
| `date` | `YYYY-MM-DD` | Source date. Immutable. |
| `weekday` | string | Vietnamese weekday matching `date`. Immutable. |
| `source_order` | integer | Original READY order. Immutable; never renumber. |
| `schedule_order` | integer | Final within-day order, sequential from 1. May be optimized. |
| `task_type` | string | `fixed`, `flexible`, or `sleep`. Immutable. |
| `task_name` | string | Display/source name. Immutable. |
| `category` | string | v3 Main Task: inherited GROUP CLASS / CATEGORY from MASTER A. Immutable. |
| `class` | string | v3 Main Task: CLASS from MASTER B. Immutable. |
| `gi` | number | v3 Main Task: numeric GI from MASTER F. Immutable. |
| `icon` | string | Main Task: derived from `category` and `class`; generated sleep task: always `🌙`. Immutable. |
| `description` | string | Source-derived description, including CATEGORY and CLASS. Immutable. The final CLOCK is added to the Scheduler Database DESCRIPTION only at approved import. |
| `duration_hours` | number | Duration to schedule. Fixed/sleep are immutable. Flexible tasks may only be reduced within policy; never increase. |
| `original_duration_hours` | number | Source duration. Immutable. |
| `fixed_start` | `HH:mm` or `null` | Required field. Fixed Start Time for `fixed`, configured sleep start for `sleep`, `null` for `flexible`. Immutable. |
| `clock` | string or `null` | Required field. `HH:mm - HH:mm`, optionally including the ASCII suffix `(+N day)`. `null` only for flexible tasks in input. |
| `color` | string | Existing mapped color; generated sleep must remain `GRAY`. Immutable. |
| `source` | object | Source traceability. Immutable. |

Main task `source` is `{ "ready_cell": "O16", "master_row": 15 }`.
Generated sleep task `source` is `{ "generated": true }`.
The v3 `category`, `class`, and `gi` fields are required for every Main Task
and omitted for generated sleep tasks. Legacy v2 tasks may omit them.

### Secondary Task records (v4)

Each selected Secondary Task appears once in `secondary_tasks`; `Ngủ khuya` is
never exported. Its immutable source fields are:

| Field | Type | Meaning / permission |
|---|---|---|
| `task_id` | string | Stable `ADP-` ID derived from source workbook, date and source task cell. Immutable. |
| `date`, `weekday` | string | READY date and matching Vietnamese weekday. Immutable. |
| `source_order` | integer | Extracted order; immutable and not execution order. |
| `period_order` | integer | Temporary slot order within a BUỔI; immutable, not execution order. |
| `task_type` | string | Always `secondary`. |
| `task_name` | string | Source catalog name/code. Immutable. |
| `period` | string | `SÁNG`, `TRƯA`, `CHIỀU` or `TỐI`. Immutable. |
| `window_start`, `window_end` | `HH:mm` | Same-day allowed range. Immutable. |
| `window_label` | string | Normalized `HH:mm-HH:mm` value written to column P. Immutable. |
| `group`, `category`, `class` | string | Assignment group, catalog A category and catalog B class. Immutable. |
| `context_type` | string | Deterministic context label used for meal/hygiene placement. Immutable. |
| `icon` | string | Derived from the Secondary group mapping, then Main Task ICON fallback. Immutable. |
| `description` | string | Source description and traceable task details. Immutable. |
| `duration_minutes` | number | Selected minutes; immutable. |
| `duration_hours`, `original_duration_hours` | number | `duration_minutes / 60`; both immutable and equal. |
| `fixed_start` | null | Secondary Tasks have no fixed start. |
| `clock` | string or `null` | Null in normalized input; the optimized draft must set a valid time. |
| `placement_period`, `placement_reason` | optional string | Audit fields for an allowed move to `TỐI`; source `period` remains immutable. |
| `scheduled_duration_minutes`, `scheduled_duration_hours`, `duration_adjustment_reason` | optional number/string | Legacy compatibility fields. Current user policy prohibits Secondary duration reductions; do not create these fields in a new draft. |
| `suggested_clock` | string | Deterministic initial placement hint from Apps Script; immutable, not a hard assignment. |
| `color` | string | Always `MÀU HOA ANH ĐÀO`; immutable. |
| `source` | object | `{day_tab, task_cell, duration_cell, catalog_row}` traceability. Immutable. |

`secondary_tasks` has no `schedule_order`. Source `period_order` is immutable;
the database STT is rederived by date and actual placement period when writing.
An evening move or duration adjustment is recorded only in the optional
placement/scheduled-duration fields; source order, duration, period, window and
traceability fields stay unchanged.

Some normalized v4 JSON exports omit the nullable Secondary `fixed_start` and
`clock` properties. The VS Code validator treats those omitted input values as
`null`; the optimized draft must still set `fixed_start: null` and a valid
`clock`.

### ICON, COLOR, and DESCRIPTION mapping

The export resolves each READY task to its MASTER row before applying these
rules. CATEGORY is extracted from either `[Phân loại : CATEGORY]` or the legacy
`[Phân loại: [CATEGORY]]` annotation in the MASTER column A formula, including
formulas whose displayed value hides the annotation. The extracted category is
inherited across merged column A rows until another annotation is found. If
there is no annotation, the displayed column A group value is retained. CLASS
is read independently from column B.
CLASS and CATEGORY comparisons are trimmed, Unicode-normalized, and
case-insensitive. GI must be numeric; missing or invalid GI rejects
normalization rather than defaulting to zero.

ICON priority:

1. CLASS is `SYSTEM`, or CATEGORY contains `SYSTEM` → `⚙️`.
2. CATEGORY contains `BẢN SẮC` → `🎭`.
3. CATEGORY contains `ĐẠO ĐỒ` → `🧘`.
4. CATEGORY contains `SỰ NGHIỆP` → `💼`.
5. Otherwise → empty string.

COLOR priority:

1. GI is not zero → `MAUVE`.
2. GI is zero and CLASS is `SYSTEM` → `RED`.
3. GI is zero and CLASS is `KNOWLEDGES`, `CASUAL SKILLS`, or `NỘI TẠI` → `GREEN`.
4. GI is zero and CLASS is `DƯỠNG SINH`, `SIÊU SINH`, or `TRƯỜNG SINH` → `YELLOW`.
5. Otherwise → empty string (Calendar default).

ICON remains in the database's ICON column and is prefixed to the Calendar
summary/preview title. Generated `Ngủ đêm` tasks always use `🌙`; this default
does not change Main Task ICON classification. Main Task DESCRIPTION does not
include its ICON. Secondary DESCRIPTION includes ICON + task name, group,
category/class, duration, window and final CLOCK. The normalized JSON keeps
`clock` separate (`null` for unassigned flexible and Secondary tasks); on
approved Sheet import, the extension writes final `CLOCK` and `DURING` to both
database regions.

The Main Task DESCRIPTION includes `INTERNAL_TASK_ID`, `CATEGORY`, `CLASS`,
`CÔNG VIỆC`, `NỘI DUNG`, `PR`, `GI`, and `DURING`. Multi-line source content
keeps its line breaks. Schedule adjustments add `ORIGINAL_DURING` and
`SCHEDULE_ADJUSTMENT` when applicable.

## 4. Required semantic-first review

For every assistant-led schedule optimization, first scan the complete weekly
task list in the input: names, original durations, descriptions,
Secondary periods/windows, groups/context and the generated `Ngủ đêm` task.
Assess task purpose, importance, quality sensitivity to duration, suitable
time-of-day and task relationships before ranking time slots or applying
scheduling constraints.

The assistant should form a concise semantic priority/placement plan, noting
uncertainties, then use the constraints below to find the best feasible
schedule. Do not equate an `OPTIMAL` solver result with semantic optimality:
the deterministic solver does not understand task meaning unless priorities
are explicitly represented in its inputs/objective. Semantic priority does
not authorize edits to immutable source data or fixed starts.

## 5. Allowed assistant changes

When converting to `optimized_schedule`, the assistant may change only:

- `kind`: from `normalized_input` to `optimized_schedule`.
- `schedule_order`: choose a unique, contiguous sequence `1..N` per date.
- `clock`: fill flexible Main and Secondary tasks; keep fixed/sleep times unchanged.
- `duration_hours`: reduce a flexible task only when needed and within the
  limits below.

Secondary source `duration_minutes`, `duration_hours`, and
`original_duration_hours` are immutable and always equal to the selected source
duration. Under the current user-approved policy, Secondary duration must never
be reduced; do not set optional scheduled-duration fields or a duration
adjustment reason. The fields remain documented only for compatibility with
legacy drafts and must not be interpreted as permission to shorten a task.
`clock` must fit the source window unless accompanied by an allowed
`placement_period: "TỐI"` move. Only eligible personal-hygiene and entertainment
tasks are movable; source fields remain unchanged.

Everything else, including Main task count, task IDs, task names, category,
class, GI, icon, color, description, source order, original duration, source
coordinates, sleep records and `source_fingerprint`, must be preserved exactly.
Some older schema-v2 exports omit `fixed_start` entirely on flexible task
records. The VS Code importer treats that representation as equivalent to
`null` for comparison with the normalized schema; the optimized draft must use
`fixed_start: null` for flexible tasks.

### Duration limits

- Never increase a flexible Main Task's duration.
- If original duration is at most 1 hour, reduction is at most 0.25 hour
  (15 minutes).
- If original duration is over 1 hour, reduction is at most 0.5 hour
  (30 minutes).
- Never reduce fixed tasks or sleep.
- Prefer preserving every original duration. If a reduction is needed, explain
  why and report the before/after values.
- Main duration reductions are attempted when needed to address Main scheduling
  conflicts, within the caps above. The caps are maximum permissions, not
  targets; semantic assessment may recommend preserving a duration even when
  reduction would fit within the cap.
- Never reduce Secondary duration under the current user-approved policy. The
  existing optimizer/validator still has legacy support for such reductions;
  that code and its tests are not aligned with this rule yet.

## 6. Clock and ordering rules

- Clock is start-to-end in local `Asia/Ho_Chi_Minh` time. Use `HH:mm` when
  seconds are zero and `HH:mm:ss` when needed to represent decimal-hour
  durations exactly. Overnight endpoints use the ASCII `(+1 day)` suffix, e.g.
  `23:30 - 00:30 (+1 day)`. Readers also accept legacy `ngày` and corrupted
  `ng?y` suffixes already stored in the database.
- Main duration numbers must be valid under the app's decimal parser (at most
  two decimal places). Secondary durations are represented in minutes and may
  become repeating decimal hours. CLOCK must match each duration exactly to
  the second.
- Clock duration must exactly match `duration_hours` to the nearest second.
- Fixed task starts must equal `fixed_start`, and fixed durations must remain
  original.
- Sleep task must remain named `Ngủ đêm`, at the configured sleep start and
  duration, with color `GRAY` and icon `🌙`. The normalizer generates
  `Ngủ đêm hôm nay` as its default description, but Calendar import recognizes
  the sleep task by its name and permits any description.
- Every date must retain all source tasks and exactly one sleep task.
- Flexible Main Tasks stay within the configured default-start-to-next-day
  scheduling window.
- The validator classifies malformed/source-integrity failures separately from
  timing issues. Structural/source-integrity failures always block import.
  Overlaps, out-of-window placements and break violations remain visible and
  require a separate modal confirmation before writing; this does not remove
  or hide the timing issue.
  The configured break applies only between Main Tasks when at least one is
  flexible; it never applies to a pair involving a Secondary Task. Two fixed
  anchors cannot be moved to make a plan fit.
- A Secondary Task normally remains within its `window_start`/`window_end` and
  source period. `personal_hygiene` and entertainment may be moved to TỐI when
  the fixed Main schedule makes the source placement impractical. Breakfast
  must end by 10:00; hygiene retained in its source period must end before the
  first fixed Main Task of that date.
- Secondary Tasks have no hard spacing rule. Prefer a short 10-minute gap when
  feasible, but do not insert a configured break or treat the preference as a
  validator constraint.
- Keep READY `source_order` unchanged. The output database STT is generated
  from `schedule_order`.
- Task order is a preference subject to fixed anchors, feasibility and context.
  Do not silently drop tasks to improve the appearance of a schedule.

## 7. Example shape

The following is illustrative only; actual task IDs, dates, source coordinates,
fingerprint and source values come from the downloaded file.

```json
{
  "format": "AI_ADAPTIVE_SCHEDULER_TRANSFER",
  "schema_version": 4,
  "kind": "optimized_schedule",
  "source": {
    "spreadsheet_id": "SOURCE_ID",
    "spreadsheet_title": "Weekly plan",
    "source_tab": "TUẦN",
    "destination_tab": "09/11 - 15/11/ 2026",
    "week_start": "2026-11-09",
    "week_end": "2026-11-15"
  },
  "schedule_settings": {
    "defaultStartTime": "07:30",
    "defaultStartMinutes": 450,
    "breakMinutes": 15,
    "sleepStartTime": "03:00",
    "sleepStartMinutes": 180,
    "sleepDurationHours": 5
  },
  "source_fingerprint": "KEEP_THE_EXPORTED_SHA256",
  "tasks": [
    {
      "task_id": "ADP-EXAMPLE",
      "date": "2026-11-09",
      "weekday": "THỨ HAI",
      "source_order": 1,
      "schedule_order": 1,
      "task_type": "fixed",
      "task_name": "Example fixed task",
      "category": "SYSTEM",
      "class": "SYSTEM",
      "gi": 0,
      "icon": "⚙️",
      "description": "INTERNAL_TASK_ID: ADP-EXAMPLE\nCATEGORY: SYSTEM\nCLASS: SYSTEM\nDURING: 1",
      "duration_hours": 1,
      "original_duration_hours": 1,
      "fixed_start": "08:00",
      "clock": "08:00 - 09:00",
      "color": "RED",
      "source": { "ready_cell": "O16", "master_row": 15 }
    }
  ],
  "secondary_tasks": [
    {
      "task_id": "ADP-SECONDARY-EXAMPLE",
      "date": "2026-11-09",
      "weekday": "THỨ HAI",
      "source_order": 1,
      "period_order": 1,
      "task_type": "secondary",
      "task_name": "Vệ sinh sáng",
      "period": "SÁNG",
      "window_start": "06:00",
      "window_end": "10:00",
      "window_label": "06:00-10:00",
      "group": "VỆ SINH",
      "category": "BẢN SẮC",
      "class": "VỆ SINH",
      "context_type": "morning_hygiene",
      "icon": "💦",
      "description": "INTERNAL_TASK_ID: ADP-SECONDARY-EXAMPLE",
      "duration_minutes": 15,
      "duration_hours": 0.25,
      "original_duration_hours": 0.25,
      "fixed_start": null,
      "clock": "08:10 - 08:25",
      "suggested_clock": "08:10 - 08:25",
      "color": "MÀU HOA ANH ĐÀO",
      "source": {
        "day_tab": "THỨ HAI",
        "task_cell": "J4",
        "duration_cell": "K4",
        "catalog_row": 3
      }
    }
  ]
}
```

The example omits the remaining weekly tasks and sleep records and therefore
cannot be uploaded as a valid schedule.

## 8. VS Code validation and direct import

The local VS Code extension:

1. Re-reads the normalized input and optimized draft immediately before import.
2. Compares source metadata, settings, fingerprint value, and immutable task
   fields between the two files. It does not recompute a fingerprint or fetch
   the source workbook.
3. Accepts schema v2, v3 and v4. For v3/v4, it independently checks
   category/class/GI types and Main ICON/COLOR. For v4, it also validates
   Secondary source identity, immutable source duration, explicit evening
   placement/adjustment, group ICON/color, meal/hygiene constraints, and
   exemption from configured breaks. Timing issues are reported separately
   from blocking structural/source-integrity errors.
4. Maps Main tasks to `A:J` using `schedule_order`, and Secondary tasks to
   `M:Y` using the actual placement period/order.
5. Writes values only to the matching existing week tab in the fixed
   `Scheduler Database` workbook. It preserves headers and formatting, clears
   stale trailing values in both regions, then reads both regions back for
   verification.
6. Requires the user to click the preview panel's write button. If only timing
   issues remain, a separate modal confirmation is required. Saving or
   revising the draft never writes automatically.

The target ID is fixed in the extension and the workbook title and both exact
headers are checked. The extension cannot target Google Calendar.

## 9. Import ownership

The Apps Script web app exports `normalized_input` and handles its source
preview/write and Calendar flows for both database regions. It does not expose
an optimized JSON upload action. The VS Code extension is the sole
optimized-draft importer and validates the input/draft pair locally before a
user-approved write. Its checks are a structural/timing safety gate, not proof
that the schedule is contextually optimal; the user reviews reasons and
trade-offs before writing.
