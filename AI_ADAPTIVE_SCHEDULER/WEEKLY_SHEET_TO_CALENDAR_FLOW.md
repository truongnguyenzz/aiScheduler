# Luồng xử lý Sheet tuần → Scheduler Database → Google Calendar

## Mục đích và tài nguyên pilot

Google Apps Script Web App đọc Sheet edit theo tuần và xuất dữ liệu
`normalized_input`. Trợ lý VS Code đề xuất lịch trong một bản nháp có thể sửa;
extension VS Code xem trước lịch tuần và ghi lịch đã được người dùng duyệt vào
Scheduler Database test. Apps Script tiếp tục xem trước và import task vào
Calendar test. Khi AI được giao lập lịch, quy trình semantic-first trong
`PROJECT_CONTEXT.md`, `VSCODE_OPTIMIZATION_WORKFLOW.md` và
`QUY_TAC_LAP_LICH.md` được ưu tiên: hiểu toàn bộ task trước, áp dụng các rule
sau. Lỗi cấu trúc/toàn vẹn vẫn chặn; lỗi thời gian có thể được người dùng bỏ
qua sau xác nhận riêng theo chính sách hiện hành.

- Nguồn mặc định: `1S8ev72pAVVSWEruT7zPziOr954VyiLxPEkFL1sZB01I`, tab `TUẦN`.
- Nguồn tuần khác có thể nhập bằng ID/URL nếu giữ đúng cấu trúc mapping.
- Đích database cố định: `1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM`,
  workbook `Scheduler Database`.
- Calendar cố định: duy nhất Calendar test có tên `AI Scheduler API TEST`.
- Không kết nối Calendar chính thức trong pilot.

## Luồng sử dụng chính

1. Nhập ID/URL Sheet edit của tuần hiện tại.
2. Chọn giờ bắt đầu mặc định cho Main Task linh hoạt và khoảng nghỉ giữa các
   Main Tasks.
   Giá trị khởi điểm là 07:30 và 15 phút. Cấu hình giờ bắt đầu/thời lượng
   `Ngủ đêm` mặc định là 03:00/5 giờ; preview hiển thị tất cả cài đặt đã dùng.
3. Chọn **Chuẩn hóa dữ liệu**, sau đó **Tải về JSON**. Đây là bước bắt đầu của
   luồng VS Code: chỉ đọc nguồn, không ghi Database. `normalized_input` giữ
   fixed/sleep CLOCK và để CLOCK của task flexible trống.
4. Chép JSON không chỉnh sửa vào `transfers\incoming`. Mở lệnh
   **Scheduler: Open Weekly Preview** trong VS Code và chọn file input. Extension
   tạo hoặc dùng lại một bản nháp ổn định trong `transfers\optimized`; không
   xuất thêm ảnh/lưới xem trước thành file.
5. Yêu cầu trợ lý mở đúng file input và bản nháp, quét toàn bộ task cùng tên,
   duration, period/window, description và ngữ cảnh; đánh giá ý nghĩa, mức
   quan trọng và lập semantic plan trước khi rà khóa cứng hoặc tìm slot. Sau
   bước này, trợ lý đọc `VSCODE_OPTIMIZATION_WORKFLOW.md`,
   `PROJECT_CONTEXT.md`, `QUY_TAC_LAP_LICH.md`, `CHUẨN HOÁ DATABASE.md` và
   `SCHEDULER_TRANSFER_SCHEMA.md` để áp dụng policy. Trợ lý chỉ chỉnh bản nháp
   `optimized_schedule`; không sửa input, không ghi Google.
6. Xem các block trong lưới tuần 7 ngày × 24 giờ ở panel extension. Khi cần
   chỉnh, phản hồi cho trợ lý để cập nhật cùng bản nháp; panel tự nạp lại khi
   file được lưu. Lỗi cấu trúc/toàn vẹn chặn import; nếu chỉ còn timing issue,
   người dùng có thể tiếp tục sau khi xem rõ cảnh báo và xác nhận riêng.
7. Chọn **Write approved schedule to Scheduler Database** trong panel.
   Extension đọc lại input/bản nháp, validate, xác nhận workbook/tab/header,
   ghi `A2:J` bằng Sheets API, giữ header/format và đọc lại để xác minh. Thao
   tác này chỉ ghi Google Sheet, không ghi Calendar.
8. Trong Apps Script Web App, chọn đúng tuần tại **Tuần trong Scheduler
   Database**. Danh sách lấy từ các tab có header hợp lệ, kể cả tab được ghi từ
   VS Code. Chọn **Xem trước import Calendar**, sau đó chọn **Import vào Calendar
   test** để chọn ngày và cách đồng bộ.
9. Chọn xóa event Scheduler, tạo/cập nhật event, hoặc cả hai. Chọn **Bắt đầu
   đồng bộ** để quét Calendar hiện tại và xem danh sách event cùng thao tác dự
   kiến. Xác nhận áp dụng. Chỉ event có tag Scheduler và ngày nguồn thuộc lựa
   chọn mới bị xóa; event cá nhân và event không có tag được giữ nguyên.

Web App không còn nhận file lịch tối ưu. Bản nháp đã tối ưu chỉ được ghi vào
Scheduler Database từ VS Code extension sau khi người dùng duyệt preview.

Hướng dẫn deploy nằm trong `APPS_SCRIPT_WEB_APP_SETUP.md`. Deployment phải giới
hạn **Only myself** trong pilot. Không cần Python host, Cloud Run, HMAC secret,
hay service-account key.

## Quy tắc thứ tự và CLOCK

- Thứ tự nguồn mỗi ngày là READY từ trái sang phải:
  `O,Q,S,U,W,Y,AA,AC,AE,AG,AI,AK`. Ô trống được bỏ qua; các task còn lại không
  đổi thứ tự tương đối.
- JSON giữ `source_order` bất biến từ READY. Trong luồng ghi trực tiếp, `STT`
  giữ source order; trong luồng VS Code, `STT` được gán từ
  `schedule_order`. Calendar đọc theo STT thực tế đã ghi.
- Với AI-led optimization, `source_order` là thông tin/ưu tiên mềm chứ không
  thay cho việc đánh giá task. `schedule_order` có thể thay đổi khi semantic
  plan cho thấy thứ tự khác hợp lý hơn; cần giải thích các đảo thứ tự.
- Task có Start Time trong MASTER cột I giữ nguyên giờ bắt đầu và DURING; các
  Start Time trùng nhau, các khoảng fixed chồng nhau, hoặc fixed chồng với
  `Ngủ đêm` đều làm preview dừng với lỗi xung đột.
- Task không có Start Time được đặt vào các khoảng trống giữa giờ mặc định trong
  ngày và giờ mặc định ngày sau. Chúng không được chồng fixed task, `Ngủ đêm`
  hoặc task linh động khác. Các mốc cứng gần ngày kế tiếp cũng được tính.
- READY order là ưu tiên mềm. Hệ thống giảm thiểu việc đảo thứ tự giữa các task
  Main, nhưng có thể đổi thứ tự thời gian khi cần. Hệ thống cố giữ duration gốc
  cho mọi task trước khi cân nhắc giảm thời lượng.
- Chỉ khi không có lịch khả thi với duration gốc mới giảm duration task linh
  động (tối đa 15 phút nếu duration gốc ≤1 giờ, 30 phút nếu >1 giờ); tổng mức
  giảm được tối thiểu hóa. Task fixed và `Ngủ đêm` không bị giảm. Nếu không thể
  xếp đủ task trong các giới hạn này, preview dừng và báo lỗi.
- Mỗi ngày tự tạo đúng một task `Ngủ đêm`; description mặc định là
  `Ngủ đêm hôm nay`, nhưng Calendar import nhận diện task ngủ theo tên và không
  yêu cầu description khớp cố định. Task được thêm sau Main Tasks với STT tiếp
  theo và là mốc cứng. Giờ bắt đầu/thời lượng do người dùng cấu hình. Màu mặc
  định là xám trong database, bản xem trước và Google Calendar.
- Task có thể đi qua 00:00 nếu vẫn nằm trước khoảng mốc cứng tiếp theo; CLOCK có
  offset ngày và Calendar dùng ngày kết thúc thực tế. Lịch được tạo không có
  task chồng nhau.
- Nút **Xem trước import Calendar** hiển thị lưới tuần theo ngày và 24 khung giờ.
  Block có chiều cao theo DURING, hiện tên/giờ; các block chồng nhau nằm cạnh
  nhau, còn block tràn nửa đêm được chia qua cột ngày kế tiếp.
- Mặc định giao diện 07:30/15 phút theo giá trị được nêu trong mapping. Địa chỉ
  cấu hình thực tế V3.2 chưa xác minh; hai giá trị này không được mô tả là
  cấu hình V3.2 đã xác nhận. Người dùng có thể thay đổi trước preview.
- `DURING` lấy từ MASTER G theo giờ thập phân; với task được giảm, DURING lưu
  thời lượng đã xếp và DESCRIPTION giữ lại thời lượng gốc cùng mức điều chỉnh.
  CLOCK khớp với DURING thực tế.
- Luồng VS Code round-trip hiện chỉ hỗ trợ Main Tasks và Ngủ đêm. Secondary
  Tasks chưa được tích hợp vào transfer/schema hiện tại; thiết kế nguồn và
  nguyên tắc riêng được ghi trong `SECONDARY_TASK_DATA_SPEC.md`. Khi tích hợp,
  không áp dụng khoảng nghỉ Main Task cho task phụ, không chèn break giữa hai
  task phụ, và không coi vị trí slot nguồn là thứ tự thực hiện. Vùng dự kiến
  dành riêng trong Scheduler Database là `M:Y`; hiện chưa có cơ chế ghi task
  phụ vào vùng đó. Với Main Tasks, task thiếu tên liên kết, MASTER trùng tên,
  dữ liệu sai hoặc xung đột thứ tự đều phải báo lỗi, không âm thầm bỏ.

## Quyền truy cập và tính an toàn

- Web App chạy bằng tài khoản deploy; tài khoản cần quyền đọc nguồn, sửa
  Scheduler Database test và ghi Calendar test.
- Đích database và Calendar được giới hạn trong mã; header được kiểm tra trước
  khi ghi. Nguồn chỉ đọc.
- Cả Apps Script và VS Code extension đều validate trước khi ghi Database;
  preview riêng trước khi ghi Database và trước khi import Calendar.
- Snapshot cùng tuần được thay thế trong vùng task `A2:J`; header và định dạng
  được giữ. Extension direct import xóa giá trị task cũ thừa nếu bản mới ít dòng
  hơn; nguồn không bị sửa.
- Event đã import được nhận dạng bằng tag và cập nhật an toàn khi chạy lại;
  task biến mất khỏi nguồn không tự xóa Calendar event.
- Đồng bộ theo ngày lấy danh sách ngày/weekday trực tiếp từ `NGÀY` trong database,
  quét các event Calendar thật để đối chiếu, và yêu cầu xác nhận trước khi thay đổi.
- Luồng **Đọc và xem trước / Ghi vào Scheduler Database** vẫn dùng deterministic
  scheduler trong Apps Script. Luồng VS Code dùng trợ lý đang chạy trong VS
  Code và extension local; không gọi Gemini API. Extension kiểm tra bản nháp
  theo file input cục bộ và không phụ thuộc gate fingerprint của Web App.
