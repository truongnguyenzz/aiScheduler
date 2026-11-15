# AI ADAPTIVE SCHEDULING & SELF-REVIEW ENGINE
## PROJECT CONTEXT & DEVELOPMENT ROADMAP

**Phiên bản tài liệu:** 1.0  
**Trạng thái:** Giai đoạn 1 — VS Code pilot xử lý Main và Secondary Tasks, xem trước tuần và ghi duyệt vào Scheduler Database; chưa xác minh deployment/live write sau cập nhật  
**Môi trường phát triển:** Visual Studio Code  
**Ngôn ngữ chính:** Python cho công cụ hiện có; JavaScript cho VS Code extension  
**AI Provider:** Trợ lý AI đang dùng trong VS Code; không gọi Gemini API trong luồng hiện tại  
**Optimization Engine:** OR-Tools CP-SAT chạy cục bộ từ VS Code extension; validator JavaScript độc lập kiểm tra kết quả và preview. Trợ lý AI tập trung rà soát/ngữ cảnh khi được yêu cầu  
**Hệ thống đích:** SMART CALENDAR SYNC V3.2 (Google Sheets + Google Apps Script + Google Calendar)

---

# PHẦN I. TỔNG QUAN DỰ ÁN

## 1.1. Tên dự án

AI ADAPTIVE SCHEDULING & SELF-REVIEW ENGINE

Định hướng dài hạn là một hệ thống có thể phân tích, tối ưu, mô phỏng, tự
đánh giá và điều chỉnh lịch trình trước khi lịch được chuyển đến hệ thống
Google Calendar. Các khả năng tự động này chưa được triển khai đầy đủ; pilot
hiện tại được mô tả riêng tại Phần 2.3.

Dự án được phát triển độc lập trong VS Code, không can thiệp trực tiếp vào mã nguồn SMART CALENDAR SYNC V3.2 trong giai đoạn đầu.

## 1.2. Mục tiêu dài hạn

Xây dựng một hệ thống có khả năng:

1. Đọc và hiểu dữ liệu công việc từ Google Sheets.
2. Phân tích nội dung, khối lượng, mức độ phức tạp và thời lượng hợp lý của từng công việc.
3. Nhận biết công việc cố định và công việc linh hoạt.
4. Tự đề xuất điều chỉnh thời lượng đối với những công việc được phép điều chỉnh.
5. Tự sắp xếp lại lịch để giải quyết tình trạng thiếu thời gian hoặc phân bổ không hợp lý.
6. Tính toán lịch trình bằng bộ tối ưu hóa tất định, có trạng thái khả thi và báo cáo truy vết.
7. Tự kiểm tra và phản biện kết quả sau mỗi lần tối ưu.
8. Tự yêu cầu điều chỉnh lại nếu phát hiện lịch chưa đạt yêu cầu.
9. Lặp lại quy trình tối ưu cho đến khi đạt tiêu chuẩn hoặc hết số vòng cho phép.
10. Xuất ra lịch trình hoàn chỉnh cùng báo cáo giải thích các thay đổi.
11. Chỉ chuyển lịch sang hệ thống chính thức khi có sự chấp thuận của người dùng.

**Định hướng quan trọng:** Đây không phải công cụ chỉ sắp xếp các công việc vào những khoảng thời gian trống. Đây là một hệ thống có khả năng hiểu ý nghĩa của thời lượng, cân nhắc chất lượng công việc và tự đánh giá phương án do chính nó đề xuất.

## 1.3. Nguyên tắc thiết kế

- Khi được yêu cầu sắp xếp lịch, AI phải bắt đầu bằng việc đọc toàn bộ danh
  sách task và hiểu ý nghĩa, mức độ quan trọng, thời lượng cùng ngữ cảnh của
  chúng. Chỉ sau bước phân tích này mới áp dụng các quy tắc để chọn lịch phù
  hợp. Không bắt đầu bằng việc tìm khoảng trống hoặc liệt kê khóa cứng để nhồi
  task vào lịch.
- Thứ tự ưu tiên trên là thứ tự phân tích và tối ưu mục tiêu; không cho phép
  sửa dữ liệu nguồn bất biến, giả mạo kết quả kiểm tra hay tự ý ghi dữ liệu.
- AI không được âm thầm vi phạm constraint. Theo chính sách duyệt hiện hành,
  người dùng có thể xác nhận bỏ qua lỗi thời gian; điều đó không cho phép sửa
  nguồn/fixed field và không biến candidate còn cảnh báo thành lịch không lỗi.
- AI không được tự ý loại bỏ công việc để làm cho lịch trông hợp lý.
- Không điều chỉnh thời lượng chỉ để lấp đầy khoảng trống.
- Không sử dụng một tỷ lệ tăng/giảm thời lượng chung cho mọi loại công việc.
- Không coi kết quả do AI tạo ra là hợp lệ nếu chưa qua kiểm tra độc lập.
- Không ghi vào Google Calendar chính thức trong giai đoạn phát triển và thử nghiệm.
- Mọi thay đổi quan trọng phải có lý do và có thể truy vết.

---

# PHẦN II. BỐI CẢNH HỆ THỐNG HIỆN TẠI

## 2.1. Hệ thống SMART CALENDAR SYNC V3.2

Dự án mới được xây dựng để hỗ trợ hệ thống hiện có:

**SMART CALENDAR SYNC V3.2**

Hệ thống hiện tại sử dụng:
- Google Sheets để lưu trữ và quản lý công việc.
- Google Apps Script để xử lý dữ liệu và đồng bộ.
- Google Calendar để hiển thị lịch trình.

Dự án AI Adaptive Scheduler sẽ đảm nhiệm giai đoạn phân tích và tối ưu lịch trước khi dữ liệu được chuyển đến cơ chế đồng bộ hiện có.

Không được tự ý viết lại toàn bộ SMART CALENDAR SYNC V3.2.

## 2.2. Cấu trúc dữ liệu công việc hiện tại

### A. Công việc chính (Main Tasks)

Công việc chính được quản lý trong bảng MASTER.

Các thông tin quan trọng:
- Tên công việc.
- Nội dung/mô tả.
- Thời lượng mặc định.
- Thời lượng tối thiểu.
- Thời lượng tối đa.
- Thời gian bắt đầu cố định (Start Time), nếu có.
- Mức độ ưu tiên và các thông tin phân loại khác nếu dữ liệu nguồn cung cấp.

Lưu ý: Min Duration và Max Duration là các trường cần được bổ sung hoặc ánh xạ khi thiết kế dữ liệu đầu vào. Không được tự giả định chúng đã tồn tại đầy đủ trong Google Sheets.

### B. Công việc phụ (Secondary Tasks)

Các tab ngày `THỨ HAI` đến `CHỦ NHẬT` có cùng cấu trúc theo xác nhận của
người dùng; nội dung lựa chọn và ngày của từng tab khác nhau. Tab `THỨ HAI`
được dùng làm mẫu. Nguồn Secondary Tasks gồm:

- Danh mục `A1:F25`: cột C là tên/mã task, D là mô tả, E/F là thời lượng giờ
  và phút; A/B thể hiện nhóm lớn và nhóm task theo bố cục trong Sheet.
- Vùng phân bố `H1:T17`: H là buổi/khung, I là nhóm, J/L/N/P là các ô chọn
  task, K/M/O/Q là thời lượng phút được nối/nhúng từ danh mục; R:T là tổng hợp
  thời lượng.

Các khung thời gian:
- SÁNG: 06:00–10:00.
- TRƯA: 10:00–14:00.
- CHIỀU: 15:00–17:00.
- TỐI: 17:00–23:00.

Các task phụ chủ yếu duy trì hoạt động thể chất, vệ sinh, ăn uống và trạng
thái sinh hoạt. Thời lượng thông thường không quá 30 phút. Không áp dụng cho
Secondary Tasks khoảng nghỉ cấu hình giữa Main Tasks, cũng không chèn khoảng
nghỉ mới giữa task phụ (kể cả giữa các nhóm khác nhau). J/L/N/P là slot chọn,
không phải thứ tự thực hiện; STT tạm tính được ghi trái sang phải, trên xuống
dưới trong cùng một buổi, nhưng thứ tự thực hiện cuối cùng phải dựa trên ngữ
cảnh và tính hợp lý của lịch trình. `KHUNG GIỜ` lấy theo display value của H.
Không được thay đổi duration nếu chưa có quy tắc cho phép. Tất cả task phụ
dùng màu hoa anh đào; ICON theo NHÓM: VỆ SINH 💦, VẬN ĐỘNG 💪, TIN TỨC 🌏,
SINH HOẠT ⛅️; nhóm khác dùng quy tắc ICON của Main Task.

Một số nhãn buổi/nhóm trong Google Sheets sử dụng ô gộp. Khi đọc dữ liệu cần
xử lý đúng cơ chế kế thừa giá trị (forward-fill) cho các dòng tiếp theo.
`Ngủ khuya` luôn xuất hiện trong cả bảy tab ngày nhưng phải bị loại khỏi mọi
bảng tổng hợp, thống kê, workload và dòng Secondary Task được import; lịch ngủ
đêm duy nhất là task `Ngủ đêm` sinh theo cấu hình hiện có. Chi tiết mapping và
những điểm còn mở nằm trong `SECONDARY_TASK_DATA_SPEC.md`.

Đã thực hiện một lần nhập thử thủ công có xác nhận cho THỨ HAI, ngày
2026-11-09: ghi 13 Secondary Tasks vào `Scheduler Database!M2:Y14`, loại
`Ngủ khuya` khỏi số liệu và dữ liệu nhập. `DURING` được lưu theo giờ thập phân,
`CLOCK` để trống đến khi có giờ cụ thể, `MÀU NỀN` ghi nhãn `MÀU HOA ANH ĐÀO`,
và ID theo dạng `ADP-` + 24 ký tự hex viết hoa. Tổng thời lượng sau khi loại
Ngủ khuya là 345 phút; `Quản trị` (45 phút) và `Lịch trình` (60 phút) vẫn
được giữ theo lựa chọn của người dùng. Đây là lần nhập thử thủ công trước khi
tích hợp; thao tác ghi tự động chỉ diễn ra sau khi người dùng nhấn nút ghi.
Code hiện tại đã mở rộng luồng preview, transfer, validation, Sheets writer và
Calendar importer cho vùng M:Y; việc deploy Apps Script, cài VSIX mới và xác
minh live write vẫn chưa hoàn tất.

## 2.3. Luồng tối ưu có trợ lý VS Code (pilot hiện tại)

Giai đoạn pilot không gọi Gemini API và không yêu cầu Python chạy thủ công mỗi
lần import. Apps Script vẫn chịu trách nhiệm đọc/chuẩn hóa Sheet nguồn; extension
VS Code thực hiện preview và ghi trực tiếp vào Scheduler Database sau khi người
dùng xác nhận:

Preview nguồn của Apps Script không dừng vì task chồng lấn hoặc không tìm được
slot: task vẫn được hiển thị bằng CLOCK dự phòng, giữ nguyên duration và các
khối xung đột được đặt cạnh nhau trên lưới. Cảnh báo này không chặn chuẩn hóa
hoặc tải JSON; snapshot có cảnh báo không được ghi trực tiếp từ Web App vào
Scheduler Database.

1. Apps Script **Chuẩn hóa dữ liệu** xuất `normalized_input` JSON schema v4.
   Main Tasks giữ category/class/GI/ICON/COLOR từ MASTER; `secondary_tasks`
   được đọc từ bảy tab ngày, giữ nguyên duration, khung giờ và mapping ICON/
   màu hoa anh đào. Flexible Main có `clock: null`; Secondary có
   `clock: null` cùng `suggested_clock`.
2. Người dùng chép file không chỉnh sửa vào `transfers/incoming`.
3. **Scheduler: Open Weekly Preview** tạo hoặc mở lại một bản nháp ổn định trong
   `transfers/optimized`. Chọn **Optimize locally** để chạy OR-Tools CP-SAT trên
   máy, không gọi AI API hoặc Google API. Khi người dùng yêu cầu AI lập/tối ưu
   lịch, trợ lý phải quét và phân tích ngữ nghĩa toàn bộ task trước khi gọi
   solver hoặc đề xuất vị trí/thời lượng. CP-SAT chỉ tính toán các ràng buộc
   định lượng; trợ lý phải đối chiếu candidate với semantic plan.
4. Extension hiển thị lịch theo lưới tuần 7 ngày × 24 giờ, tự cập nhật khi bản
   nháp được lưu. Mỗi lần tối ưu lưu riêng `.optimizer-report.json`; không tạo
   ảnh preview cố định và không ghi Google.
5. Extension đọc lại input/draft, kiểm tra task đầy đủ, trường bất biến,
   fixed anchors, duration cap, CLOCK, thứ tự, khoảng nghỉ và xung đột. Lỗi
   cấu trúc/toàn vẹn nguồn chặn ghi; lỗi thời gian (overlap, ngoài khung hoặc
   thiếu break) được phân loại riêng và cần xác nhận rõ ràng trước khi ghi.
   `source_fingerprint` phải được giữ nguyên nhưng không được tính lại hay dùng
   làm gate so sánh live với Sheet nguồn trong đường import trực tiếp.
6. Người dùng chọn nút ghi trong preview. Nếu chỉ còn lỗi thời gian, extension
   hiển thị xác nhận modal riêng; nếu được xác nhận, extension ghi chỉ các giá trị task
   vào tab tuần hiện có của Scheduler Database cố định, giữ header/format và
   đọc lại để xác minh cả vùng Main `A:J` và Secondary `M:Y`.
7. Apps Script Web App liệt kê các tab Database có header hợp lệ; người dùng
   chọn tuần đã được VS Code ghi để xem trước và tiếp tục Calendar test flow.

Apps Script Web App chỉ xuất dữ liệu chuẩn hóa và xử lý luồng nguồn/Calendar;
không còn nhận file lịch tối ưu. Luồng VS Code xử lý Main Tasks, Secondary
Tasks và task `Ngủ đêm`; validator vẫn phân biệt quy tắc nghỉ của Main với
khung giờ và duration bất biến của Secondary.

ICON được ghi vào cột D và COLOR vào cột I theo quy tắc V3.2. Tên task gốc
không bị đổi; ICON chỉ được ghép vào tiêu đề Calendar/preview. DESCRIPTION
trong Scheduler Database nhận CLOCK cuối cùng khi import lịch đã duyệt. Extension
vẫn đọc transfer schema v2/v3 cũ; export mới dùng schema v4.

OR-Tools tính toán các ràng buộc thời gian. Với mọi yêu cầu AI lập/tối ưu lịch,
trợ lý phải luôn bắt đầu bằng quét task và đánh giá ngữ nghĩa; không đợi người
dùng nhắc riêng về ngữ cảnh. Sau đó trợ lý mới áp dụng constraint và giải
thích trade-off. AI và solver đều không thể thay thế validator hoặc tự quyết
định import. Không có thao tác nào tự động ghi Google chỉ vì optimizer hoặc
assistant đã lưu file. Chi tiết engine và dấu vết chạy được ghi trong
`SCHEDULER_OPTIMIZER.md`.

---

# PHẦN III. CÁC QUY TẮC LẬP LỊCH BẮT BUỘC

Đây là các quy tắc áp dụng sau bước hiểu task. Với mọi yêu cầu AI lập lịch,
trước hết phải quét toàn bộ tên, duration, description, period/window và ngữ
cảnh của Main, Secondary cùng `Ngủ đêm`; đánh giá ý nghĩa/mức quan trọng rồi
mới dùng các quy tắc dưới đây để chọn phương án. Không bắt đầu bằng việc liệt
kê khóa cứng hoặc nhồi task vào khoảng trống. Dữ liệu nguồn bất biến vẫn không
được sửa.

## 3.1. Công việc chính có Start Time

Nếu một công việc chính có Start Time:

- Thời gian bắt đầu là cố định.
- Thời lượng là cố định.
- AI không được thay đổi thời gian bắt đầu.
- AI không được tăng hoặc giảm thời lượng.
- AI không được tự động đẩy công việc sang thời điểm khác.

Nếu hai công việc cố định xung đột:
- Phải phát hiện xung đột.
- Phải báo cáo cụ thể.
- Không tự ý dịch chuyển một trong hai công việc để giải quyết xung đột.

Đây là HARD CONSTRAINT.

## 3.2. Công việc chính không có Start Time

Đối với công việc chính linh hoạt, AI được phép thay đổi vị trí và điều chỉnh
thứ tự. Ở định hướng tương lai, Min/Max Duration có thể hỗ trợ điều chỉnh thời
lượng theo ý nghĩa công việc. Tuy nhiên, **chính sách pilot hiện tại chỉ cho
phép giảm** task Main linh hoạt theo cap bên dưới; không tăng duration.

Tuy nhiên, mọi điều chỉnh thời lượng phải nằm trong:

Min Duration <= Adjusted Duration <= Max Duration

Không được vượt quá giới hạn.

Trong pilot transfer hiện tại, Min/Max Duration không có trong JSON nguồn nên
không được tự suy diễn. Schema pilot dùng quy tắc chặt hơn: giữ duration gốc
nếu có thể; chỉ giảm flexible task khi cần, không tăng, với mức giảm tối đa
15 phút nếu duration gốc không quá 1 giờ và 30 phút nếu trên 1 giờ. Fixed
tasks và `Ngủ đêm` không được đổi. Mở rộng Min/Max cần có dữ liệu nguồn và xác
nhận riêng, không áp dụng ngầm vào transfer v2.

Thời lượng mặc định (Default Duration) là giá trị tham chiếu quan trọng, không phải giá trị có thể tùy ý thay đổi.

## 3.3. Công việc phụ

Secondary Tasks mặc định được xếp trong BUỔI/khung nguồn. Không tự chuyển
task giữa các buổi chỉ để lấp khoảng trống. Có ngoại lệ ngữ cảnh đã được chấp
nhận cho task vệ sinh cá nhân và giải trí: nếu lịch Main cố định khiến khung
nguồn không dùng được, có thể thử chuyển chúng sang TỐI (17:00–23:00), giữ
nguyên tên và các trường nguồn, đồng thời ghi `placement_period` và lý do vào
bản nháp.

- Không được tự ý xóa hoặc bỏ qua công việc.
- Không giảm duration Secondary trong bất kỳ giai đoạn nào. Nếu task không thể
  xếp đủ thời lượng trong vị trí được phép, giữ task và duration để hiển thị
  conflict trong preview. Các trường `scheduled_duration_minutes`/
  `scheduled_duration_hours` trong schema cũ không còn là quyền điều chỉnh
  theo chính sách hiện tại.
- Khoảng nghỉ được cấu hình cho Main Tasks không áp dụng cho Secondary Tasks.
  Không chèn khoảng nghỉ tùy ý giữa hai task phụ, bất kể chúng cùng hay khác
  nhóm.
- Vị trí slot của task trong Sheet không xác định thứ tự thực hiện. Thứ tự lịch
  cần dựa trên ngữ cảnh sinh hoạt và sự hợp lý khi phối hợp với Main Tasks.

Ưu tiên giữ task trong khung nguồn; chỉ dùng ngoại lệ chuyển sang TỐI khi
ngữ cảnh task cho phép. Nếu vẫn không xếp được, phải giữ task và CLOCK dự
phòng để preview thể hiện xung đột, không làm sai dữ liệu nguồn.

## 3.4. Khoảng nghỉ giữa các loại task

Khoảng nghỉ cấu hình trong pilot là quy tắc dành cho Main Tasks theo
`schedule_settings`. Không áp dụng quy tắc này cho Secondary Tasks.

Các task phụ có thể xếp sát nhau nếu không chồng lấn và vẫn hợp lý với khung
buổi, task Main, cùng ngữ cảnh sinh hoạt. Không tạo buffer chỉ vì đổi nhóm.

## 3.5. Không làm mất dữ liệu

Mỗi công việc đầu vào phải được bảo toàn.

Validator phải phát hiện:
- Công việc bị mất.
- Công việc bị nhân đôi.
- Công việc không có trong dữ liệu nguồn nhưng xuất hiện trong lịch.
- Công việc có thời lượng không hợp lệ.
- Công việc bị đặt sai khung thời gian.

Không được xem việc loại bỏ công việc là một phương pháp tối ưu hóa.

---

# PHẦN IV. TRIẾT LÝ TỐI ƯU THỜI LƯỢNG

## 4.1. Lựa chọn chính thức

Người dùng đã lựa chọn:

**C – CÂN BẰNG CÓ XÉT ĐẾN CHẤT LƯỢNG (BALANCE WITH QUALITY CONSIDERATION).**

Đây là triết lý điều chỉnh thời lượng chính thức của dự án.

## 4.2. Ý nghĩa của thời lượng mặc định

Thời lượng mặc định phản ánh mức độ đầu tư thời gian dự kiến cho một công việc.

Ví dụ:

- Một công việc học tập kéo dài 90 phút có thể cần thời gian để đọc, hiểu, thực hành và củng cố.
- Một công việc vệ sinh cá nhân 15 phút có tính linh hoạt thấp hoặc chỉ cần điều chỉnh rất nhỏ.
- Một công việc nghiên cứu chuyên sâu 120 phút có thể bị ảnh hưởng đáng kể nếu giảm xuống còn 45 phút.

Do đó, hai công việc có cùng thời lượng mặc định không nhất thiết có mức độ linh hoạt giống nhau.

## 4.3. Những yếu tố AI phải phân tích

Việc phân tích dưới đây bắt đầu sau khi trợ lý đã quét **toàn bộ** task list
và trước khi xét constraint hoặc xếp vào slot. Trước khi đề xuất vị trí hay
thay đổi thời lượng, trợ lý cần xem xét:

1. Tên công việc.
2. Nội dung mô tả.
3. Thời lượng mặc định.
4. Thời lượng tối thiểu và tối đa.
5. Mức độ phức tạp.
6. Khối lượng công việc.
7. Mức độ tập trung cần thiết.
8. Tầm quan trọng của chất lượng đầu ra.
9. Khả năng chia nhỏ công việc.
10. Khả năng rút ngắn mà không ảnh hưởng đáng kể đến kết quả.
11. Lịch sử hoàn thành và phản hồi trước đây, nếu có.

## 4.4. Nguyên tắc điều chỉnh

AI phải phân biệt:

**Công việc cần bảo vệ thời lượng:**
- Có độ phức tạp cao.
- Cần tập trung sâu.
- Cần thời gian thực hành.
- Chất lượng bị ảnh hưởng mạnh nếu rút ngắn.

**Công việc có khả năng linh hoạt:**
- Có thể rút ngắn mà không ảnh hưởng nhiều đến kết quả.
- Có thể chia nhỏ.
- Có thể thực hiện nhanh hơn trong điều kiện phù hợp.
- Có thể kéo dài nếu cần thiết.

Không áp dụng tỷ lệ tăng/giảm chung cho tất cả công việc.

AI cần giữ thời lượng gần với giá trị mặc định nhất có thể, trừ khi có lý do thực sự để điều chỉnh.

Nếu không đủ dữ liệu để đánh giá, AI phải thể hiện mức độ không chắc chắn và tránh điều chỉnh mạnh.

## 4.5. Mục tiêu tối ưu

Không phải tối ưu bằng cách làm cho mọi khoảng thời gian đều kín.

Mục tiêu là:

- Đảm bảo mọi công việc có đủ thời gian hợp lý.
- Bảo vệ chất lượng công việc quan trọng.
- Giải quyết tình trạng thiếu thời gian.
- Phân bổ thời gian cân bằng.
- Giảm các thay đổi không cần thiết.
- Hạn chế khoảng trống không có chủ đích.
- Không làm lịch trình quá dày đặc đến mức thiếu thời gian nghỉ và chuyển tiếp.

---

# PHẦN V. KIẾN TRÚC HỆ THỐNG

Các thành phần Gemini, OR-Tools, Self-Reviewer và Iteration Controller được mô
tả dưới đây là kiến trúc mục tiêu, chưa phải tính năng tự động trong pilot.
Hiện tại người dùng trao đổi trực tiếp với trợ lý VS Code; extension đảm nhiệm
preview, kiểm tra tất định đã triển khai và ghi có xác nhận. Không có Gemini
API call hoặc tự động lặp nhiều vòng nền.

## 5.1. Tổng quan

Hệ thống gồm các thành phần chính:

1. Data & Context Engine.
2. Gemini Workload Analyzer.
3. Gemini Planner.
4. Scheduling Engine.
5. Constraint Validator.
6. Gemini Self-Reviewer.
7. Iteration Controller.
8. Final Plan & Approval.
9. Report & History Manager.

## 5.2. Vai trò của từng thành phần

### A. Data & Context Engine

Nhiệm vụ:
- Đọc dữ liệu đầu vào.
- Chuẩn hóa dữ liệu.
- Xử lý ô gộp và forward-fill.
- Phân biệt công việc chính và phụ.
- Xác định các Start Time cố định.
- Kiểm tra dữ liệu thiếu hoặc sai định dạng.
- Đưa dữ liệu về cấu trúc JSON thống nhất.

Không để Gemini tự đọc trực tiếp những vùng dữ liệu Sheets phức tạp trong từng bước tính toán.

### B. Workload Analyzer

Nhiệm vụ:
- Phân tích ý nghĩa công việc.
- Ước lượng khối lượng và độ phức tạp.
- Đánh giá mức độ tập trung.
- Đánh giá khả năng thay đổi thời lượng.
- Đưa ra nhận định về chất lượng nếu tăng hoặc giảm thời lượng.
- Đánh giá độ tin cậy của nhận định.

Kết quả phải có cấu trúc dữ liệu rõ ràng.

Ví dụ:

{
  "task_id": "TASK_001",
  "complexity": "high",
  "focus_requirement": "high",
  "quality_sensitivity": "high",
  "duration_flexibility": "low",
  "recommended_duration": 90,
  "confidence": 0.85,
  "reasoning_summary": "Công việc cần thời gian tập trung sâu."
}

Đây chỉ là ví dụ về cấu trúc, không phải kết quả phân tích cố định.

### C. Planner

Nhiệm vụ:
- Tiếp nhận dữ liệu đã phân tích.
- Xác định vấn đề của lịch trình.
- Đề xuất phương án điều chỉnh.
- Đề xuất thời lượng mới cho các công việc linh hoạt.
- Đề xuất thứ tự và vị trí phù hợp.
- Giải thích lý do thay đổi.

Planner không được trực tiếp quyết định rằng lịch hợp lệ.

### D. Scheduling Engine

Sử dụng Python và Google OR-Tools.

Nhiệm vụ:
- Chuyển các đề xuất thành bài toán tối ưu.
- Tính toán vị trí bắt đầu và kết thúc.
- Xử lý các khoảng thời gian.
- Đảm bảo các ràng buộc cứng.
- Tìm phương án khả thi.
- Tối ưu các mục tiêu mềm theo thứ tự ưu tiên.

Không giao việc tính toán chính xác từng phút cho Gemini.

### E. Constraint Validator

Đây là bộ phận kiểm tra độc lập.

Không sử dụng kết luận của Gemini làm bằng chứng xác nhận lịch hợp lệ.

Phải kiểm tra:
- Fixed Start Time.
- Fixed Duration.
- Min/Max Duration.
- Không trùng lịch.
- Không mất công việc.
- Không trùng lặp công việc.
- Công việc phụ không vượt khung.
- Khoảng nghỉ cấu hình giữa Main Tasks; không yêu cầu khoảng nghỉ khi Secondary
  Tasks đổi nhóm.
- Tính liên tục và hợp lệ của thời gian.
- Các quy tắc khác được xác định trong cấu hình.

Lỗi cấu trúc/toàn vẹn nguồn và thay đổi trường cố định luôn chặn ghi. Lỗi thời
gian vẫn phải được validator báo riêng; theo chính sách người dùng hiện hành,
chỉ được tiếp tục ghi khi người dùng xác nhận rõ ràng. Việc ghi có cảnh báo
không đồng nghĩa candidate đã đạt nghiệm thu hoặc không còn vi phạm thời gian.

### F. Self-Reviewer

Đây là thành phần quan trọng, tạo ra khả năng tự phản biện.

Self-Reviewer phải hoạt động độc lập với vai trò Planner, kể cả khi sử dụng
cùng một model.

Nhiệm vụ:
- Đánh giá lịch sau khi Scheduler tạo ra.
- Kiểm tra việc phân bổ thời lượng.
- Phát hiện công việc bị ép thời gian.
- Phát hiện lịch quá dày đặc.
- Phát hiện những thay đổi không có lý do hợp lý.
- Đánh giá chất lượng công việc.
- Đưa ra đề xuất cải thiện.

Reviewer phải được cung cấp:
- Dữ liệu đầu vào.
- Thời lượng mặc định.
- Thời lượng sau điều chỉnh.
- Lý do điều chỉnh.
- Kết quả mô phỏng.
- Kết quả Validator.
- Các thay đổi từ vòng trước.

Reviewer không được yêu cầu Validator bỏ qua lỗi.

### G. Iteration Controller

Điều phối toàn bộ vòng lặp:

ANALYZE → PLAN → SIMULATE → VALIDATE → REVIEW → REVISE → FINALIZE

Quy định:
- Tối đa 5 vòng tối ưu.
- Có thể dừng sớm nếu đạt chất lượng yêu cầu.
- Không lặp lại cùng một phương án không có thay đổi.
- Không tiếp tục nếu lỗi dữ liệu đầu vào chưa được giải quyết.
- Lưu lại kết quả từng vòng.
- Nếu hết số vòng mà chưa có phương án hợp lệ, báo cáo thất bại.

### H. Final Plan & Approval

Chỉ tạo kết quả cuối cùng khi:
- Không vi phạm ràng buộc cứng.
- Không thiếu công việc.
- Không có xung đột.
- Đạt tiêu chí chất lượng.
- Có báo cáo đầy đủ.

Người dùng phải xem trước và phê duyệt trước khi chuyển dữ liệu sang hệ thống chính thức.

---

# PHẦN VI. THỨ TỰ ƯU TIÊN TỐI ƯU

Hệ thống phải sử dụng tư duy ưu tiên theo tầng (Lexicographic Optimization).

Không được đánh đổi một ràng buộc cứng để đạt điểm chất lượng cao hơn.

Thứ tự:

1. Bảo toàn toàn bộ công việc có Start Time cố định.
2. Bảo đảm công việc phụ nằm trong đúng khung thời gian.
3. Không mất, không trùng và không chồng chéo công việc.
4. Tuân thủ giới hạn thời lượng Min/Max.
5. Bảo vệ chất lượng và khối lượng công việc.
6. Cân bằng phân bổ thời gian giữa các khung.
7. Giảm khoảng trống không cần thiết.
8. Giảm số lượng thay đổi thời lượng và vị trí không cần thiết.

Các mục từ 1 đến 4 là nhóm điều kiện bắt buộc.

Các mục từ 5 đến 8 là mục tiêu tối ưu, cần được cân nhắc theo thứ tự ưu tiên.

---

# PHẦN VII. QUY TRÌNH HOẠT ĐỘNG HOÀN CHỈNH

### Luồng pilot đang sử dụng

1. Hoàn tất **Chuẩn hóa dữ liệu** trên Apps Script Web App, tải JSON và chép
   nguyên bản vào `transfers/incoming`.
2. Mở **Scheduler: Open Weekly Preview** và chọn **Optimize locally**. OR-Tools
   tạo bản nháp `transfers/optimized`; preview lưới tuần tự cập nhật theo file.
3. Extension validate và chỉ ghi vào Scheduler Database sau khi người dùng
   chọn nút import. Extension không ghi Calendar.
4. Chọn tab vừa ghi trong Calendar section của Web App; preview và đồng bộ
   Calendar test tiếp tục theo luồng hiện tại.

### Quy trình kiến trúc mục tiêu (chưa triển khai tự động)

## Bước 1. Import dữ liệu

Đọc dữ liệu từ JSON trước.

Sau này mới tích hợp kết nối Google Sheets.

## Bước 2. Kiểm tra dữ liệu

Kiểm tra:
- Thiếu trường.
- Sai định dạng.
- Thời lượng không hợp lệ.
- Start Time sai.
- Khung thời gian không hợp lệ.
- Group bị thiếu.
- Dữ liệu trùng lặp.

Nếu dữ liệu lỗi nghiêm trọng, dừng trước khi gọi Gemini.

## Bước 3. Phân tích công việc

Gemini Workload Analyzer đánh giá từng công việc.

Tạo hồ sơ phân tích cho từng task.

## Bước 4. Phân tích lịch hiện tại

Xác định:
- Tổng thời gian khả dụng.
- Tổng thời lượng công việc.
- Các khoảng cố định.
- Các khoảng thiếu thời gian.
- Các khoảng trống.
- Các nhóm công việc phụ.
- Những công việc có khả năng điều chỉnh.

## Bước 5. Lập phương án

Gemini Planner đưa ra phương án đề xuất.

Mỗi đề xuất phải nêu:
- Task ID.
- Duration cũ.
- Duration mới.
- Vị trí cũ.
- Vị trí mới.
- Lý do.
- Mức độ tin cậy.

## Bước 6. Tính toán

OR-Tools tìm lịch khả thi theo các ràng buộc.

Không để AI tự tính và tự xác nhận vị trí từng task.

## Bước 7. Mô phỏng

Tạo timeline thực tế.

Phát hiện:
- Chồng chéo.
- Thiếu thời gian.
- Vượt khung.
- Vi phạm thời gian nghỉ.
- Các vấn đề về phân bổ.

## Bước 8. Validate

Validator kiểm tra độc lập.

Nếu vi phạm ràng buộc cứng:
- Không được thông qua.
- Ghi nhận lỗi.
- Chuyển thông tin lỗi cho Planner để điều chỉnh nếu lỗi có thể khắc phục.

## Bước 9. Self-Review

Gemini Reviewer đánh giá chất lượng.

Reviewer cần trả lời:
- Lịch đã khả thi chưa?
- Công việc nào bị rút ngắn đáng lo ngại?
- Công việc nào cần thêm thời gian?
- Thời lượng sau điều chỉnh có hợp lý không?
- Có phương án nào tốt hơn không?
- Có thay đổi nào không cần thiết không?

## Bước 10. Revise

Nếu chưa đạt:
- Planner nhận phản hồi.
- Tạo phương án mới.
- Scheduler tính toán lại.
- Validator kiểm tra lại.
- Reviewer đánh giá lại.

Tối đa 5 vòng.

## Bước 11. Finalize

Nếu đạt yêu cầu:
- Xuất lịch cuối cùng.
- Xuất báo cáo thay đổi.
- Lưu lịch sử.
- Chờ người dùng phê duyệt.

Nếu không đạt:
- Xuất báo cáo lý do.
- Nêu những ràng buộc không thể thỏa mãn.
- Không import.

---

# PHẦN VIII. KIẾN TRÚC THƯ MỤC ĐỀ XUẤT

Tên thư mục gốc:

AI_ADAPTIVE_SCHEDULER

Cấu trúc ban đầu:

AI_ADAPTIVE_SCHEDULER/
│
├── main.py
├── config.py
├── requirements.txt
├── .env
├── .env.example
├── .gitignore
├── README.md
├── PROJECT_CONTEXT.md
│
├── data/
│   ├── input/
│   │   └── sample_day.json
│   ├── output/
│   └── history/
│
├── ai/
│   ├── gemini_client.py
│   ├── workload_analyzer.py
│   ├── planner.py
│   └── reviewer.py
│
├── scheduler/
│   ├── optimizer.py
│   ├── constraints.py
│   ├── duration_manager.py
│   └── timeline_builder.py
│
├── validation/
│   ├── validator.py
│   └── quality_checker.py
│
├── simulation/
│   ├── simulator.py
│   ├── scenario_runner.py
│   └── report_generator.py
│
├── integration/
│   ├── sheets_reader.py
│   └── calendar_exporter.py
│
└── tests/
    ├── test_input_data.py
    ├── test_fixed_tasks.py
    ├── test_duration_limits.py
    ├── test_secondary_tasks.py
    ├── test_overflow.py
    ├── test_no_overlap.py
    ├── test_validator.py
    └── test_self_review.py

Có thể điều chỉnh cấu trúc khi phát triển, nhưng phải giữ được sự tách biệt giữa AI, Scheduler, Validator, Simulation và Integration.

Không cần tạo tất cả file ngay từ đầu.

---

# PHẦN IX. LỘ TRÌNH PHÁT TRIỂN

## GIAI ĐOẠN 1 — ROUND-TRIP MAIN + SECONDARY TASKS QUA VS CODE

Trạng thái triển khai: **Code và regression tests cho Main + Secondary Tasks đã
được cập nhật; OR-Tools CP-SAT cục bộ đã tích hợp vào Weekly Preview.** Cần
kiểm thử dữ liệu tuần thật ở preview; không ghi Sheet/Calendar trong lần thử
này. Apps Script export/Calendar test flow hiện có vẫn được giữ.

Mục tiêu:
Giữ nguyên tích hợp Apps Script đang hoạt động và bổ sung luồng JSON để người
dùng có thể yêu cầu trợ lý VS Code tối ưu lịch mà không cần Gemini API.

Các thành phần:
1. [x] Transfer JSON có `format`, `schema_version`, `kind`, nguồn, cấu hình,
   task records, truy xuất nguồn và fingerprint.
2. [x] Nút **Chuẩn hóa dữ liệu** và **Tải về JSON** trên Apps Script.
3. [x] Extension VS Code tạo/dùng lại một working draft trong
   `transfers/optimized`, hiển thị preview lưới tuần động và theo dõi các lần
   lưu draft.
4. [x] Extension kiểm tra input/draft, ghi trực tiếp qua Sheets API vào
   workbook ID cố định, giữ header/format và xác minh dữ liệu đọc lại.
5. [x] Apps Script Calendar UI liệt kê/chọn được tab tuần do extension ghi.
6. [x] Bỏ đường upload optimized khỏi Apps Script; VS Code extension là đường
   import duy nhất cho bản nháp đã tối ưu.
7. [x] Test extension cho schema/lịch/rows và hồi quy Apps Script.
8. [x] Đọc/ghi Secondary Tasks riêng tại `M:Y`; kiểm tra duration/window,
   Calendar title/color và loại `Ngủ khuya`.

VSIX mới dự kiến: `vscode_extension/ai-adaptive-scheduler-0.3.1.vsix` (schema
v4, Secondary Tasks). Các hướng dẫn vận
hành và schema: `VSCODE_OPTIMIZATION_WORKFLOW.md` và
`SCHEDULER_TRANSFER_SCHEMA.md`. Trước khi dùng cần cài VSIX một lần, dùng OAuth
token có Sheets scope, và xác minh import bằng tài khoản test. Không tuyên bố
extension đã thực hiện live write chỉ từ việc unit tests đạt.

Điều kiện hoàn thành:
- JSON schema v4 đầu vào tải về được và chứa đầy đủ Main Tasks, generated
  `Ngủ đêm` và Secondary Tasks với trường nguồn, duration, window, ICON/COLOR.
- Flexible Main Task có CLOCK rỗng; fixed Main Task và task ngủ giữ đúng CLOCK.
- Draft từ file được validate độc lập trước khi ghi.
- Thiếu/trùng task, sửa fixed anchor, duration vượt cap hoặc CLOCK sai đều bị
  từ chối.
- Extension tests và Apps Script regression tests đều đạt.

### Quy tắc thứ tự ưu tiên trong luồng VS Code

1. Không vi phạm fixed Start Time/Duration, task ngủ, dữ liệu nguồn hoặc
   completeness.
2. Không overlap; đáp ứng thời gian nghỉ đã cấu hình cho Main Tasks.
3. Giữ nguyên duration linh động nếu có lịch khả thi; nếu cần giảm, tuân thủ
   pilot cap đã xác nhận và giải thích từng thay đổi.
4. Tôn trọng thứ tự READY làm ưu tiên, nhưng có thể đổi `schedule_order` để
   tăng tính khả thi/chất lượng. `source_order` luôn bất biến và lưu dấu thứ tự
   gốc.
5. Cân nhắc ngữ cảnh mô tả và thời điểm phù hợp; trợ lý phải nêu lý do, không
   tự biến suy luận thành HARD CONSTRAINT mới.
6. Preview luôn hiển thị các task có CLOCK hợp lệ, kể cả khi có lỗi hoặc
   chồng lấn; các block chồng lấn được đặt cạnh nhau. Chỉ khi extension
   validator chấp nhận và người dùng xác nhận mới thay snapshot Scheduler
   Database.

## GIAI ĐOẠN 2 — BỘ TỐI ƯU TẤT ĐỊNH CÓ THỂ TÁI LẬP

Mục tiêu:
Xây dựng/hoàn thiện bộ tính toán lịch chính xác, có thể chạy lặp lại và không
phụ thuộc vào model AI. Trợ lý có thể đề xuất ưu tiên mềm; bộ máy và validator
mới quyết định tính khả thi.

Công việc:
1. Xây dựng mô hình công việc.
2. Xây dựng biến thời gian.
3. Thiết lập fixed task.
4. Thiết lập Min/Max Duration.
5. Thiết lập period boundaries.
6. Thiết lập khoảng nghỉ 15 phút cho Main Tasks; Secondary Tasks không dùng
   khoảng nghỉ này.
7. Thiết lập no-overlap.
8. Thiết lập hàm mục tiêu tối ưu.
9. Xây dựng kết quả timeline.

Điều kiện hoàn thành:
- Tính được lịch khả thi.
- Không vi phạm fixed task.
- Không vượt period.
- Không trùng lịch.
- Không mất task.
- Báo cáo được trường hợp không có nghiệm.

## GIAI ĐOẠN 3 — XÂY DỰNG VALIDATOR

Mục tiêu:
Có một hệ thống kiểm tra độc lập trước khi tích hợp AI.

Công việc:
1. Kiểm tra fixed task.
2. Kiểm tra duration limits.
3. Kiểm tra period boundaries.
4. Kiểm tra khoảng nghỉ của Main Tasks; không áp dụng validator break cho
   Secondary Tasks.
5. Kiểm tra overlap.
6. Kiểm tra task completeness.
7. Kiểm tra tính hợp lệ của timeline.

Điều kiện hoàn thành:
Tạo được các test cố tình đưa ra lịch sai và Validator phải phát hiện đúng lỗi.

## GIAI ĐOẠN 4 — PHÂN TÍCH WORKLOAD CÓ CẤU TRÚC (TƯƠNG LAI, CHƯA CHỐT PROVIDER)

Không nằm trong luồng pilot hiện tại. Người dùng hiện dùng trợ lý đang đăng
nhập trong VS Code; không tự tích hợp Gemini API hoặc yêu cầu API key. Chỉ xem
xét gọi model qua API nếu người dùng yêu cầu riêng.

Mục tiêu:
Hỗ trợ đánh giá workload có cấu trúc nếu sau này cần tự động hóa ngoài trợ lý
VS Code.

Công việc:
1. Chốt provider và quyền riêng tư trước khi tích hợp API.
2. Xây dựng prompt phân tích.
3. Xây dựng schema JSON.
4. Phân tích workload.
5. Phân tích quality sensitivity.
6. Phân tích duration flexibility.
7. Đánh giá confidence.
8. Xử lý lỗi API và dữ liệu trả về không hợp lệ.

Điều kiện hoàn thành:
Gemini phân tích được nhiều loại công việc khác nhau và không áp dụng một quy tắc điều chỉnh thời lượng chung.

## GIAI ĐOẠN 5 — PLANNER TỰ ĐỘNG (TƯƠNG LAI, CHƯA TRIỂN KHAI)

Mục tiêu:
AI có thể đưa ra đề xuất điều chỉnh lịch.

Công việc:
1. Xây dựng Planner prompt.
2. Xây dựng schema đề xuất.
3. Đưa dữ liệu phân tích vào Planner.
4. Đề xuất thay đổi duration.
5. Đề xuất thay đổi vị trí.
6. Giải thích từng thay đổi.
7. Kiểm tra đề xuất trước khi đưa vào Scheduler.

Điều kiện hoàn thành:
Planner không đề xuất thay đổi những task bị khóa.

## GIAI ĐOẠN 6 — SELF-REVIEW VÀ ITERATION TỰ ĐỘNG (TƯƠNG LAI)

Mục tiêu:
Xây dựng khả năng tự phản biện và tự điều chỉnh.

Công việc:
1. Xây dựng Reviewer prompt độc lập.
2. Đánh giá kết quả Scheduler.
3. So sánh lịch với dữ liệu ban đầu.
4. Phân tích các thay đổi duration.
5. Đề xuất cải thiện.
6. Xây dựng Iteration Controller.
7. Giới hạn tối đa 5 vòng.
8. Chống lặp vô ích.
9. Lưu lịch sử từng vòng.

Điều kiện hoàn thành:
Có thể chứng minh hệ thống thực hiện được nhiều vòng tối ưu và kết quả sau cùng được kiểm tra lại.

## GIAI ĐOẠN 7 — MÔ PHỎNG VÀ BÁO CÁO

Mục tiêu:
Cho người dùng xem toàn bộ quá trình trước khi chấp thuận.

Báo cáo cần có:
- Lịch ban đầu.
- Lịch sau tối ưu.
- Duration cũ và mới.
- Các vị trí thay đổi.
- Lý do thay đổi.
- Kết quả Validator.
- Nhận xét Reviewer.
- Số vòng tối ưu.
- Các vấn đề chưa giải quyết.
- Kết luận có thể import hay không.

## GIAI ĐOẠN 8 — MỞ RỘNG TÍCH HỢP GOOGLE SHEETS (TƯƠNG LAI)

Pilot đã có Apps Script đọc/chuẩn hóa nguồn và VS Code extension ghi vào một
workbook Scheduler Database cố định. Giai đoạn này chỉ dành cho việc mở rộng
đọc dữ liệu trực tiếp trong VS Code hoặc nhiều nguồn/đích; không được thay đổi
scope đích, quyền OAuth hay luồng ghi hiện có khi chưa được duyệt.

Công việc:
1. Xác định phương thức đọc Google Sheets.
2. Kết nối dữ liệu thật.
3. Chuẩn hóa dữ liệu theo schema nội bộ.
4. So sánh dữ liệu đọc với dữ liệu Sheets.
5. Kiểm tra nhiều ngày.
6. Không có quyền ghi vào Calendar chính thức.

## GIAI ĐOẠN 9 — MỞ RỘNG TÍCH HỢP SMART CALENDAR SYNC V3.2

Calendar test flow hiện chạy qua Apps Script Web App. Mở rộng thêm khả năng
hoặc nối Calendar chính thức chỉ thực hiện sau khi có sự chấp thuận rõ ràng.

Nguyên tắc:
- Không phá vỡ kiến trúc đồng bộ hiện có.
- Không tự ý thay thế toàn bộ Apps Script.
- AI Scheduler chỉ xuất dữ liệu theo định dạng tương thích.
- Cơ chế import phải được kiểm tra riêng.
- Có cơ chế preview và approval.
- Có khả năng quay lại dữ liệu trước đó nếu cần.

---

# PHẦN X. MÔI TRƯỜNG PHÁT TRIỂN VÀ AN TOÀN

## 10.1. Ba môi trường

**SANDBOX**
- Chỉ sử dụng JSON mẫu.
- Không kết nối Google Calendar.
- Không có quyền ghi dữ liệu thật.
- Dùng để phát triển và kiểm thử.

**STAGING**
- Sử dụng dữ liệu Google Sheets thật hoặc bản sao.
- Có thể thử nghiệm với Calendar riêng.
- Không ghi vào Calendar chính thức.

**PRODUCTION**
- Chỉ triển khai khi được người dùng phê duyệt.
- Có kiểm tra dữ liệu.
- Có preview.
- Có xác nhận trước khi import.

## 10.2. Bảo mật

- Gemini API key không cần cho pilot; chỉ lưu trong secret store nếu provider
  API được người dùng yêu cầu trong tương lai.
- Không đưa credentials/token vào mã nguồn.
- OAuth credentials và refresh token ở `%LOCALAPPDATA%\AI_Adaptive_SCHEDULER`,
  ngoài workspace/OneDrive.
- Không ghi token, API key hay dữ liệu xác thực vào log.
- Không tự động thực hiện hành động ghi dữ liệu ngoài phạm vi được phê duyệt.

## 10.3. Công nghệ theo kiến trúc mục tiêu

- Python cho optimizer/engine tương lai; không cần chạy thủ công trong pilot.
- VS Code assistant trong pilot; không gọi model API tự động.
- Google OR-Tools.
- Pydantic hoặc thư viện tương đương để xác thực schema.
- Pytest.
- Google Sheets API khi đến giai đoạn tích hợp.

Không tự chọn hoặc cài model API. Việc dùng provider/API cần người dùng xác
nhận riêng; pilot hiện tại dựa vào trợ lý trong VS Code.

---

# PHẦN XI. TIÊU CHÍ NGHIỆM THU CUỐI CÙNG

Dự án chỉ được coi là hoàn thành khi đáp ứng các tiêu chí sau:

Người dùng có thể xác nhận ghi một candidate còn timing issue theo chính sách
hiện hành. Đây là ngoại lệ ghi có cảnh báo, không phải bằng chứng lịch đạt các
tiêu chí nghiệm thu dưới đây; kết quả vẫn phải được báo là còn lỗi thời gian.

### A. Về dữ liệu
- Đọc đúng dữ liệu.
- Không mất task.
- Không nhân đôi task.
- Nhận diện đúng fixed task.
- Nhận diện đúng các khung thời gian và nhóm.

### B. Về tính toán
- Không có task chồng chéo.
- Không vi phạm Start Time.
- Không vi phạm Duration Limits.
- Không vượt khung công việc phụ.
- Áp dụng khoảng nghỉ cấu hình chỉ cho Main Tasks; không chèn khoảng nghỉ
  giữa Secondary Tasks khi đổi nhóm.
- Phát hiện được trường hợp không thể lập lịch.

### C. Về AI
- Trợ lý đang được người dùng sử dụng trong VS Code hiểu được nội dung công việc.
- Phân tích được mức độ phức tạp.
- Biết cân nhắc chất lượng khi thay đổi duration.
- Không thay đổi thời lượng một cách máy móc.
- Có lý do cho từng đề xuất.
- Có thể nhận phản hồi và sửa cùng bản nháp trước khi duyệt import.

### D. Về Self-Review
- Có Planner và Reviewer tách biệt về vai trò.
- Có vòng lặp tự đánh giá.
- Có giới hạn số vòng.
- Có lưu lịch sử.
- Có thể dừng khi đạt yêu cầu.
- Không tự xác nhận phương án sai là hợp lệ.

### E. Về triển khai
- Có báo cáo kết quả.
- Có chế độ preview.
- Có cơ chế phê duyệt.
- Không ghi Calendar chính thức khi chưa được chấp thuận.

---

# PHẦN XII. QUY TẮC LÀM VIỆC DÀNH CHO TRỢ LÝ AI TRONG VS CODE

Trợ lý AI trong VS Code phải đọc toàn bộ tài liệu này trước khi bắt đầu chỉnh sửa project.

## 12.1. Vai trò

Bạn là AI Software Engineer chịu trách nhiệm hỗ trợ xây dựng dự án AI ADAPTIVE SCHEDULING & SELF-REVIEW ENGINE.

Bạn cần hiểu toàn bộ mục tiêu và kiến trúc dự án, không chỉ xử lý từng yêu cầu riêng lẻ.

## 12.2. Quy tắc bắt buộc

1. Không tự ý thay đổi triết lý tối ưu C – Balance with Quality Consideration.
2. Với mọi yêu cầu AI lập hoặc tối ưu lịch, trước tiên phải quét toàn bộ task
   và đánh giá ý nghĩa/mức độ quan trọng; sau đó mới đối chiếu quy tắc và
   constraint. Tuân thủ trình tự chi tiết tại mục 12.3.
3. Không tự ý thay đổi các HARD CONSTRAINT hoặc trường dữ liệu bất biến.
4. Không tuyên bố các chức năng Self-Review/Iteration tự động của kiến trúc
   tương lai đã tồn tại trong pilot.
5. Không bỏ qua Validator.
6. Không dùng lời giải thích AI thay cho phép kiểm tra thời gian/constraint của
   extension validator.
7. Không tạo toàn bộ project trong một lần nếu chưa có thiết kế và kiểm thử từng thành phần.
8. Không sửa nhiều module không liên quan trong cùng một lần.
9. Không tự ý thêm tính năng ngoài phạm vi.
10. Không tự ý kết nối hoặc ghi dữ liệu vào Google Calendar chính thức.
11. Không tuyên bố một tính năng đã hoàn thành nếu chưa chạy kiểm thử thực tế.
12. Trước mỗi lần phát hành Apps Script Web App, cập nhật `APP_VERSION` ở đầu
    `apps_script_web/Code.gs`; giao diện hiển thị version đang được deploy để
    đối chiếu với mã nguồn.

## 12.3. Cách làm việc

Mỗi nhiệm vụ phát triển phải theo quy trình:

### Quy trình lập lịch dành riêng cho yêu cầu tối ưu lịch

Đây là thứ tự bắt buộc khi người dùng giao AI lập hoặc tối ưu lịch:

1. Đọc input/draft đúng tuần và lập danh mục đầy đủ mọi Main Task, Secondary
   Task được chọn và `Ngủ đêm`. Với từng task, nhận diện ít nhất tên, duration
   gốc, description, period/window nếu có và thông tin nguồn cần thiết. Không
   bắt đầu bằng việc phân loại task theo khóa cứng hoặc tìm khoảng trống.
2. Đọc ý nghĩa của tên và description; đánh giá mục tiêu, mức quan trọng, độ
   nhạy chất lượng với duration, mức tập trung, thời điểm phù hợp và quan hệ
   trước/sau nếu dữ liệu cho phép. Phân biệt dữ kiện nguồn với suy luận; đánh
   dấu điểm chưa rõ thay vì tự bịa.
3. Tạo phương án ngữ nghĩa sơ bộ: những task nào cần được bảo vệ về thời lượng,
   task nào phù hợp với từng thời điểm/buổi và thứ tự nào có ý nghĩa. Trước khi
   xuất phương án, tóm tắt độ bao phủ và các trade-off quan trọng; không cần
   chép lại nguyên văn toàn bộ description nếu danh sách dài.
4. Sau đó mới đối chiếu fixed start, cửa sổ, duration cap, break, khung Secondary
   và các quy tắc còn lại. Chọn phương án khả thi phù hợp ý nghĩa nhất; nếu
   quy tắc làm phương án ngữ nghĩa tốt nhất không khả thi, nêu rõ xung đột và
   phương án thay thế.
5. Chạy validator độc lập. Không để kết quả solver hoặc giải thích AI thay thế
   kiểm tra dữ liệu/thời gian.

**BƯỚC 1 — ĐỌC VÀ HIỂU**

Đọc những file liên quan trước khi chỉnh sửa.

**BƯỚC 2 — PHÂN TÍCH**

Xác định:
- Mục tiêu.
- Các module bị ảnh hưởng.
- Các ràng buộc liên quan.
- Rủi ro có thể phát sinh.

**BƯỚC 3 — ĐỀ XUẤT**

Nêu ngắn gọn phương án thực hiện trước khi có thay đổi lớn.

**BƯỚC 4 — TRIỂN KHAI**

Viết code hoàn chỉnh, đồng bộ với kiến trúc hiện tại.

**BƯỚC 5 — KIỂM THỬ**

Chạy các test liên quan.

**BƯỚC 6 — BÁO CÁO**

Nêu:
- File đã tạo.
- File đã sửa.
- Chức năng đã hoàn thành.
- Test đã chạy.
- Kết quả test.
- Vấn đề còn tồn tại.
- Bước tiếp theo.

## 12.4. Nguyên tắc quan trọng

Nếu phát hiện yêu cầu mới có khả năng làm thay đổi kiến trúc hoặc xung đột với các quy tắc đã xác định, hãy dừng và giải thích trước khi thực hiện.

Không tự đưa ra quyết định làm thay đổi các quy tắc cốt lõi của dự án.

Ưu tiên:
- Code dễ hiểu.
- Module độc lập.
- Có kiểm thử.
- Có log.
- Có khả năng mở rộng.
- Có khả năng truy vết.
- Dễ bảo trì.

Người dùng không phải lập trình viên chuyên nghiệp. Vì vậy, khi yêu cầu người dùng thao tác, cần hướng dẫn rõ ràng bằng các bước cụ thể, ưu tiên lệnh có thể sao chép và chạy trực tiếp trên Windows.

---

# PHẦN XIII. NHIỆM VỤ ĐẦU TIÊN CHO TRỢ LÝ MỚI

Khi người dùng đưa một `normalized_input` vào `transfers/incoming`, trợ lý cần:

1. Đọc `VSCODE_OPTIMIZATION_WORKFLOW.md`,
   `SCHEDULER_TRANSFER_SCHEMA.md`, `WEEKLY_SHEET_TO_CALENDAR_FLOW.md`,
   `CHUẨN HOÁ DATABASE.md`, `QUY_TAC_LAP_LICH.md` và các quy tắc liên quan
   trong tài liệu này.
2. Đọc nguyên bản file input và bản nháp `optimized_schedule` do extension
   mở/tạo. Xác định đúng cặp input–draft và tuần đích trước khi chỉnh.
3. Trước khi xét khóa cứng hay bố trí giờ, quét toàn bộ tên, duration gốc,
   period/window và description của các task trong input; lập nhận định về
   ý nghĩa, mức quan trọng và độ nhạy chất lượng.
4. Dựa trên nhận định đó đề xuất thứ tự/vị trí/duration có ý nghĩa; sau đó mới
   áp dụng các rule và giới hạn. Không tối ưu chỉ để lấp khoảng trống.
5. Tối ưu Main Tasks, Secondary Tasks và `Ngủ đêm` trong cùng bản nháp; không
   tạo thêm các bản preview/output cho từng vòng. Không giảm duration Secondary.
   Giải thích thay đổi và sửa bản nháp theo phản hồi người dùng.
6. Không sửa input, metadata bất biến hoặc `source_fingerprint`; không gọi
   Google API, không ghi Sheet/Calendar, và không tuyên bố đã import.
7. Dùng preview để quan sát các task có CLOCK, kể cả khi lịch còn lỗi hoặc
   chồng lấn. Lỗi cấu trúc/toàn vẹn chặn ghi; lỗi thời gian chỉ được bỏ qua
   sau xác nhận rõ ràng theo chính sách hiện hành. Không gọi lịch còn cảnh báo
   là lịch không lỗi.
8. Calendar cần preview và xác nhận riêng; không tự đồng bộ.
9. Sau khi import Sheet, dùng Apps Script Web App chọn tuần trong
   **Tuần trong Scheduler Database** để tiếp tục Calendar test flow. Không ghi
   vào Calendar chính thức.

---

# KẾT LUẬN

Mục tiêu cuối cùng là xây dựng một hệ thống AI có khả năng hiểu công việc, hiểu giá trị của thời gian, biết cân nhắc chất lượng, biết tự phản biện và có khả năng cải thiện phương án lập lịch thông qua nhiều vòng đánh giá.

Trong pilot hiện tại, **trợ lý VS Code đề xuất lịch**, **extension kiểm tra và
hiển thị preview**, **Google Sheets API ghi dữ liệu sau xác nhận**. Apps Script
tiếp tục đảm nhiệm chuẩn hóa nguồn và Calendar test flow.

Gemini API, OR-Tools, bộ điều phối AI tự động và Self-Reviewer độc lập là các
thành phần kiến trúc mục tiêu/tương lai, không phải tiền đề để sử dụng luồng
pilot hiện tại.

**Người dùng là người phê duyệt cuối cùng.**

Không một thành phần AI nào được phép tự ý phá vỡ các giới hạn đã thiết lập.

Đây là nền tảng kiến trúc và nguyên tắc phát triển chính thức của dự án AI ADAPTIVE SCHEDULING & SELF-REVIEW ENGINE.