# Quy tắc chỉnh sửa và lập lịch

**Cập nhật:** 2026-11-15  
**Phạm vi:** Main Tasks, Secondary Tasks, `Ngủ đêm`, thời lượng, vị trí,
kiểm tra và quyền ghi lịch.  
**Trạng thái:** Tổng hợp chính sách người dùng đã chốt và đối chiếu với mã
nguồn. Đây là tài liệu theo dõi chính sách; chưa có thay đổi code nào được
thực hiện trong lần rà soát này.

> **Lưu ý:** Một số tài liệu và test cũ chưa khớp các lựa chọn mới. Mục
> “Khác biệt giữa chính sách và code hiện tại” ghi rõ các điểm đó. Không được
> hiểu việc ghi quy tắc ở đây là code đã được cập nhật.

## 1. Thứ tự ưu tiên khi AI lập lịch

### 1.1. Ưu tiên mục tiêu lập lịch

1. **Ý nghĩa, mức quan trọng và chất lượng cần đạt của từng task** là tiêu chí
   đầu tiên khi AI đánh giá lịch. AI phải hiểu danh sách công việc trước khi
   nghĩ đến việc lấp khoảng trống.
2. **Quy tắc và constraint lập lịch** được xét sau khi đã hình thành nhận định
   ngữ nghĩa. Chúng dùng để tìm phương án khả thi tốt nhất, chỉ ra trade-off
   hoặc xác định khi nào cần người dùng xác nhận bỏ qua lỗi thời gian.
3. Các ưu tiên mềm như giữ thứ tự nguồn, thời điểm gợi ý, khoảng đệm hoặc lịch
   gọn chỉ được dùng sau khi đã cân nhắc ý nghĩa task và quy tắc áp dụng.

Thứ tự này xác định cách phân tích và tối ưu mục tiêu; nó **không** cho phép
sửa task nguồn, làm sai dữ liệu, thay đổi Start Time cố định hoặc bỏ qua lỗi
cấu trúc. Các giới hạn toàn vẹn dữ liệu vẫn là cổng bảo vệ không được đổi
chác.

### 1.2. Quy trình phân tích bắt buộc

Khi được yêu cầu AI sắp xếp/tối ưu lịch, thực hiện theo thứ tự:

1. Đọc đúng cặp input–draft và quét **toàn bộ** task trong tuần trước khi phân
   tích khóa cứng: tên, duration gốc, description, period/window và thông tin
   phân loại/ngữ cảnh sẵn có. Bao gồm Main, Secondary và task `Ngủ đêm`; nếu
   nguồn thô có `Ngủ khuya`, nhận diện vai trò loại trừ nhưng không xếp nó như
   một Secondary.
2. Phân tích mục tiêu task, mức quan trọng, mức tập trung, độ nhạy chất lượng
   với thời lượng, thời điểm phù hợp và quan hệ giữa các task. Dữ kiện nguồn,
   suy luận và nội dung chưa biết phải được phân biệt.
3. Xác lập thứ tự ưu tiên ngữ nghĩa và phương án thời gian/duration sơ bộ.
   Duration gốc là dữ kiện và điểm xuất phát; mọi nhận định duration phải có
   lý do gắn với ý nghĩa task.
4. Chỉ sau đó mới rà fixed start, khung giờ, duration cap, break, quyền di
   chuyển, overlap và các constraint khác để lọc/điều chỉnh phương án.
5. Nếu phương án ngữ nghĩa tốt nhất vướng constraint, giải thích task nào bị
   ảnh hưởng và so sánh lựa chọn thay thế. Không âm thầm hy sinh task quan
   trọng chỉ vì phương án đó dễ xếp hơn.
6. Trình bày tóm tắt phạm vi đã quét, các ưu tiên ngữ nghĩa chính và trade-off.
   Không cần lặp nguyên văn toàn bộ description khi danh sách dài; phải nêu
   task nào còn thiếu dữ liệu/ngữ cảnh.

Các lựa chọn mới nhất được xác nhận ngày 2026-11-15:

- Không giảm thời lượng Secondary Tasks.
- Chỉ được giảm Main Task linh hoạt không có Start Time; không áp dụng cho
  `Ngủ đêm`.
- Cho phép người dùng xác nhận bỏ qua mọi **lỗi thời gian** để ghi lịch.
- Cho phép ghi snapshot chưa tối ưu vào Scheduler Database và tiếp tục luồng
  Calendar sau một xác nhận riêng.

## 2. Bảng quy tắc nhanh

| Loại task | Thời lượng | Vị trí và thứ tự |
|---|---|---|
| Main có Start Time | Giữ nguyên; không tăng, giảm hoặc dời giờ bắt đầu. | Giữ đúng Start Time nguồn. |
| Main linh hoạt, không có Start Time | Không tăng. Ưu tiên giữ nguyên; chỉ giảm khi cần, tối đa 15 phút nếu duration gốc ≤60 phút, tối đa 30 phút nếu >60 phút. | Được sắp xếp lại trong scheduling window lấy từ cấu hình đầu vào. |
| Secondary | Giữ nguyên tuyệt đối; không giảm để lấp khoảng trống hay xử lý xung đột. | Ưu tiên buổi nguồn; chỉ task đủ điều kiện mới được chuyển sang TỐI theo quy tắc tại mục 5. |
| `Ngủ đêm` | Giữ đúng giờ bắt đầu và thời lượng cấu hình; không giảm hoặc dời. | Một task mỗi ngày, làm mốc thời gian qua ngày. |
| `Ngủ khuya` trong tab ngày | Không xếp và không tính như Secondary. | Loại khỏi danh sách Secondary; lịch ngủ duy nhất là `Ngủ đêm` được tạo theo cấu hình. |

## 3. Quy tắc thời lượng

### 3.1. Main có Start Time

- Start Time và thời lượng lấy từ dữ liệu nguồn, không được thay đổi.
- Không chuyển task sang khung giờ khác để giải quyết xung đột.
- Nếu hai mốc cố định chồng lấn, giữ nguyên nguồn và báo lỗi; không tự dịch
  chuyển một task.

### 3.2. Main linh hoạt không có Start Time

- Chỉ task có `task_type: "flexible"` và không có Start Time mới đủ điều kiện
  giảm thời lượng.
- Không tăng thời lượng. Không giảm task chỉ để làm kín khoảng trống.
- Giữ duration gốc nếu vẫn xếp được lịch. Nếu cần giảm, áp dụng giới hạn:
  - Duration gốc **≤60 phút**: giảm tối đa **15 phút**.
  - Duration gốc **>60 phút**: giảm tối đa **30 phút**.
- Giới hạn này áp dụng cho Main linh hoạt ở mọi thời điểm trong ngày; không
  áp dụng cho task cố định hay `Ngủ đêm`.
- Giữ `original_duration_hours` và các trường nguồn bất biến. Chỉ cập nhật
  `duration_hours` của bản nháp tối ưu; `CLOCK` phải khớp duration sau điều
  chỉnh.
- Không tự suy ra Min/Max Duration nếu dữ liệu đầu vào không có các trường đó.
  Cap 15/30 phút vẫn áp dụng.

**Độ chính xác cần lưu ý:** optimizer hiện biểu diễn duration Main theo bước
`0.01` giờ (xấp xỉ 36 giây); validator cho phép tối đa hai chữ số thập phân.
Người dùng đã chốt mức giảm tối đa nhưng chưa chốt quy tắc làm tròn theo phút.
Cho đến khi được xác nhận thêm, không được diễn giải cap thành “chỉ giảm theo
bước 15 hoặc 30 phút”.

### 3.3. Secondary

- `duration_minutes`, `duration_hours` và `original_duration_hours` là bất
  biến, phải bằng nhau theo phép quy đổi phút/giờ.
- Không đặt `scheduled_duration_minutes`,
  `scheduled_duration_hours` hoặc lý do giảm duration để rút ngắn Secondary.
- Nếu không thể xếp đủ thời lượng, giữ task và duration để hiển thị trên
  preview; báo rõ xung đột thay vì giảm duration hoặc bỏ task.
- Không xóa, gộp hoặc nhân đôi task để làm lịch có vẻ khả thi.

### 3.4. Nguyên tắc cân bằng chất lượng

- Bước đánh giá ý nghĩa phải diễn ra **trước** khi AI áp duration cap hoặc cố
  xếp task vào các khoảng trống. Trước tiên xác định task nào cần được bảo vệ
  về thời gian, task nào có thể linh hoạt và thời điểm nào phù hợp.
- Mục tiêu là cân bằng khả thi và chất lượng, không phải lấp kín mọi khoảng
  thời gian.
- Cap là mức giảm tối đa được phép, không phải mục tiêu phải dùng. Dù Main
  linh hoạt thuộc nhóm được phép giảm, AI vẫn phải giữ duration nếu giảm sẽ làm
  tổn hại đáng kể đến chất lượng/ý nghĩa task hoặc không có lý do thực tế.
- Mọi thay đổi duration phải nằm trong đúng nhóm task được phép, có thể giải
  thích và được cân nhắc dựa trên nội dung, không chỉ dựa vào độ dài khoảng
  trống.
- Không áp dụng một tỷ lệ giảm chung ngoài cap đã xác nhận.
- Nếu thiếu dữ liệu về Min/Max, độ phức tạp hoặc chất lượng đầu ra, không tự
  bịa một ngưỡng mới.
- Nguyên tắc “Balance with Quality Consideration” là định hướng dự án. Trong
  pilot, CP-SAT tối ưu các biến thời gian và các ưu tiên đã mã hóa; nó **chưa**
  tự đánh giá chất lượng nội dung task như một chuyên gia hoặc học từ lịch
  thực tế.

## 4. Quy tắc vị trí và thứ tự Main

- Main cố định giữ nguyên vị trí thời gian.
- Main linh hoạt được đặt trong khoảng từ `defaultStartTime` đến hết cửa sổ
  lập lịch ngày kế tiếp theo cấu hình đầu vào. Không thay mặc định cấu hình
  chỉ để thuận tiện cho một lần tối ưu.
- `source_order` là thứ tự READY gốc, bất biến và dùng làm ưu tiên mềm.
- `schedule_order` là thứ tự thực hiện cuối cùng của Main trong ngày; được
  phép thay đổi khi cần, nhưng nên giảm thiểu việc đảo thứ tự nếu các phương
  án còn lại tương đương.
- `schedule_order` phải liên tục từ 1 trong từng ngày; `Ngủ đêm` đứng cuối
  danh sách thứ tự của ngày đó.
- `CLOCK` phải khớp duration. Task qua nửa đêm phải thể hiện đúng ngày kết
  thúc, không được tính thành khoảng thời gian âm hoặc gắn nhầm sang ngày khác.
- Khoảng nghỉ lấy từ `schedule_settings.breakMinutes`, chỉ áp dụng giữa các
  Main khi có ít nhất một task linh hoạt. Không áp dụng khoảng nghỉ cấu hình
  giữa hai Main cố định.

## 5. Quy tắc vị trí Secondary

### 5.1. Khung nguồn

Secondary mặc định ở trong buổi nguồn và không tràn qua ranh giới buổi:

| Buổi | Khung giờ |
|---|---|
| SÁNG | 06:00–10:00 |
| TRƯA | 10:00–14:00 |
| CHIỀU | 15:00–17:00 |
| TỐI | 17:00–23:00 |

Khoảng **14:00–15:00** hiện không thuộc khung Secondary nào đã liệt kê. Không
tự mở rộng khung này nếu chưa có xác nhận.

### 5.2. Thứ tự, ngữ cảnh và thời điểm ưu tiên

- Vị trí ô `J/L/N/P`, `source_order` và `period_order` là dấu vết/thứ tự liệt
  kê nguồn; chúng không tự xác định thứ tự thực hiện cuối cùng.
- Vị trí trong buổi được chọn theo khung giờ, task Main, các Secondary khác và
  ngữ cảnh sinh hoạt.
- `suggested_clock` là gợi ý, không phải giờ cố định.
- Các mốc mục tiêu như ăn sáng khoảng 07:30, vệ sinh sáng khoảng 06:15, ăn
  trưa khoảng 12:00 hoặc bữa tối khoảng 18:30 là heuristic hiện có trong code,
  không phải Start Time cố định đã được người dùng xác nhận. Chỉ dùng làm ưu
  tiên mềm, không dùng để thay đổi giờ cố định hay thời lượng.
- Bữa sáng phải kết thúc không muộn hơn 10:00.
- `Vệ sinh sáng` khi còn ở buổi nguồn phải kết thúc trước Main cố định đầu
  tiên trong ngày, nếu có.

### 5.3. Ngoại lệ chuyển Secondary sang TỐI

- Ngoại lệ chuyển buổi đã được chấp nhận cho task có `context_type` là
  `personal_hygiene` hoặc task giải trí được nhận diện theo tên.
- Chỉ thử chuyển sang TỐI (17:00–23:00) khi lịch Main cố định làm vị trí nguồn
  không phù hợp/không khả thi.
- Giữ nguyên `period` nguồn và các trường nguồn. Ghi buổi thực tế ở
  `placement_period` cùng `placement_reason`.
- Không được suy ra rằng mọi task có chữ “vệ sinh” đều được chuyển; code phân
  biệt `personal_hygiene` với `morning_hygiene`. Cần kiểm tra nhãn ngữ cảnh cụ
  thể của task.
- Chuyển buổi không cho phép giảm duration Secondary.

### 5.4. Khoảng nghỉ và chồng lấn

- Không áp dụng `breakMinutes` của Main cho Secondary.
- Không bắt buộc khoảng nghỉ giữa Secondary–Secondary hoặc Secondary–Main;
  không chèn buffer cứng khi đổi nhóm.
- Tài liệu cũ mô tả khoảng đệm 10 phút là ưu tiên mềm. Code hiện không có một
  ràng buộc validator 10 phút cho Secondary; không được coi đó là giới hạn
  bắt buộc.
- Solver có ưu tiên giảm xung đột, nhưng Main–Secondary và Secondary–Secondary
  có thể vẫn chồng lấn trong candidate. Phải báo trên preview và optimizer
  report.

## 6. Ngủ và trục thời gian

- Mỗi ngày có đúng một `Ngủ đêm`, được tạo từ
  `sleepStartTime`/`sleepDurationHours` trong cấu hình.
- Không sửa tên, giờ bắt đầu, thời lượng hoặc màu của `Ngủ đêm`.
- Task ngủ là khoảng bảo vệ qua ngày; phải xét khi đặt Main và Secondary của
  ngày kế tiếp.
- `Ngủ khuya` trong dữ liệu tab ngày không phải task thứ hai để đưa lên lịch;
  loại khỏi Secondary, thống kê và tổng workload.
- Dùng thời gian địa phương của lịch (`Asia/Ho_Chi_Minh`) và `CLOCK` đúng
  định dạng qua nửa đêm.

## 7. Quyền xác nhận lỗi và các bước ghi

### 7.1. Kiểm tra cấu trúc/toàn vẹn — luôn chặn

Không cho người dùng bỏ qua các lỗi làm dữ liệu sai nguồn hoặc sai cấu trúc,
bao gồm:

- Thiếu, thừa, trùng task hoặc sai `task_id`.
- Sửa ngày, tên, metadata, `source_order`, trường nguồn bất biến hoặc
  `source_fingerprint`.
- Sửa Start Time/duration của Main cố định hoặc `Ngủ đêm`.
- CLOCK sai định dạng, không khớp duration hoặc lịch thiếu một `Ngủ đêm` trong
  ngày.
- Secondary bị sửa duration nguồn hoặc có thay đổi placement/duration không
  hợp lệ.

### 7.2. Lỗi thời gian — được xác nhận bỏ qua

Theo lựa chọn mới nhất của người dùng, các lỗi thời gian được phép tiếp tục
sau khi hiển thị rõ trên preview và người dùng xác nhận, bao gồm:

- Chồng lấn giữa các task hoặc với mốc cố định.
- Main linh hoạt ngoài scheduling window.
- Secondary ngoài khung nguồn/khung TỐI được phép.
- Thiếu khoảng nghỉ cấu hình giữa các Main có task linh hoạt.
- Bữa sáng kết thúc sau 10:00.
- Vệ sinh sáng kết thúc sau Main cố định đầu tiên.

Việc xác nhận bỏ qua **không** làm candidate trở thành lịch không lỗi; phải
giữ cảnh báo trong báo cáo và không ghi nhận trạng thái “đã hợp lệ”.

### 7.3. Ghi Scheduler Database và Calendar

- Có thể ghi snapshot chưa tối ưu vào Scheduler Database theo lựa chọn của
  người dùng. Cần thể hiện rõ trạng thái “chưa tối ưu” để tránh nhầm với lịch
  đã qua optimizer; schema hiện tại chưa có trường trạng thái riêng cho việc
  này.
- Có thể tiếp tục Calendar sau một bước preview và xác nhận riêng. Ghi vào
  Sheet không tự động đồng nghĩa với việc cho phép đồng bộ Calendar.
- Không tự động ghi Sheet hoặc Calendar khi optimizer/assistant lưu bản nháp.
- Khi bỏ qua lỗi thời gian, cần cho biết rõ task/ngày/lỗi bị bỏ qua trước khi
  người dùng xác nhận. Lỗi cấu trúc/toàn vẹn vẫn chặn.

## 8. Thứ tự tối ưu và giới hạn tự động hóa

- AI phải hoàn tất semantic scan và xác định mục tiêu/chất lượng trước khi gọi
  solver hoặc chỉnh `CLOCK`. Solver là công cụ tính toán, không phải nguồn
  hiểu ý nghĩa công việc.
- Sau bước ngữ nghĩa, solver tìm vị trí phù hợp dưới các rule đã chốt; ưu tiên
  phương án đạt mục tiêu task với ít điều chỉnh nhất. Cap duration là giới hạn
  cuối, không thay thế đánh giá chất lượng.
- Có thể đổi vị trí Main linh hoạt và áp dụng ngoại lệ chuyển Secondary đủ
  điều kiện; không được đổi Main cố định hoặc rút ngắn Secondary.
- Nếu vẫn không giải được đầy đủ, giữ tất cả task trong preview, thể hiện
  overlap/window violation và báo rõ thay vì bỏ task hoặc tạo kết quả giả như
  đã hợp lệ.
- CP-SAT có thể tối thiểu hóa các xung đột đã mô hình hóa, nhưng một candidate
  `FEASIBLE` không đồng nghĩa không có xung đột. Validator JavaScript vẫn phải
  chạy độc lập.
- Nếu ưu tiên ngữ nghĩa chưa được biểu diễn trong objective của solver, AI
  phải đối chiếu candidate với semantic plan sau khi solve; không tuyên bố
  rằng candidate tối ưu về ý nghĩa chỉ vì solver trả `OPTIMAL`.
- Cách ưu tiên chính xác giữa “giữ nguyên duration Main”, “đổi thứ tự Main”
  và “chuyển Secondary đủ điều kiện sang TỐI” chưa được người dùng chốt thành
  thứ tự lexicographic. Mặc định nên ưu tiên phương án ít thay đổi nhất và
  trình bày trade-off, không tự hy sinh chất lượng task.
- Không có dữ liệu Địa điểm hoặc thời gian di chuyển trong schema hiện tại.
  Không tự thêm buffer di chuyển hoặc suy luận địa điểm; nếu cần, đây là yêu
  cầu dữ liệu/quy tắc riêng.

## 9. Khác biệt giữa chính sách mới và code/tài liệu hiện tại

| Chủ đề | Chính sách hiện được ghi nhận | Hiện trạng được rà soát |
|---|---|---|
| Giảm Main linh hoạt | Chỉ giảm, không tăng; cap 15/30 phút. | Optimizer/validator có cap tương ứng và cố định/sleep không đổi. Một đoạn cũ trong `PROJECT_CONTEXT.md` còn nói Main linh hoạt có thể tăng; lựa chọn mới thay thế đoạn đó cho pilot hiện tại. |
| Giảm Secondary | Cấm giảm. | `optimizer.py` vẫn có fallback giảm Secondary; validator cho phép trường scheduled duration và test hiện kiểm tra trường hợp đó. Code, test và tài liệu liên quan cần đồng bộ trước khi chính sách này được coi là thực thi. |
| Lỗi thời gian | Có thể xác nhận bỏ qua; lỗi cấu trúc vẫn chặn. | VS Code extension đã có modal xác nhận timing issues. Các tài liệu cũ còn dùng cách diễn đạt “HARD CONSTRAINT” tuyệt đối; cần cập nhật để phân biệt ràng buộc mặc định với lỗi cấu trúc không thể bỏ qua. |
| Snapshot chưa tối ưu | Được phép ghi; Calendar cần xác nhận riêng. | Apps Script hiện từ chối ghi snapshot trực tiếp khi preview có cảnh báo. Luồng VS Code cho phép xác nhận ghi khi chỉ còn lỗi thời gian. Hai đường ghi chưa cùng thể hiện lựa chọn mới. |
| Chuyển Secondary | Chỉ task đủ ngữ cảnh được chuyển TỐI; không đổi thời lượng. | Code có ngoại lệ chuyển buổi, nhưng điều kiện task dựa vào `context_type`/tên; cần giữ rõ danh sách eligibility. |
| Đánh giá chất lượng | Không giảm máy móc; cân nhắc ý nghĩa công việc. | Heuristic hiện tại không thay thế phân tích chất lượng tự động; trợ lý có thể rà soát khi được yêu cầu, còn solver chủ yếu tối ưu các ràng buộc/chi phí đã mã hóa. |
| Khoảng đệm 10 phút | Nếu dùng thì chỉ là ưu tiên mềm. | Không phải ràng buộc bắt buộc trong validator; chưa thấy một mục tiêu 10 phút riêng được thực thi trong solver. |

## 10. Các điểm cần xác nhận khi hoàn thiện code

1. Có giữ độ chính xác giảm Main theo `0.01` giờ (~36 giây), hay yêu cầu mọi
   điều chỉnh theo phút nguyên?
2. Khi phải chọn giữa giảm Main trong cap và chuyển Secondary đủ điều kiện sang
   TỐI, thứ tự ưu tiên nào quan trọng hơn?
3. Danh sách chính xác task `personal_hygiene` có thể chuyển TỐI là gì? Không
   nên dựa riêng vào từ khóa tên task nếu có thể dùng mapping rõ ràng.
4. Cần đánh dấu trạng thái “chưa tối ưu” ở đâu khi snapshot vẫn được ghi vào
   cùng Scheduler Database?
5. Có muốn bổ sung Địa điểm/thời gian di chuyển sau này không? Hiện chưa có
   trường dữ liệu hoặc quy tắc di chuyển.

## 11. Nguồn đã đối chiếu

- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — nguyên tắc dự án, Main/Secondary,
  hard constraints và roadmap.
- [SCHEDULER_TRANSFER_SCHEMA.md](./SCHEDULER_TRANSFER_SCHEMA.md) — trường bất
  biến, cap duration, CLOCK và hợp đồng import.
- [SECONDARY_TASK_DATA_SPEC.md](./SECONDARY_TASK_DATA_SPEC.md) — khung buổi,
  ngữ cảnh, ngoại lệ TỐI và mapping Secondary.
- [SCHEDULER_OPTIMIZER.md](./SCHEDULER_OPTIMIZER.md) — các giai đoạn CP-SAT,
  mục tiêu mềm, fallback và nhật ký thử nghiệm.
- [VSCODE_OPTIMIZATION_WORKFLOW.md](./VSCODE_OPTIMIZATION_WORKFLOW.md) — luồng
  preview, ghi Sheet và xác nhận timing issue.
- [CHUẨN HOÁ DATABASE.md](./CHUẨN HOÁ%20DATABASE.md) — mapping dữ liệu nguồn,
  fixed anchors, thứ tự và các quy tắc Main.
- [APPS_SCRIPT_WEB_APP_SETUP.md](./APPS_SCRIPT_WEB_APP_SETUP.md) — hành vi
  snapshot, preview và Calendar test flow.
- Mã kiểm tra: [optimizer.py](./vscode_extension/optimizer.py),
  [scheduler.js](./vscode_extension/scheduler.js),
  [extension.js](./vscode_extension/extension.js),
  [Code.gs](./apps_script_web/Code.gs).
- Regression tests: [test_optimizer.py](./vscode_extension/test/test_optimizer.py)
  và [scheduler.test.js](./vscode_extension/test/scheduler.test.js).

**Phạm vi rà soát:** đối chiếu tài liệu chính sách và mã optimizer/validator/
writer liên quan. Không đọc dữ liệu lịch cá nhân trong `transfers/`, không
thay đổi Google Sheets/Calendar, không sửa code và không chạy test trong lần
tạo tài liệu này.
