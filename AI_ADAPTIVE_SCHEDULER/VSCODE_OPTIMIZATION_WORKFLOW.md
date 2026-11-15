# VS Code Main and Secondary Task Optimization Workflow

**Current scope:** Main Tasks, Secondary Tasks and one generated `Ngủ đêm` task per day.  
**Not in scope:** Automatic Gemini/API calls or writes to Google Calendar from the VS Code extension.

The configured `breakMinutes` rule applies only to Main Tasks. Secondary Tasks
are first placed at their full source duration in their source BUỔI.
Meaning-appropriate personal-hygiene and entertainment tasks may be moved to
TỐI when fixed Main Tasks block their source window. Secondary duration must
never be reduced under the current user-approved policy. Source duration fields
remain immutable, and Secondary Tasks never inherit a configured break. Source
layout and context rules are documented in `SECONDARY_TASK_DATA_SPEC.md`.

## Quy trình bắt buộc: ý nghĩa task trước, quy tắc sau

Khi người dùng yêu cầu AI lập hoặc tối ưu lịch, trợ lý phải hoàn tất semantic
review **trước khi** bắt đầu đặt task vào slot, tìm khoảng trống hoặc dùng
constraint để xếp hạng lựa chọn:

1. Quét toàn bộ Main Tasks, Secondary Tasks và `Ngủ đêm` trong đúng tuần.
   Nhận diện tên, duration gốc, description, period/window và thông tin
   phân loại/ngữ cảnh của từng task. Không bỏ sót task vì description dài,
   trùng buổi hay chưa có CLOCK.
2. Từ dữ liệu đó, đánh giá mục tiêu/ý nghĩa, mức quan trọng, độ nhạy chất
   lượng với duration, mức tập trung, thời điểm phù hợp và quan hệ giữa các
   task. Đánh dấu phần nào là dữ kiện, phần nào là suy luận/chưa chắc chắn.
3. Hình thành thứ tự ưu tiên ngữ nghĩa và phương án vị trí/thời lượng sơ bộ.
   Chỉ sau đó mới đối chiếu fixed start, windows, duration cap, break và các
   constraint khác.
4. Nếu constraint ngăn phương án có ý nghĩa tốt nhất, giải thích trade-off và
   đưa ra phương án thay thế; không nhồi lịch chỉ để lấp kín khoảng trống.

Với danh sách dài, trợ lý phải quét đầy đủ nhưng có thể báo cáo gọn: số task đã
đọc, các nhóm/ưu tiên chính, task quan trọng hoặc nhạy về duration, và phần
ngữ cảnh còn thiếu. Không cần chép lại toàn bộ description vào câu trả lời.

OR-Tools là solver tất định, không tự hiểu độ quan trọng hoặc chất lượng nội
dung. Nếu người dùng giao **AI** tối ưu, semantic review vẫn là bước bắt buộc
dù placement sau đó được tính bằng **Optimize locally**. Không được gọi
candidate là tối ưu về ý nghĩa nếu ưu tiên ngữ nghĩa chưa được solver mã hóa
hoặc trợ lý chưa đối chiếu lại.

## Current end-to-end flow

The workflow starts after **Chuẩn hóa dữ liệu** has completed in the Apps
Script web app and its `normalized_input` JSON has been downloaded.

1. Copy the downloaded JSON unchanged into `transfers\incoming`.
2. Install and activate the local VS Code extension once. Open the project
   folder in VS Code and run **Scheduler: Open Weekly Preview** from the
   Command Palette. Select the input JSON if VS Code does not select the active
   file automatically.
3. The extension creates one editable draft, if needed, at
   `transfers\optimized\<input-name>.optimized.json`. It copies the normalized
   package and changes only `kind` to `optimized_schedule`. If an existing
   draft has a different schema version, it preserves that file and creates a
   version-suffixed draft for the new input. It does not create a rendered
   preview file or write to Google.
4. In the preview panel, choose **Optimize locally**. OR-Tools fills the draft
   from the unchanged input and saves an `.optimizer-report.json` trace. The
   solver is deterministic, runs locally, and has no Google credentials or
   Google write path. The solver calculates placements but does not itself
   assess task meaning. If the task is AI-led, complete the semantic review
   above before invoking it, then compare its candidate with the semantic plan.
5. The preview panel renders a real seven-day, 24-hour time grid like a
   Calendar week view. The panel watches the same draft file and refreshes when
   it is saved. It displays Main and Secondary tasks with usable CLOCK values
   even when the draft has validation issues; overlapping blocks are placed
   side by side, and tasks without a usable CLOCK are not placed. Review fixed
   anchors, sleep, meal/hygiene timing, allowed windows and moved Secondary
   tasks against the semantic priorities. The optimizer preserves Secondary
   duration; if no position fits, the conflict remains visible for review.
6. If the arrangement is not acceptable, keep the input unchanged and review
   the optimizer report. Re-run the local optimizer after an authorized source
   or policy change; ask the assistant to assess contextual concerns. Any
   manual draft edits remain subject to the same validator. No Google write
   happens during these iterations.
7. Once the user is satisfied, select the write button in the preview panel.
   Structural/source-integrity failures keep it disabled. Timing-only issues
   leave the button available but require a separate modal confirmation before
   writing. The explicit action re-reads both files, validates the schedule again,
   replaces only task values in both Main `A:J` and Secondary `M:Y` regions in
   the matching week tab of the fixed Scheduler Database, preserves formatting,
   and reads both regions back for verification.
8. The VS Code extension does not write Calendar events. To continue the
   existing Calendar test flow, open the Apps Script web app, select the
   imported week in **Tuần trong Scheduler Database**, review the Calendar
   preview, then use its existing selected-date synchronization and confirmation
   steps.

The Apps Script web app no longer accepts optimized JSON. The VS Code extension
is the only optimized-draft import path and writes directly through the Google
Sheets API; it does not call a Gemini API or run a user-visible Python command.

## One-time VS Code and Google setup

1. Install `vscode_extension\ai-adaptive-scheduler-0.4.0.vsix` from VS Code's
   Extensions view (**Install from VSIX…**), then reload VS Code. To rebuild
   the package after source changes, run
   `npm exec --yes --package=@vscode/vsce -- vsce package --allow-missing-repository`
   from `vscode_extension`.
2. Install the local optimizer dependency once from the project root:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r .\vscode_extension\requirements-optimizer.txt
   ```

   The extension uses this workspace interpreter by default. Set
   `scheduler.optimizerPythonPath` in VS Code only if OR-Tools is installed in
   a different Python environment.
3. Complete the existing OAuth setup in `GOOGLE_ACCESS_SETUP.md` once. The
   extension reuses `credentials.json` and the refresh token in
   `%LOCALAPPDATA%\AI_Adaptive_SCHEDULER`; it never copies credentials into the
   workspace or prints them. With a valid saved Sheets scope and refresh token,
   imports do not prompt for consent or require a manually run Python command
   on each use. If Google access is revoked or the token lacks the scope, an
   authorization repair is needed once before importing again.
4. The extension's target workbook ID is fixed in code to
   `1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM`; it also checks the workbook
   title `Scheduler Database`, requires the selected week tab to exist, and
   refuses mismatched headers. It cannot target Google Calendar.

## Reusable assistant prompt

Replace `[INPUT_PATH]` with the normalized file under `transfers\incoming` and
`[DRAFT_PATH]` with the matching draft path shown in the preview panel.

```text
Bạn là trợ lý tối ưu lịch toàn diện Main Tasks và Secondary Tasks của dự án
AI ADAPTIVE SCHEDULER.

Đầu vào bất biến: [INPUT_PATH] (kind="normalized_input").
Bản nháp duy nhất cần chỉnh: [DRAFT_PATH] (kind="optimized_schedule").
Nếu bản nháp chưa có nội dung lịch, dùng input làm nguồn và cập nhật bản nháp.
Không tạo thêm file optimized/preview khác, không sửa input, không ghi Google.

TRÌNH TỰ BẮT BUỘC — Ý NGHĨA TRƯỚC, RULE SAU:
1. Mở đúng input/draft; chỉ tham khảo schema ở mức cần để đọc đúng các field.
   Quét toàn bộ danh sách Main Tasks, Secondary Tasks và Ngủ đêm trong input:
   task_name, original duration, description, period/window, category/class/
   group/context và thông tin nguồn. Không bắt đầu bằng cách liệt kê hard
   constraints, tìm khoảng trống hoặc xếp task theo slot.
2. Đánh giá mục tiêu, ý nghĩa, mức quan trọng, yêu cầu tập trung, độ nhạy chất
   lượng theo duration, thời điểm/ngữ cảnh phù hợp và quan hệ giữa các task.
   Phân biệt dữ kiện với suy luận; không tự gán ý nghĩa nếu dữ liệu thiếu.
3. Tạo semantic plan sơ bộ: task nào cần bảo vệ duration, task nào có thể linh
   hoạt, thời điểm/buổi và thứ tự phù hợp. Báo gọn độ bao phủ và các điểm chưa
   rõ; không cần lặp nguyên văn mọi description nếu danh sách dài.

Sau semantic scan, đọc đầy đủ các tài liệu để áp dụng policy và xác nhận giới
hạn cho phép:
- PROJECT_CONTEXT.md
- QUY_TAC_LAP_LICH.md
- CHUẨN HOÁ DATABASE.md
- SCHEDULER_TRANSFER_SCHEMA.md
- SECONDARY_TASK_DATA_SPEC.md
- WEEKLY_SHEET_TO_CALENDAR_FLOW.md
- VSCODE_OPTIMIZATION_WORKFLOW.md

4. Sau semantic plan và khi đã đọc policy, mới kiểm tra các rule, fixed start,
   windows, duration cap, break và khả năng solver. Nếu phải đổi phương án vì
   constraint, giải thích task/ý nghĩa nào bị ảnh hưởng và nêu trade-off.

Không thêm, bỏ, nhân đôi hoặc đổi task ID, ngày, weekday, source_order, tên,
mô tả, category, class, gi, icon, màu, source, original_duration_hours,
fixed_start, schedule_settings, source_fingerprint, hoặc bất kỳ trường bất
biến nào trong hai arrays.

Chỉ thay:
- Main: schedule_order, clock; duration_hours của flexible Main chỉ khi thật
  cần và đúng cap trong SCHEDULER_TRANSFER_SCHEMA.md.
- Secondary: clock; placement_period/placement_reason chỉ cho vệ sinh cá nhân
  hoặc giải trí chuyển TỐI theo ngữ cảnh. Tuyệt đối không đổi
  duration_minutes, duration_hours, period, window, period_order, source data
  hoặc tạo scheduled-duration adjustment.

Giữ fixed Main và Ngủ đêm đúng start/duration. Flexible Main phải ở trong
scheduling window và chịu breakMinutes giữa Main Tasks. Giữ nguyên duration
không đổi duration Secondary, không áp dụng breakMinutes cho Secondary; xếp
trong window/BUỔI và tránh overlap với Main/Secondary/sleep khi có thể. Nếu bị
lịch Main cố định chặn, chỉ task đủ điều kiện vệ sinh cá nhân/giải trí được
thử chuyển TỐI và vẫn giữ nguyên duration. Nếu vẫn còn xung đột, giữ task và
CLOCK để preview thấy lỗi. Chỉ giảm duration Main khi semantic review xác định
có thể chấp nhận và trong giới hạn quy định. Các quy tắc thời gian được xét
sau semantic review:
vệ sinh sáng kết thúc trước Main Task cố định đầu tiên; AUS (ăn sáng) kết thúc
không muộn hơn 10:00. Không lấy source_order/period_order hay vị trí J/L/N/P
làm thứ tự thực hiện.

Đánh giá vị trí/thời lượng dựa trên ý nghĩa task, kết quả mong muốn, yêu cầu
chất lượng, hành vi con người, chuẩn bị và quan hệ giữa Main/Secondary. Cân
nhắc bữa ăn, vệ sinh, vận động, nghỉ ngơi và năng lượng trong ngày. Khoảng đệm
ngắn là ưu tiên mềm, không phải break cứng; có thể xếp sát nhau nếu hợp lý.
Giữ source_order như ưu tiên mềm; giải thích đảo thứ tự và mọi Main duration
reduction. Không biến suy luận thành hard constraint mới.

Nếu chưa tìm được lịch không có timing issue, vẫn giữ preview đầy đủ và báo
task/ngày/ràng buộc đang chặn. Lỗi cấu trúc/toàn vẹn không được ghi; nếu chỉ
còn timing issue, người dùng có thể chọn xác nhận ghi qua modal riêng. Không
được gọi candidate có cảnh báo là lịch hợp lệ. Trước khi kết thúc, kiểm tra
input/draft:
mọi task ID đúng một lần; metadata bất biến không đổi; Main schedule_order
liên tục và có đúng một Ngủ đêm/ngày; fixed/sleep không đổi; CLOCK khớp
duration; Secondary giữ nguyên duration nguồn và không có duration adjustment;
mọi
overlap/window violation đều phải được báo rõ; đúng breaks chỉ giữa Main Tasks.
Không tính lại hay thay source_fingerprint.

Không import vào Sheet hay Calendar. Tóm tắt thay đổi, trade-off, thời gian
trống có chủ đích, và nhắc tôi xem preview panel. Hãy chỉnh cùng bản nháp để
preview tự cập nhật; chờ tôi hài lòng và nhấn nút import.
```

## How to reason about a day

1. Read every task record across the week. Build a semantic inventory of names,
   original durations, descriptions, periods/windows, groups and task relations;
   include the generated sleep task. Do not start by treating the data as empty
   slots or by ranking hard constraints.
2. Assess each task's purpose, importance, quality sensitivity to duration,
   concentration needs, time-of-day suitability and relation to other tasks.
   Mark uncertain interpretations instead of inventing facts.
3. Draft a semantic priority/placement plan. Identify which task durations need
   protection and which sequences or time periods best support the task meaning.
4. Then build an absolute local timeline in `Asia/Ho_Chi_Minh`, apply fixed
   starts, windows, Main-only breaks and approved duration/move limits, and
   compare the feasible candidate with the semantic plan.
5. Keep Secondary at full source duration. If a fixed Main Task blocks it, try
   TỐI only for eligible personal-hygiene or entertainment tasks; do not reduce
   Secondary. Keep breakfast-by-10:00 and morning-hygiene-before-first-fixed-
   Main timing in view.
6. Place flexible Main tasks with `source_order` as a soft preference. Reduce
   their duration only when the semantic assessment supports it, only when
   needed and within the approved cap.
7. Consider useful transitions and avoid pointless idle gaps, but do not add a
   hard spacing rule between Secondary Tasks or between Main and Secondary.
   Recheck the whole week, overnight intervals, sleep, breaks, windows, order,
   durations and task IDs before saving the draft.

This reasoning process is context-aware, not deterministic and not guaranteed
to find a global optimum. The local solver does not understand task meaning on
its own. The assistant must review the candidate against the semantic plan; the
VS Code validator proves only implemented structural and timing rules.
Personal suitability remains subject to user review.

## Direct import behavior and safety

- The importer compares the optimized draft against the selected local
  `normalized_input`, preserving its source identity and task fields. It does
  not calculate or compare `source_fingerprint` against the live source Sheet.
  The fingerprint must remain unchanged, but is not used as a gate for this
  direct-write path.
- The import action re-reads the files and validates immediately before writing.
  Missing, duplicate, extra, or changed tasks; modified fixed anchors; invalid
  `CLOCK`; or invalid source/adjustment metadata always block the write.
  Overlaps, inadequate Main-only breaks, out-of-window placements and
  meal/hygiene timing issues require a separate modal confirmation; this does
  not claim that the schedule is conflict-free.
- The writer targets only the fixed Scheduler Database workbook. It does not
  create a missing tab. The selected tab must have exact Main `A:J` and
  Secondary `M:Y` headers.
- The writer places Main values in `A2:J` and Secondary values in `M2:Y`,
  including ICON, final CLOCK, duration and color. The Calendar preview
  prefixes ICON to the display title.
- It clears stale trailing values in both regions when the new schedule has
  fewer rows. Header cells and formatting are preserved. Both regions are read
  back for verification.
- This is a snapshot of the exported input. If the source Sheet changes after
  normalization, export a fresh normalized JSON and start a new draft.
- A user click in the preview panel is the final write approval. The extension
  never imports automatically when the assistant saves or revises the draft.
- If import fails, the panel shows the error and the file remains available for
  correction. No Calendar event is modified by this extension.

## Failure handling

- **Invalid JSON/schema:** fix the draft structure; never weaken validation.
- **Input file changed while preview is open:** reopen the preview using the
  intended input package; do not make the importer accept a modified input.
- **Missing/duplicate task or changed immutable field:** rebuild only the draft
  from the untouched normalized input and reapply the schedule.
- **Overlap, break, window, or meal/hygiene timing issue:** revise the same
  draft where possible. If deliberately proceeding with a timing issue, review
  it and confirm the explicit modal; malformed clocks and source-integrity
  errors remain blocking.
- **No conflict-free schedule:** keep the complete candidate visible and report
  the blocking intervals/tasks. Structural/source-integrity failures block
  writing; timing-only issues may be written only after the user's explicit
  modal confirmation. Never import a partial or structurally invalid schedule.
- **OAuth or Sheets API error:** keep credentials out of chat/logs; repair the
  one-time OAuth setup and retry only after the API reports a clear failure.

## Current limitation and roadmap

The pilot covers Main Tasks, Secondary Tasks and generated `Ngủ đêm`. CP-SAT
proposes placements, the JavaScript validator independently checks them, and
the weekly preview exposes even invalid candidates. When asked to optimize, the
assistant must first scan all tasks and assess meaning/importance, then compare
the solver's candidate with that assessment. The solver itself does not
calculate semantic quality. No Gemini API is called. The solver report
distinguishes a proven optimum from a feasible incumbent or an infeasible
best-effort preview. The validator proves implemented structural and timing
rules, not contextual optimality. Structural errors block writing; timing
issues require explicit confirmation.
