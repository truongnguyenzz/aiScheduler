# Local Schedule Optimizer

## Status and purpose

**Implemented:** 2026-11-14; semantic-placement and timing-confirmation update
under verification. The VS Code Weekly Schedule Preview can invoke a
local Google OR-Tools CP-SAT optimizer. The optimizer computes placements; the
existing JavaScript validator remains an independent safety gate. No optimizer
code reads Google credentials or writes Google Sheets or Calendar.

The optimizer is deliberately a local library dependency, not a copied
scheduling application or a second solver service. It receives one normalized
JSON document on standard input and returns a complete optimized draft and
metrics on standard output.

## Runtime and operation

- Engine: Google OR-Tools CP-SAT, pinned by
  `vscode_extension\requirements-optimizer.txt`.
- Python: the workspace `.venv` is preferred. Set VS Code setting
  `scheduler.optimizerPythonPath` only when another interpreter is required.
- Search is single-worker with a fixed seed; each CP-SAT phase is limited to
  five seconds and the extension enforces a 45-second process limit.
- Run the one-time setup from the project root:

  ```powershell
  .\.venv\Scripts\python.exe -m pip install -r .\vscode_extension\requirements-optimizer.txt
  ```

- In **Scheduler: Open Weekly Preview**, choose **Optimize locally**. The
  optimizer starts only on this explicit action; opening or refreshing preview
  never starts a solve.
- It reads the unchanged `normalized_input`, writes only the local
  `optimized_schedule` draft, and creates a neighboring
  `.optimizer-report.json` audit file. No network access is used by the solve.

## Required semantic-first review for AI-led scheduling

When the user asks the assistant to arrange or optimize a schedule, the
assistant must first scan the complete weekly task list: task names, original
durations, descriptions, Secondary periods/windows, groups/context and the
generated sleep task. It then assesses purpose, importance, quality sensitivity
to duration, suitable time of day and relationships between tasks. Only after
that review should it apply scheduling rules and compare candidate placements.

This is the priority of the **planning goal**: meaningful, quality-aware
placement comes before mechanical slot filling and compactness. It does not
permit changing immutable source fields, fixed starts or task identity. If the
best semantic placement conflicts with a timing rule, the assistant must show
the trade-off and use the user's approved confirmation path where applicable.

CP-SAT does not read task meaning or understand quality. It currently uses
deterministic time constraints, coded context targets and numerical costs.
Unless semantic priorities are represented in solver inputs, the assistant
must review the resulting candidate against its semantic assessment and must
not describe a solver `OPTIMAL` status as semantic optimality.

## Scheduling model

### Hard constraints

- Preserve every Main Task, Secondary Task, and generated `Ngủ đêm`; do not
  change task identities or immutable source fields.
- Keep fixed Main Tasks and sleep at their source/configured start and duration.
- Keep each flexible Main Task inside the configured daily scheduling window.
  Its duration may only be reduced, in 0.01-hour steps, by at most 0.25 hours
  when its original duration is at most 1 hour, or 0.5 hours otherwise.
- First solve Main Tasks with their original durations and attempt exact-
  duration Secondary placement. If the combined schedule cannot be placed,
  retry Main Tasks with the configured 15/30-minute caps, then retry Secondary
  placement at original durations.
- Secondary placement uses meaning-aware targets rather than source slot order.
  Breakfast remains in its source window and ends by 10:00. Morning hygiene
  remains before the first fixed Main Task unless moved under the permitted
  personal-hygiene evening exception.
- If full-duration placement is still impossible, only eligible
  personal-hygiene and entertainment tasks may move to TỐI (17:00–23:00).
  **Current user policy prohibits reducing Secondary duration.** Preserve all
  source durations and report any remaining conflict for preview/review.
- Enforce the configured break between Main Tasks whenever either task is
  flexible. Preserve the breakfast-by-10:00 and morning-hygiene-before-first-
  fixed-Main rules.
- Keep Main-to-Main overlaps and configured breaks as solver constraints.
  Compare task intervals on an absolute timeline across date boundaries, so an
  overnight Main Task constrains next-day Secondary placement and conflict
  reporting. If no feasible placement remains, preserve every task and produce
  a visible best-effort candidate.
- Never apply Main's configured break to Secondary Tasks. Keep fixed Main and
  sleep anchors unchanged, even when the source itself contains an overlap.
- Preserve `source_fingerprint`, the source snapshot, and all other immutable
  data. The solver does not adjust constraints to make a plan appear valid.

### Soft objectives (in priority order)

The following is the solver's **encoded numerical objective**, not the
assistant's ranking of task meaning or importance:

1. Keep original flexible Main durations whenever the exact Main + Secondary
   schedule can be completed; use the configured caps only after exact
   Secondary placement fails.
2. Minimize Main-to-Secondary conflicts.
3. Minimize deviations from Main Task source order.
4. Prefer earlier, compact Main placements and context-appropriate Secondary
   placements; evening moves and reductions are only enabled in later fallback
   phases.

`suggested_clock` and source order are preferences, not extra hard constraints.
The solver does not infer a new user preference or add a new hard time limit.

### Current implementation mismatch: Secondary duration

The current user-approved policy is to **never reduce Secondary Tasks**.
However, the implementation still contains a legacy evening-reduction fallback,
the validator accepts its scheduled-duration fields, and regression tests cover
that behavior. Until code/tests are updated, treat any candidate that reduces a
Secondary duration as nonconforming; do not write or import that adjustment.

## Infeasible and timeout behavior

- `OPTIMAL` and `FEASIBLE` produce a CP-SAT Main schedule and a complete
  Secondary placement when possible. The independent validator distinguishes
  structural/source-integrity failures (always block) from timing issues
  (require a separate explicit confirmation before write).
- `INFEASIBLE`, `UNKNOWN`, or a time limit produces a best-effort draft for
  diagnosis. It preserves all tasks and source durations; any scheduled
  Main duration adjustment must remain within the approved cap and be reviewed
  against task meaning. Secondary durations must remain unchanged under the
  current policy. Conflicts remain visible in the weekly grid.
- An input/schema/process failure is reported in the preview; it is not
  converted to a success-shaped schedule.
- Neither solver outcome imports to Google automatically. Calendar import is
  outside the VS Code extension.

## Audit and progress measures

For each explicit run, `.optimizer-report.json` records:

- solver name/version, `OPTIMAL`/`FEASIBLE`/`INFEASIBLE`/`UNKNOWN` status,
  candidate quality, solve time, objective/best bound where available;
- input SHA-256, source/output file names, and generation time;
- Main/Secondary counts, Main/Secondary duration-reduction and move counts,
  reduction-phase usage, Secondary window violations and overlapping pair
  counts; and
- the independent validator result and any validation errors.

The report contains no OAuth credentials. It is local trace data and is not
written to Sheets or Calendar.

## Change record

### 2026-11-14 — CP-SAT pilot integration and real-week preview trial

- Added the pinned OR-Tools dependency and a JSON-in/JSON-out local solver.
- Added the explicit **Optimize locally** action to Weekly Schedule Preview.
- Kept the existing validator and explicit Google write action separate.
- Restored the actual normalized snapshot
  `scheduler-input-2026-11-09 (7).json` from Downloads to
  `transfers\incoming` after the workspace copy was missing.
- The real snapshot contains 60 Main records (13 fixed, 40 flexible, 7 sleep)
  and 92 Secondary Tasks. The 5-second staged solve returned a feasible
  candidate in about 5 seconds, preserved all Main durations, and retained all
  Secondary durations/windows. It reports 34 overlap pairs and two pre-existing
  fixed-anchor conflicts (30 minutes each); the independent validator therefore
  blocks import. The overlap blocks remain available for visual review.
- No Google Sheets or Calendar writes were performed. The preview-only test is

### 2026-11-15 — Context-aware Secondary fallback and timing override

- Added a staged response to Main/Secondary conflicts: exact durations first,
  then flexible-Main reductions within the established caps, then eligible
  hygiene/entertainment moves to TỐI, followed only if needed by minimized
  evening Secondary reductions.
- Deterministic fallback placement now keeps every duration-reduced Secondary
  Task in an authorized TỐI placement. If no such placement exists, fallback
  fails explicitly instead of leaving a reduced task in its source period.
- Source Secondary fields stay immutable; `placement_period`,
  `placement_reason`, `scheduled_duration_minutes`, and
  `scheduled_duration_hours` record approved scheduling changes.
- Classified validator results into blocking structural/source-integrity
  errors and overridable timing issues. Writing with timing issues now requires
  a separate modal confirmation; no Google write was performed for this code
  change. The preview-only test is
  complete; extension packaging/install and any live write remain separate,
  unverified steps.

### 2026-11-15 — Rebuilt input (8) trial and fallback regression

- Rebuilt the local draft from the unchanged incoming JSON after a failed
  fallback experiment; no Sheet or Calendar write was made.
- The current saved candidate has 60 Main Tasks and 92 Secondary Tasks.
  Independent validation finds zero hard/source-integrity errors and zero
  Secondary-window violations, but still finds five timing overlaps.
- The run reduced 24 Main Tasks by 10.06 hours, adjusted 34 Secondary Tasks by
  539 minutes, and moved nine Secondary Tasks to TỐI. The 50% Secondary
  duration floor remains provisional, not user-confirmed. These reductions and
  the remaining overlaps require review; this is not a zero-error preview.
- Added a regression test ensuring fallback preserves source duration and
  keeps reduced Secondary placement in TỐI. Python optimizer tests (10) and
  JavaScript scheduler tests (13) pass.

### 2026-11-14 — New input (8) trial and overnight conflict correction

- Optimized `scheduler-input-2026-11-09 (8).json` into a complete local draft:
  60 Main Tasks (40 flexible) and 92 Secondary Tasks. The 5-second CP-SAT
  run returned `FEASIBLE` in about 5.1 seconds, kept every Main duration and
  every Secondary duration, and reported no source anchor or Secondary-window
  violations.
- Corrected conflict accounting and Secondary placement to use absolute time
  across dates. Added a regression test for a Main Task ending the following
  morning; its Secondary Task is now moved to the first non-overlapping time.
- Independent JavaScript validation reports 16 remaining overlap errors, all
  visible in the preview; the draft remains blocked from database writes.
  No Google Sheets or Calendar writes were performed.

### 2026-11-15 — Semantic-first policy clarification

- For every assistant-led optimization, scan all task names, durations,
  periods/windows and descriptions before using rules to rank placements.
- Assess meaning, importance, quality sensitivity and context first; then apply
  constraints and report trade-offs.
- A solver result is not proof of semantic quality. The assistant must compare
  its candidate with the semantic plan.
- The user's current policy prohibits Secondary duration reductions. The
  legacy solver fallback and its tests remain an implementation gap.
