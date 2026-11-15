# Đặc tả đọc và sử dụng Secondary Tasks

## 1. Mục đích và phạm vi

Tài liệu này ghi nhận cách hiểu hiện tại về dữ liệu công việc phụ
(Secondary Tasks) trên các tab ngày trong Sheet edit: `THỨ HAI`, `THỨ BA`,
`THỨ TƯ`, `THỨ NĂM`, `THỨ SÁU`, `THỨ BẢY`, `CHỦ NHẬT`.

Đây là đặc tả nguồn, ánh xạ và lập lịch Secondary Tasks. Code hiện tại tích
hợp chúng vào preview, schema v4, validator, Sheets writer và Calendar
importer. Cập nhật code chưa đồng nghĩa với việc Apps Script đã deploy hoặc
VSIX mới đã được cài và xác minh live write.

## 2. Cấu trúc tab theo ngày

Các tab ngày có cùng bố cục cơ bản:

1. Danh mục công việc và thời lượng mặc định ở vùng `A1:F25`.
2. Khu vực phân bố và tổng hợp trong `H1:T17`; các lựa chọn task theo hàng
   nằm ở `J4:J16`, `L4:L16`, `N4:N16`, `P4:P16`.
3. Buổi/khung thời gian ở cột H; nhóm công việc ở cột I.

Theo xác nhận của người dùng, bảy tab `THỨ HAI` đến `CHỦ NHẬT` giống nhau về
cấu trúc; dữ liệu, lựa chọn task và ngày ở từng tab là khác nhau. Tab `THỨ HAI`
được dùng làm mẫu cấu trúc cho sáu tab còn lại. Trước khi triển khai bộ đọc,
vẫn cần kiểm tra thực tế các công thức/ô gộp và xử lý dữ liệu riêng của từng
tab.

### 2.1 Danh mục ở `A1:F25`

Danh mục mô tả loại công việc phụ, nội dung và thời lượng mặc định. Theo ảnh:

| Cột | Cách hiểu hiện tại |
|---|---|
| A | Nhãn nhóm lớn trình bày theo cụm/ô gộp (ví dụ SINH HOẠT, VỆ SINH, VẬN ĐỘNG, TIN TỨC, QUẢN TRỊ). |
| B | Nhãn `NHÓM`/nhóm của task (ví dụ SINH HOẠT, VỆ SINH, VẬN ĐỘNG). |
| C | Tên/mã task, dùng để nhận diện task (ví dụ AUS, AUT, AUC, Vệ sinh sáng, Tắm gội). |
| D | Mô tả task. |
| E | `TIME (giờ)`. |
| F | `TIME (phút)`. |

Hàng 1 chứa tiêu đề/ngày; hàng 2 chứa các tiêu đề cột; danh mục chiếm các hàng
còn lại trong `A1:F25`. Cột C là khóa tên task được chọn trong vùng phân bố.
Cột E và F biểu diễn thời lượng ở hai đơn vị; khi đọc phải kiểm tra quan hệ
giữa chúng và dùng dữ liệu phút đã nhúng ở vùng phân bố làm thời lượng được
chọn cho ngày, không âm thầm thay bằng giá trị suy ra khác.

### 2.2 Phân bố task trong `H1:T17`

Người dùng chọn các task cần có trong ngày ở các ô tên task. Các ô phút bên
cạnh được nối/nhúng trực tiếp từ danh mục; đó là thời lượng của task được chọn,
không phải thời lượng do bộ lập lịch suy ra.

Cách đọc theo bố cục người dùng mô tả và ảnh:

| Cột | Ý nghĩa |
|---|---|
| H | Buổi/khung thời gian; nhãn có thể gộp dọc. |
| I | Nhóm của task trong hàng. |
| J | Ô chọn/tên task cho slot 1. |
| K | Thời lượng slot 1, phút. |
| L | Ô chọn/tên task cho slot 2. |
| M | Thời lượng slot 2, phút. |
| N | Ô chọn/tên task cho slot 3. |
| O | Thời lượng slot 3, phút. |
| P | Ô chọn/tên task cho slot 4. |
| Q | Thời lượng slot 4, phút. |
| R:T | Các giá trị tổng hợp `TIME TỔNG` theo phút, giờ và dạng hiển thị. |

Các lựa chọn task nằm trong các hàng 4–16; hàng 17 là dòng tổng hợp/cảnh báo
trên biểu mẫu. Ô tên task trống không tạo task. Task được nhận diện bằng tên/mã
ở cột C của danh mục và liên kết về đúng bản ghi danh mục.

J/L/N/P là các vị trí lựa chọn để ghi nhận task thuộc một hàng/buổi, không
phải thứ tự thực hiện mặc định. Task có thể xuất hiện ở các slot khác nhau
trong cùng một buổi; thứ tự slot hoặc thứ tự đọc dữ liệu không chứng minh ý đồ
thời gian của người dùng. Tuy nhiên, STT tạm tính để liệt kê dữ liệu được xác
định bằng thứ tự trái sang phải rồi trên xuống dưới trong cùng một buổi; STT
này chỉ là thứ tự thống kê/tạm tính, không phải lịch thực hiện cuối cùng.

Các trường thời lượng nguồn Secondary Task luôn bất biến. Theo chính sách mới
nhất được người dùng xác nhận, thời lượng Secondary **không được giảm**, kể cả
khi đã thử vị trí nguồn và vị trí TỐI. Nếu không thể xếp đủ thời lượng, giữ
task và duration, hiển thị/báo cáo xung đột; không ghi
`scheduled_duration_minutes`, `scheduled_duration_hours` hoặc lý do giảm.
Tài liệu và code cũ có fallback giảm Secondary với safeguard 50%; đó là hành vi
legacy chưa đồng bộ, không phải quyền được dùng cho lịch mới. Người dùng cho
biết task phụ thông thường không quá 30 phút; task dài hơn cần kiểm tra riêng.
`Ngủ khuya` là ngoại lệ ở mục 4.

## 3. Khung buổi và giới hạn thời gian

Cột H chứa nhãn buổi; một số nhãn được gộp dọc. Khi đọc, cần forward-fill nhãn
buổi xuống các hàng thuộc cùng vùng gộp. Cột I là nhóm của task trong hàng đó,
không phải thời gian bắt đầu.

Các khung giờ hiện hành sau lần cập nhật Sheet:

| Buổi | Khung giờ |
|---|---|
| SÁNG | 06:00–10:00 |
| TRƯA | 10:00–14:00 |
| CHIỀU | 15:00–17:00 |
| TỐI | 17:00–23:00 |

Secondary Task không có Start Time riêng. Buổi gắn với hàng cho biết ngữ cảnh
và khung phân bố dự kiến; các khung giờ hiện hành là SÁNG 06:00–10:00, TRƯA
10:00–14:00, CHIỀU 15:00–17:00, TỐI 17:00–23:00. Mặc định không chuyển task
sang buổi khác hoặc để task tràn qua ranh giới buổi. Ngoại lệ đã được chấp
nhận: task vệ sinh cá nhân và giải trí có thể chuyển sang TỐI khi lịch Main
cố định khiến khung nguồn không khả thi; thông tin `period` nguồn không đổi,
còn `placement_period` và lý do được ghi riêng.

Các khoảng trên là **khung giờ được phép** lấy từ cấu hình hiện tại của Sheet.
Vị trí ưu tiên hợp lý bên trong mỗi khung (ví dụ ăn sáng ở đầu buổi SÁNG) là
ưu tiên mềm theo ngữ cảnh task; chỉ ngoại lệ chuyển TỐI vừa nêu mới được phép
đưa task ra ngoài khung giờ nguồn.

Secondary Tasks được gom theo BUỔI ở cột H. Giá trị `KHUNG GIỜ` trong vùng
đích được chuẩn hóa thành range thuần `HH:mm-HH:mm`, không chép phần chữ/AM-PM
từ giá trị hiển thị. Ví dụ: `SÁNG (6-10:00 am)` thành `06:00-10:00`;
`P7 (15:00-17:00)` thành `15:00-17:00`. BUỔI vẫn được ghi riêng.

Secondary Tasks không chịu khoảng nghỉ cấu hình giữa Main Tasks. Không có
break cứng giữa task phụ hoặc giữa Secondary với Main; lịch nền chỉ ưu tiên
khoảng đệm ngắn (10 phút) khi lựa chọn có thể thay thế, và vẫn cho phép xếp
sát nhau nếu cần. Validator chỉ chặn overlap, không áp dụng breakMinutes cho
Secondary.

Thời lượng task phụ thường nhỏ (tối đa 30 phút theo người dùng). Vì vậy lịch
cần ưu tiên xếp liền mạch, không tạo các khoảng đệm làm lãng phí thời gian.

Tất cả Secondary Tasks thông thường dùng cùng màu `MÀU HOA ANH ĐÀO` theo màu
đã chọn cho Calendar. Quy tắc này độc lập với mapping màu Main Task theo GI và
CLASS. Tên/mã màu nội bộ hoặc Calendar colorId cần được ánh xạ đúng khi viết
code; không thay thế bằng màu gần giống theo ý riêng. Nhãn `MÀU HOA ANH ĐÀO`
được ánh xạ sang Google Calendar `PALE_RED` / Flamingo (colorId `4`).

## 4. Task `Ngủ khuya`

`Ngủ khuya` luôn có mặt trong danh mục của cả bảy tab ngày và biểu diễn lịch
ngủ đêm đã được cấu hình riêng trong ứng dụng. Đây không phải Secondary Task
để đếm/xếp. Vì vậy:

- Tuyệt đối loại `Ngủ khuya` khỏi mọi danh sách, bảng tổng hợp, thống kê số
  lượng, tổng thời lượng/workload và các dòng Secondary Tasks được import.
- Không đưa `Ngủ khuya` trong vùng phân bố ngày vào tập Secondary Tasks.
- Không tạo thêm Calendar event `Ngủ khuya` từ tab ngày.
- Dùng task `Ngủ đêm` được sinh bởi cấu hình hiện có làm nguồn lịch ngủ duy
  nhất.
- Bộ đọc nên nhận diện task bằng tên/mã đã chuẩn hóa và báo lỗi nếu phát hiện
  một biến thể không nhận diện được thay vì âm thầm tạo event trùng.

## 5. Vai trò, ngữ cảnh và thứ tự thực hiện

Secondary Tasks chủ yếu duy trì hoạt động thể chất, vệ sinh, ăn uống và trạng
thái sinh hoạt của người dùng; chúng không phải một danh sách công việc năng
suất cần thực hiện đúng thứ tự ô. Chỉ thỏa giới hạn của cột H là chưa đủ để
bảo đảm một lịch sinh hoạt hợp lý. Ý nghĩa/mô tả task và quan hệ với Main Tasks
cần ảnh hưởng đến vị trí cuối cùng.

### Trình tự phân tích bắt buộc cho AI

Khi được yêu cầu sắp xếp/tối ưu lịch, AI phải quét **toàn bộ** danh sách của
tuần trước khi bắt đầu xếp slot hoặc phân loại các khóa cứng: tên task,
duration gốc, description, period/window và thông tin nhóm/ngữ cảnh của Main
Tasks, Secondary Tasks và `Ngủ đêm`. Sau đó AI mới đánh giá ý nghĩa, mức quan
trọng, độ nhạy chất lượng theo duration, thời điểm phù hợp và mối quan hệ giữa
các task.

Từ nhận định đó, AI lập semantic plan sơ bộ rồi mới dùng fixed start, khung
giờ, break, duration cap và các constraint để tìm phương án. Nếu quy tắc cản
phương án có ý nghĩa tốt nhất, phải giải thích task và chất lượng bị ảnh hưởng
thay vì tự động nhồi lịch vào khoảng trống. Với danh sách dài, có thể báo cáo
gọn độ bao phủ và các ưu tiên/ngoại lệ; không cần lặp lại nguyên văn mọi
description.

Các ví dụ đã được người dùng xác nhận về ngữ cảnh và hard constraints:

- `Vệ sinh sáng` (đánh răng, rửa mặt) nên diễn ra sớm trong buổi sáng, trước
  khi bắt đầu công việc chính phù hợp. Nếu vẫn nằm trong buổi sáng, phải hoàn
  tất trước Main Task cố định đầu tiên trong ngày; nếu lịch cố định chặn khung
  sáng, có thể cân nhắc ngoại lệ chuyển task vệ sinh cá nhân sang buổi TỐI.
- `AUS` (ăn uống sáng) nên ở phần đầu buổi sáng, không sát trưa. Hard
  constraint đã chốt: kết thúc không muộn hơn 10:00.

Thứ tự cột/vị trí lựa chọn của Secondary Task không được dùng thay cho thứ tự
thực hiện. AI nhận diện ngữ cảnh trước; sau đó scheduler dùng các mục tiêu
ngữ nghĩa như ưu tiên mềm bên cạnh constraint định lượng. Validator vẫn kiểm
tra độc lập dữ liệu và giờ. Timing issue phải được báo rõ; theo quyết định
người dùng, có thể tiếp tục sau xác nhận riêng, nhưng việc xác nhận không biến
candidate thành lịch không lỗi.

- Không xem Gemini/trợ lý AI là nguồn quyết định cuối cùng hoặc validator.
- Nếu thiếu dữ liệu ngữ cảnh, đánh dấu chưa xác định; không tự suy diễn thành
  một giờ cứng hay ý nghĩa chắc chắn.
- Không để việc kiểm tra constraint thay thế bước đọc/hiểu nội dung task.

## 6. Các bước đọc dữ liệu và quy trình lập lịch

Các bước nhận diện/chuẩn hóa dữ liệu bên dưới là chức năng đọc nguồn. Bước
semantic review là yêu cầu đối với trợ lý AI khi được giao lập lịch; bộ đọc và
CP-SAT hiện không tự hiểu mức quan trọng hay chất lượng task.

1. Chọn ngày theo header BUỔI/ngày của vùng phân bố và ánh xạ ngày từ tab
   `TUẦN`, không lấy ngày trong header của danh mục làm ngày task. Khi đọc thật
   `THỨ HAI`, vùng phân bố ghi `THỨ HAI` và `TUẦN!M16` là `09/11/2026`, trong
   khi header danh mục `A1:F25` hiển thị `THỨ BẢY`, `14/11/2026`.
2. Đọc danh mục `A1:F25` và vùng phân bố `H1:T17` bằng cả giá trị ô, giá trị
   hiển thị và công thức khi cần phân biệt tên task/thời lượng được nhúng.
3. Xử lý ô gộp/forward-fill cho nhãn nhóm lớn và buổi theo đúng cột.
4. Liên kết mỗi tên/mã ở các slot J/L/N/P về duy nhất một bản ghi danh mục.
   Không coi slot number là thứ tự thực hiện.
5. Đọc duration theo phút từ K/M/O/Q; đối chiếu với
   thời lượng danh mục và báo sai khác.
6. Loại `Ngủ khuya` khỏi mọi danh sách, bảng tổng hợp, thống kê, workload và
   dòng import vì lịch ngủ đã được sinh riêng.
7. Gắn từng task còn lại với BUỔI, range giờ thuần và nhóm ở cột I; xác định
   ICON theo mapping nhóm, màu hoa anh đào và ID ổn định từ nguồn.
8. Sau khi AI hoàn tất phân tích ngữ nghĩa cho toàn bộ task, thử đặt Secondary
   trong khung nguồn với duration đầy đủ, tránh overlap với fixed Main/sleep và
   các Secondary khác. Nếu không khả thi, chỉ vệ sinh cá nhân/giải trí đủ điều
   kiện được thử chuyển sang TỐI; tuyệt đối không giảm duration Secondary.
   Vệ sinh sáng ở buổi nguồn kết thúc trước fixed Main đầu tiên; bữa sáng kết
   thúc chậm nhất 10:00. Khoảng cách 10 phút chỉ là ưu tiên mềm, không phải
   break cứng. Duration Main chỉ được điều chỉnh theo chính sách Main đã chốt.

## 7. Vùng đích Secondary Tasks trong Scheduler Database

- Người dùng lưu Secondary Tasks trong `Scheduler Database!M:Y`, tách khỏi
  vùng Main Tasks `A:J`. Trước lần nhập thử, tab tuần
  `09/11 - 15/11/ 2026` có header ở hàng 1 và `M2:Y200` trống. Sau lần nhập
  được xác nhận, `M2:Y14` có 13 dòng Secondary Tasks của THỨ HAI; không suy ra
  các vùng khác luôn trống.

| Cột | Header hiện tại | Ý nghĩa dự kiến |
|---|---|---|
| M | NGÀY | Ngày task. |
| N | THỨ | Thứ trong tuần. |
| O | BUỔI | Buổi/khung được gắn với task. |
| P | KHUNG GIỜ | Range thuần `HH:mm-HH:mm` lấy từ nhãn buổi ở cột H. |
| Q | STT | STT tạm tính theo trái→phải, trên→dưới trong cùng BUỔI; không phải thứ tự thực hiện. |
| R | NHÓM | Nhóm task. |
| S | ICON | Biểu tượng nếu quy tắc tương ứng được xác nhận. |
| T | CÔNG VIỆC | Tên task từ danh mục cột C. |
| U | DESCRIPTION | Mô tả task. |
| V | DURING | Thời lượng theo giờ thập phân (15 phút = 0.25 giờ). |
| W | CLOCK | Giờ bắt đầu–kết thúc đã xếp; để trống trước khi có giờ bắt đầu cụ thể. |
| X | MÀU NỀN | `MÀU HOA ANH ĐÀO` cho mọi Secondary Task thông thường. |
| Y | ID TASK | Định danh task. |

Header được quan sát trực tiếp. `KHUNG GIỜ` được chuẩn hóa từ display value
cột H thành giờ thuần; STT tạm tính theo slot trái→phải, trên→dưới trong cùng
BUỔI; `ICON` theo nhóm
và màu nền của Secondary Tasks đã có quy tắc riêng dưới đây. Lần nhập thử dùng
`DURING` theo giờ thập phân, `CLOCK` để trống và `MÀU NỀN` là nhãn
`MÀU HOA ANH ĐÀO`. ID được sinh theo dạng `ADP-` + 24 ký tự hex viết hoa,
tương thích dạng ID Main Task đang có; các lần đồng bộ sau phải giữ ID của
bản ghi đã tồn tại, không tự sinh lại.

### Quy tắc ICON Secondary Tasks

ICON được xác định theo NHÓM task:

| NHÓM | ICON |
|---|---|
| VỆ SINH | 💦 |
| VẬN ĐỘNG | 💪 |
| TIN TỨC | 🌏 |
| SINH HOẠT | ⛅️ |

Các nhóm chưa liệt kê dùng cùng quy tắc phân loại ICON của Main Task dựa trên
thuộc tính phân loại tương ứng. Không tự tạo biểu tượng mới cho nhóm chưa có
mapping. Trong dữ liệu THỨ HAI đã đọc, nhóm `QUẢN TRỊ` không khớp nhóm ICON
Secondary nào; do không có thuộc tính CLASS/CATEGORY bổ sung trong nguồn này,
ICON của các task nhóm đó để trống theo fallback Main Task.

### Kết quả nhập thử THỨ HAI

- Ngày được ánh xạ từ `TUẦN!M16:N16` là `2026-11-09`, `THỨ HAI`. Không dùng
  ngày `14/11/2026` đang hiện ở header danh mục `A1:F25`.
- Nguồn có 14 lựa chọn, gồm `Ngủ khuya` 180 phút; sau khi loại `Ngủ khuya`
  còn 13 task, tổng thời lượng 345 phút (5.75 giờ).
- Số task theo buổi: SÁNG 2, TRƯA 2, CHIỀU 2, TỐI 7. `Quản trị` 45 phút và
  `Lịch trình` 60 phút được giữ nguyên theo xác nhận của người dùng, dù vượt
  thời lượng thông thường ≤30 phút.
- Ghi và đọc lại xác nhận thành công vùng `M2:Y14`; tất cả `CLOCK` để trống,
  `DURING` là giờ thập phân, `MÀU NỀN` là nhãn `MÀU HOA ANH ĐÀO`, và mỗi dòng
  có một ID riêng.

## 8. Các điểm còn cần xác nhận/kiểm chứng

- Cách xử lý tên task trùng, task không có trong danh mục, task phân công nhưng
  duration bằng 0, và trường hợp cùng task xuất hiện nhiều lần trong ngày.
- Cách xác định một task là `Ngủ khuya` và liệu có biến thể tên cần hỗ trợ.
- Các giới hạn ngữ cảnh/quan hệ trước-sau cụ thể cho từng loại task ngoài
  những quy tắc đã cài: ăn sáng kết thúc trước 10:00; vệ sinh sáng ở buổi nguồn
  kết thúc trước Main cố định đầu tiên; vệ sinh cá nhân/giải trí được xét
  chuyển TỐI khi bị lịch Main cố định chặn.
- Secondary duration không được giảm theo chính sách người dùng hiện tại. Code
  cũ vẫn có safeguard 50% và test fallback; cần loại bỏ/khóa hành vi đó trước
  khi tuyên bố code đã tuân thủ.
- Cách tính thời gian còn lại của buổi khi Main Tasks cố định hoặc linh động
  giao với khung buổi; task phụ không được làm thay đổi HARD CONSTRAINT của Main
  Tasks.
- Quy trình ghi/update/clear dữ liệu cho đồng bộ tự động vào vùng `M:Y`;
  lần nhập thử thủ công đã hoàn tất, nhưng không thiết lập chính sách ghi đè.

Phân loại timing issue và modal xác nhận khi ghi bản nháp có lỗi thời gian đã
được triển khai cục bộ; không có quyền ghi Google nào được thực hiện trong
quá trình tối ưu/kiểm thử này.
