# DATA EXTRACTION SPECIFICATION
## SMART CALENDAR SYNC V3.2 — MAIN TASK DATA MAPPING

### 1. MỤC TIÊU

Đọc và hiểu cơ chế truy xuất dữ liệu của hệ thống SMART CALENDAR SYNC V3.2 trên Google Sheets.

Mục tiêu là xác định đầy đủ dữ liệu cần thiết để tạo một Calendar Task Block trước khi thực hiện thao tác import lên Google Calendar.


Yêu cầu quan trọng: Không được tự suy đoán địa chỉ ô hoặc cách liên kết. Phải phân biệt rõ dữ liệu đọc trực tiếp, dữ liệu tra cứu gián tiếp, dữ liệu tính toán và dữ liệu được sinh tự động.

---

# 2. CẤU TRÚC NGUỒN DỮ LIỆU

Hệ thống sử dụng hai khu vực dữ liệu chính trên sheet `TUẦN`:

1. Bảng READY: xác định những công việc nào được chọn để thực hiện trong từng ngày.
2. MASTER DATABASE: chứa thông tin chi tiết của từng công việc.

Hai bảng có nhiệm vụ khác nhau. Không được nhầm lẫn dữ liệu giữa chúng.

## 2.1. BẢNG READY — XÁC ĐỊNH NGÀY VÀ TASK

Sheet: `TUẦN`

### A. Ngày thực hiện

Vùng dữ liệu:

`TUẦN!M16:M22`

| Địa chỉ ô | Nội dung |
|---|---|
| M16 | Ngày thứ Hai |
| M17 | Ngày thứ Ba |
| M18 | Ngày thứ Tư |
| M19 | Ngày thứ Năm |
| M20 | Ngày thứ Sáu |
| M21 | Ngày thứ Bảy |
| M22 | Ngày Chủ nhật |

Giá trị tại các ô này xác định ngày thực tế mà hệ thống sẽ lập lịch.

Cần đọc cả:
- Giá trị thực của ô để xử lý ngày tháng.
- Giá trị hiển thị của ô để kiểm tra định dạng ngày.

Không nên chỉ đọc chuỗi hiển thị rồi mặc định đó là giá trị Date hợp lệ.

### B. Tên các TASK được phân bổ theo ngày

Vùng dữ liệu:

`TUẦN!O16:AK22`

Các cột chứa tên task chính được đọc theo thứ tự cách nhau 2 cột:

| Địa chỉ | Nội dung |
|---|---|
| O16:O22 | Tên task 1 |
| Q16:Q22 | Tên task 2 |
| S16:S22 | Tên task 3 |
| U16:U22 | Tên task 4 |
| W16:W22 | Tên task 5 |
| Y16:Y22 | Tên task 6 |
| AA16:AA22 | Tên task 7 |
| AC16:AC22 | Tên task 8 |
| AE16:AE22 | Tên task 9 |
| AG16:AG22 | Tên task 10 |
| AI16:AI22 | Tên task 11 |
| AK16:AK22 | Tên task 12 |

Các cột xen giữa là những trường Duration trong bảng READY:

| Địa chỉ | Nội dung |
|---|---|
| P16:P22 | Duration đi kèm task tại cột O |
| R16:R22 | Duration đi kèm task tại cột Q |
| T16:T22 | Duration đi kèm task tại cột S |
| V16:V22 | Duration đi kèm task tại cột U |
| X16:X22 | Duration đi kèm task tại cột W |
| Z16:Z22 | Duration đi kèm task tại cột Y |
| AB16:AB22 | Duration đi kèm task tại cột AA |
| AD16:AD22 | Duration đi kèm task tại cột AC |
| AF16:AF22 | Duration đi kèm task tại cột AE |
| AH16:AH22 | Duration đi kèm task tại cột AG |
| AJ16:AJ22 | Duration đi kèm task tại cột AI |

Lưu ý:
- Trong cơ chế truy xuất task chính hiện tại của V3.2, hệ thống đọc tên task từ các cột O, Q, S... AK.
- Các cột Duration xen giữa không được sử dụng làm nguồn Duration chính của task.
- Duration thực tế được tra cứu từ MASTER DATABASE, cột G.
- Phải giữ nguyên thứ tự các task xuất hiện trên từng dòng READY.
- Ô tên task trống thì bỏ qua.
- Mỗi task phải được ghi nhận địa chỉ READY gốc để có thể truy ngược.

Ví dụ:

Ngày nằm tại M16.

Tên task đầu tiên nằm tại O16.

Nếu O16 chứa `Thực tập BIM Xây dựng_ST2`, hệ thống phải tìm tên này trong MASTER DATABASE để lấy các trường chi tiết.

Thông tin truy xuất phải giữ được:
- Ngày nguồn: M16.
- Task nguồn: O16.
- Tên task: giá trị trong O16.
- Thứ tự task: vị trí thứ nhất trong danh sách READY của ngày đó.

---

# 3. MASTER DATABASE — NGUỒN THÔNG TIN CHI TIẾT CỦA TASK

Sheet: `TUẦN`

Vùng dữ liệu:

`TUẦN!A3:I(lastRow)`

MASTER DATABASE chứa thông tin chi tiết của từng task.

Tên task được sử dụng làm khóa tra cứu để liên kết READY với MASTER DATABASE.

## 3.1. Bản đồ địa chỉ các trường

| Cột | Tên trường | Nội dung cần lấy | Mục đích |
|---|---|---|---|
| A | GROUP CLASS | Nhóm phân loại | Xác định category |
| B | CLASS | Loại công việc | Xác định class |
| C | CÔNG VIỆC | Tên task | Khóa liên kết |
| D | NỘI DUNG | Nội dung chi tiết | Description |
| E | PR | Giá trị PR | Metadata |
| F | GI | Giá trị GI | Metadata và quy tắc màu |
| G | SUM / DURING | Thời lượng task | Duration |
| H | DEADLINE | Deadline | Không sử dụng trong luồng task chính hiện tại |
| I | Start Time | Giờ bắt đầu | Xác định thời điểm bắt đầu cố định |

Cần đọc dữ liệu của các cột trên theo đúng vị trí thực tế, không phụ thuộc vào việc người dùng thay đổi tên tiêu đề.

## 3.2. Cách liên kết READY với MASTER DATABASE

Ví dụ:

- `TUẦN!O16` chứa tên task `Thực tập BIM Xây dựng_ST2`.
- Hệ thống tìm tên tương ứng trong `TUẦN!C3:C(lastRow)`.
- Khi tìm thấy dòng phù hợp, lấy các trường còn lại trên chính dòng đó.

Ví dụ nếu tìm thấy task tại dòng 15:

| Trường | Địa chỉ nguồn |
|---|---|
| GROUP CLASS | A15 |
| CLASS | B15 |
| Tên task | C15 |
| Nội dung | D15 |
| PR | E15 |
| GI | F15 |
| Duration | G15 |
| Deadline | H15 |
| Start Time | I15 |

Đây chỉ là ví dụ minh họa. Dòng MASTER thực tế phải được tìm kiếm dựa trên tên task.

### Quy tắc tìm kiếm

- Chuẩn hóa tên task trước khi so sánh.
- Không phân biệt chữ hoa và chữ thường.
- Loại bỏ khoảng trắng đầu và cuối.
- Chuẩn hóa nhiều khoảng trắng liên tiếp thành một khoảng trắng.
- Chuẩn hóa Unicode để tránh lỗi so sánh ký tự tiếng Việt.
- Nếu không tìm thấy task, phải báo lỗi liên kết.
- Nếu có nhiều dòng MASTER trùng tên sau chuẩn hóa, phải ghi nhận tình trạng trùng lặp; không âm thầm chọn sai task.
- Mỗi kết quả phải giữ lại địa chỉ ô READY và địa chỉ dòng MASTER tương ứng.

### Quy tắc đặc biệt của GROUP CLASS

Cột A có thể sử dụng ô gộp theo nhóm và công thức có thể chứa thuộc tính
category trong một nhánh công thức không hiển thị, theo mẫu
`[Phân loại: [CATEGORY]]`.

Khi đọc dữ liệu, phải kiểm tra cơ chế kế thừa GROUP CLASS từ dòng chứa giá trị gần nhất phía trên nếu ô hiện tại trống do thuộc vùng merged cells.
Đồng thời đọc công thức cột A, trích `CATEGORY` từ annotation `Phân loại` và
kế thừa category đó cho các dòng thuộc cùng ô gộp. Nếu không có annotation,
dùng giá trị hiển thị của cột A làm category như trước. CLASS luôn lấy riêng từ
cột B.

Không được mặc định ô A trống đồng nghĩa task không có category.

Riêng task có CLASS là `SYSTEM`, hệ thống V3.2 có quy tắc phân loại SYSTEM đặc biệt.

Cần giữ cả:
- Giá trị GROUP CLASS kế thừa.
- Giá trị CLASS thực tế.

Không gộp hai trường này thành một.

---

# 4. CÁCH LẤY TỪNG TRƯỜNG DỮ LIỆU CHO MỘT TASK

Đây là phần quan trọng nhất.

Mỗi task chính phải được tổng hợp thành một bản ghi dữ liệu đầy đủ.

## 4.1. DATE — Ngày thực hiện

Nguồn: cột M của bảng READY.

Ví dụ:
- Task tại O16 thuộc ngày M16.
- Task tại Q16 cũng thuộc ngày M16.
- Task tại O17 thuộc ngày M17.

Không lấy ngày từ MASTER DATABASE.

Ngày được xác định bởi dòng READY chứa task.

## 4.2. DAY — Thứ trong tuần

Thứ được xác định từ ngày READY tương ứng.

Ví dụ:
- 09/11/2026 → THỨ HAI.
- 10/11/2026 → THỨ BA.

Không được suy luận thứ dựa trên số thứ tự task.

Cần chuẩn hóa thứ thành một trường riêng để đưa vào SCAN.

## 4.3. STT — Số thứ tự task

STT được đánh theo thứ tự các task hợp lệ trong từng ngày.

Ví dụ:
- Task đầu tiên: 1.
- Task thứ hai: 2.
- Task thứ ba: 3.

Không sử dụng số thứ tự dòng MASTER làm STT.

## 4.4. ICON — Biểu tượng

ICON không phải dữ liệu đọc từ một ô riêng.

Hệ thống xác định ICON dựa trên CLASS và GROUP CLASS của task trong MASTER DATABASE.

Quy tắc của V3.2:

| Điều kiện | ICON |
|---|---|
| CLASS = SYSTEM hoặc CATEGORY chứa SYSTEM | ⚙️ |
| CATEGORY chứa BẢN SẮC | 🎭 |
| CATEGORY chứa ĐẠO ĐỒ | 🧘 |
| CATEGORY chứa SỰ NGHIỆP | 💼 |
| Không thỏa điều kiện | Không có ICON |

Thứ tự ưu tiên cần được giữ nguyên; điều kiện SYSTEM được xét trước các
CATEGORY khác. CATEGORY được kế thừa từ MASTER cột A và CLASS lấy từ cột B.

ICON được lưu riêng ở cột D của Scheduler Database và chỉ ghép với tên task
trong tiêu đề sự kiện Calendar/Calendar preview. Tên task gốc không bị đổi và
DESCRIPTION không chứa ICON.

## 4.5. TASK NAME — Tên công việc

Có hai vị trí chứa tên task:

- READY: các cột O, Q, S, U, W, Y, AA, AC, AE, AG, AI, AK.
- MASTER: cột C.

READY dùng để xác định task được chọn trong ngày.

MASTER cột C là nguồn thông tin chi tiết chính thức của task.

Tên task được sử dụng trong:
- Tên sự kiện Calendar.
- DESCRIPTION.
- Tra cứu dữ liệu MASTER.

Phải giữ nguyên tên task gốc sau khi đã tìm thấy bản ghi tương ứng.

## 4.6. DESCRIPTION — Nội dung block Calendar

DESCRIPTION được tổng hợp từ nhiều trường MASTER, không lấy nguyên văn từ một ô duy nhất.

Cấu trúc nội dung:

- `INTERNAL_TASK_ID`.
- CATEGORY.
- CLASS.
- CÔNG VIỆC.
- NỘI DUNG.
- PR.
- GI.
- DURING.
- CLOCK của lịch đã xếp (được thêm khi ghi lịch đã duyệt vào Scheduler Database).

Nguồn dữ liệu:

| Thành phần DESCRIPTION | Nguồn |
|---|---|
| INTERNAL_TASK_ID | Hệ thống tự sinh |
| CATEGORY | MASTER cột A, có xử lý kế thừa GROUP CLASS |
| CLASS | MASTER cột B |
| CÔNG VIỆC | MASTER cột C |
| NỘI DUNG | MASTER cột D |
| PR | MASTER cột E |
| GI | MASTER cột F |
| DURING | MASTER cột G |
| CLOCK | Thời gian cuối cùng của task sau khi xếp lịch |

### Quy tắc xử lý NỘI DUNG

Nội dung lấy từ cột D.

V3.2 có xử lý dấu ngoặc vuông trong nội dung:

- Nếu nội dung được bao trong dấu ngoặc vuông, bỏ dấu ngoặc và thêm tiền tố `->`.
- Nếu nội dung không có dấu ngoặc vuông, thêm `->` trước nội dung.

Ví dụ:

Nội dung nguồn:
`[Đi học thực tập BIM trong xây dựng ST2]`

Nội dung DESCRIPTION:
`-> Đi học thực tập BIM trong xây dựng ST2`

Không tự viết lại, tóm tắt hoặc thay đổi ý nghĩa nội dung gốc.

### Quy tắc SCV2_ID

SCV2_ID là mã quản lý sự kiện, không phải dữ liệu có sẵn trong MASTER.

Nó được hệ thống sinh tự động để nhận diện và quản lý sự kiện.

Cần nghiên cứu và tái tạo đúng cơ chế sinh ID của V3.2 nếu muốn tương thích với cơ chế cập nhật và dọn lịch cũ.

Không tự tạo ID ngẫu nhiên nếu chưa đối chiếu cơ chế gốc.

## 4.7. DURING — Thời lượng

Nguồn chính xác:

`MASTER DATABASE!G3:G(lastRow)`

Đây là thời lượng của task, tính bằng giờ.

Ví dụ:
- 5 → 5 giờ.
- 1,67 → 1,67 giờ.
- 3,33 → 3,33 giờ.
- 0,5 → 30 phút.

Không lấy Duration từ các cột P, R, T, V... của READY để thay thế trường này.

Cần giữ giá trị số gốc và chuyển đổi chính xác sang đơn vị thời gian khi tính lịch.

## 4.8. CLOCK — Thời gian bắt đầu và kết thúc

CLOCK không phải trường được lấy trực tiếp từ một ô duy nhất.

Nó được tạo từ:
- Ngày READY.
- Start Time tại MASTER cột I, nếu có.
- Duration tại MASTER cột G.
- Quy tắc tự sắp xếp của V3.2, nếu không có Start Time.

### Trường hợp 1: Có Start Time

Nguồn:
`MASTER DATABASE!I3:I(lastRow)`

Start Time xác định thời gian bắt đầu của task.

Ví dụ:
- Start Time = 07:30.
- Duration = 5 giờ.
- Ngày = 09/11/2026.

Kết quả:
- Start = 09/11/2026 07:30.
- End = 09/11/2026 12:30.

### Trường hợp 2: Không có Start Time

Task không có Start Time vẫn là một MAIN TASK hợp lệ và phải được giữ để
import. Thời điểm bắt đầu được tính từ thứ tự READY, thời lượng, các mốc
Start Time cố định đứng trước/sau và khoảng nghỉ cấu hình. Không được bỏ task,
hoặc xếp các task linh hoạt thành một danh sách riêng làm mất thứ tự tương đối.
Trong luồng ghi trực tiếp, CLOCK được tính ngay trong Apps Script. Trong luồng
VS Code, `normalized_input` để trống CLOCK của task linh hoạt để trợ lý lập
lịch; chỉ `optimized_schedule` hợp lệ mới được ghi database. Luồng chính dùng
extension VS Code để xem trước bản nháp và ghi trực tiếp qua Google Sheets API
sau khi người dùng duyệt. Apps Script Web App không còn nút hoặc chức năng nhận
file `optimized_schedule`.

Mốc mặc định 07:30 và khoảng nghỉ 15 phút được nêu là giá trị mặc định tham
khảo của V3.2. Địa chỉ cấu hình thực tế trong workbook/mã V3.2 hiện là
`CHƯA XÁC MINH`; không được tuyên bố hai giá trị này là cấu hình đang dùng trong
mọi nguồn. Trong Web App pilot, chúng được đưa thành hai trường cấu hình hiển
thị trước preview, mặc định lần lượt là 07:30 và 15 phút; người dùng có thể
điều chỉnh và phải preview lại trước khi ghi.

### Thứ tự nguồn và lập CLOCK cho toàn bộ MAIN TASK

Thứ tự nguồn mỗi ngày được lấy từ READY theo chiều trái sang phải:
`O, Q, S, U, W, Y, AA, AC, AE, AG, AI, AK`. Ô trống được bỏ qua; `STT` giữ
Source Order/Sequence Index bắt đầu từ 1. `CLOCK` thể hiện thời gian thực tế
sau khi xếp; thứ tự thời gian có thể khác thứ tự nguồn nếu cần để thỏa các
ràng buộc cứng và ưu tiên ngữ cảnh.

- Luồng ghi trực tiếp: `STT` lưu thứ tự nguồn READY.
- Luồng VS Code: transfer JSON giữ `source_order` bất biến và dùng
  `schedule_order` cho thứ tự được trợ lý đề xuất; khi ghi output đã xác nhận,
  database `STT` được gán từ `schedule_order`. Task nguồn không bị xóa hay
  đánh lại `source_order`. Extension kiểm tra cặp input/draft cục bộ và không
  dùng fingerprint để đối chiếu trực tiếp với Sheet nguồn hiện tại.

1. Tất cả task có Start Time và task `Ngủ đêm` là các mốc cứng. Start Time và
   DURING của task có Start Time không được thay đổi.
2. Trước khi lập lịch, dừng nếu hai Start Time trùng nhau hoặc nếu bất kỳ hai
   khoảng mốc cứng nào chồng lấn, gồm fixed-fixed và fixed-`Ngủ đêm`. Lỗi phải
   nêu task, ô READY (nếu có), ngày và khoảng thời gian liên quan.
3. Task không có Start Time được xếp vào các khoảng trống giữa giờ bắt đầu mặc
   định trong ngày đó và giờ bắt đầu mặc định ngày kế tiếp. Không được chồng
   task linh động với mốc cứng hoặc task linh động khác. Các mốc cứng của ngày
   liền kề cũng được xét khi chúng nằm trong khoảng đang xếp.
4. Với MAIN TASK, khoảng nghỉ cấu hình được tính giữa các task và quanh các
   mốc cứng khi lấp khoảng trống. Quy tắc này không áp dụng cho Secondary
   Tasks; không chèn khoảng nghỉ giữa các task phụ, kể cả khi đổi nhóm.
   Thứ tự READY là mục tiêu ưu tiên, không phải ràng buộc cứng:
   bộ lập lịch giảm thiểu số lần đảo thứ tự trên toàn bộ cặp task Main có thể
   sắp xếp (bao gồm task linh động so với fixed).
5. Bộ lập lịch tìm phương án giữ nguyên toàn bộ Duration trước. Chỉ khi không
   có phương án khả thi với Duration gốc mới được giảm Duration task linh động:
   tối đa 15 phút với task gốc không quá 1 giờ, tối đa 30 phút với task gốc trên
   1 giờ. Tổng mức giảm được tối thiểu hóa trước khi tối ưu thứ tự. Không giảm
   Duration task fixed hoặc task `Ngủ đêm`; không vượt giới hạn và không tự ý
   bỏ task.
6. Nếu không thể xếp hết task trong giới hạn trên, dừng và báo ngày, các task
   chưa thể xếp và lý do. Không ghi snapshot/import một lịch thiếu task.
7. Mỗi task Main trong database hoàn chỉnh đều phải có `CLOCK` khớp với
   `DURING` thực tế; nếu Duration
   được giảm, `DURING` lưu giá trị đã xếp và DESCRIPTION ghi thêm
   `ORIGINAL_DURING` cùng `SCHEDULE_ADJUSTMENT`. `STT` tuân theo chế độ ghi
   trực tiếp hoặc `schedule_order` của gói VS Code đã được xác nhận.
8. Một task linh động có thể đi qua 00:00 nhưng không được vượt qua khoảng
   `Ngủ đêm` hoặc mốc cứng của ngày kế tiếp; `CLOCK` ghi offset ngày và Calendar
   dùng ngày kết thúc thực tế.
9. Mỗi ngày tự tạo đúng một task `Ngủ đêm`, không cần có trong READY/MASTER:
   `CÔNG VIỆC` là `Ngủ đêm`; `DESCRIPTION` mặc định là `Ngủ đêm hôm nay`, nhưng
   Calendar import nhận diện task ngủ theo tên và chấp nhận nội dung DESCRIPTION
   bất kỳ. Giờ bắt đầu và DURING do người dùng cấu hình, mặc định hiện tại là
   03:00 và 5 giờ. Màu mặc
   định của task này là `GRAY` trong Scheduler Database, mô phỏng và Google
   Calendar. Task được lưu sau Main Tasks với STT tiếp theo nhưng vẫn là mốc
   cứng trong lịch.

Đây là quy tắc cho Web App pilot theo yêu cầu đã xác nhận; không khẳng định cấu
hình nội bộ V3.2 đã được xác minh.

### Transfer JSON qua VS Code

Luồng tùy chọn VS Code được đặc tả trong
`SCHEDULER_TRANSFER_SCHEMA.md` và `VSCODE_OPTIMIZATION_WORKFLOW.md`.
**Chuẩn hóa dữ liệu** xuất `normalized_input` schema v4, không ghi database.
Gói giữ mọi Main Task, mọi Secondary Task được chọn (trừ `Ngủ khuya`) cùng
metadata truy xuất nguồn, và sinh đúng một task ngủ mỗi ngày. Flexible Main
và Secondary `CLOCK` để trống; fixed Main và task ngủ giữ nguyên. Trợ lý phải
chỉnh bản nháp `optimized_schedule` riêng, giữ `source_fingerprint` và mọi
trường nguồn bất biến. Extension VS Code kiểm tra cặp input/draft cục bộ, task
đầy đủ, fixed anchors, duration cap Main, CLOCK, break chỉ giữa Main Tasks,
khung/placement Secondary và các hard constraints ăn sáng/vệ sinh. Trường
duration Secondary nguồn không bị ghi đè; mọi điều chỉnh lịch được lưu riêng
và timing issue cần xác nhận modal trước khi ghi. Lỗi cấu trúc/toàn vẹn nguồn
luôn chặn ghi. Apps Script không còn nhận optimized JSON; VS Code extension là
đường import duy nhất cho bản nháp đã tối ưu. Nút ghi nguồn của Apps Script
vẫn ghi snapshot đã chuẩn hóa từ workbook nguồn.
Apps Script không còn nhận optimized JSON; VS Code extension là đường import
duy nhất cho bản nháp đã tối ưu. Nút ghi nguồn của Apps Script vẫn ghi snapshot
đã chuẩn hóa từ workbook nguồn.

Đây là pilot có trợ lý AI trong VS Code, không phải optimizer tất định độc lập.
Trợ lý đưa ra phương án và giải thích; extension validator quyết định tính
hợp lệ của cấu trúc/lịch trước khi ghi. Import trực tiếp không tính lại fingerprint hoặc đọc lại Sheet nguồn để so
sánh. Secondary Tasks được giữ trong array riêng và ghi vào vùng `M:Y`; Main
Tasks vẫn ghi vào `A:J`.

### Kết quả CLOCK

Cần tạo hai giá trị riêng:
- Start DateTime.
- End DateTime.

Sau đó mới định dạng thành chuỗi CLOCK hiển thị, ví dụ:

`07:30 am - 12:30 pm`

Không sử dụng chuỗi CLOCK để thực hiện phép tính thời gian.

## 4.9. MÀU NỀN — Calendar Event Color

Màu không lấy trực tiếp từ một ô màu trong MASTER.

V3.2 quyết định màu theo GI và CLASS.

Quy tắc:

| Điều kiện | Màu |
|---|---|
| GI khác 0 | MAUVE (tím) |
| GI = 0 và CLASS = SYSTEM | RED (đỏ) |
| GI = 0 và CLASS thuộc KNOWLEDGES, CASUAL SKILLS, NỘI TẠI | GREEN (xanh lá) |
| GI = 0 và CLASS thuộc DƯỠNG SINH, SIÊU SINH, TRƯỜNG SINH | YELLOW (vàng) |
| Không thuộc các trường hợp trên | Không thiết lập màu riêng |

Ưu tiên điều kiện GI khác 0 trước các điều kiện CLASS.

Lưu ý:
- Màu nền hiển thị trong SCAN phải được đối chiếu với màu thực tế của Google Calendar.
- Không nhầm mã màu giao diện Google Sheets với colorId của Google Calendar.
- Nếu không có màu riêng, cần biểu diễn rõ trạng thái mặc định, không tự gán màu.

---

# 5. CÁC TRƯỜNG KHÔNG ĐƯỢC NHẦM LẪN

| Trường | Địa chỉ | Cách sử dụng |
|---|---|---|
| READY Duration | P, R, T, V... | Không dùng làm Duration chính trong cơ chế task chính hiện tại |
| MASTER Duration | G | Nguồn Duration chính |
| MASTER Start Time | I | Nguồn thời gian bắt đầu cố định |
| MASTER Deadline | H | Không sử dụng trong luồng task chính hiện tại |
| MASTER Timeline | J | Không nằm trong vùng đọc A:I của MASTER hiện tại |
| GROUP CLASS | A | Có thể phải kế thừa từ merged cells |
| CLASS | B | Dùng xác định loại task và quy tắc ICON, màu |
| Task Name | C | Khóa tra cứu MASTER |

---

# 6. CẤU TRÚC DỮ LIỆU TRUNG GIAN CẦN TẠO

Sau khi đọc và liên kết thành công, mỗi task cần có một bản ghi hoàn chỉnh với các nhóm thông tin sau.

### A. SOURCE TRACE — Truy xuất nguồn

- Tên sheet nguồn.
- Địa chỉ ô ngày READY.
- Địa chỉ ô tên task READY.
- Địa chỉ dòng MASTER.
- Địa chỉ từng ô MASTER được sử dụng.

### B. TASK INFORMATION — Thông tin task

- Date.
- Day.
- STT.
- GROUP CLASS.
- CLASS.
- Task Name.
- Content.
- PR.
- GI.
- Duration.
- Start Time.

### C. CALENDAR INFORMATION — Thông tin block Calendar

- Event ID.
- Icon.
- Summary.
- Description.
- Start DateTime.
- End DateTime.
- CLOCK.
- Color.

### D. VALIDATION — Kiểm tra dữ liệu

- Task có tồn tại trong MASTER hay không.
- Có trùng tên task trong MASTER hay không.
- Có thiếu CLASS hay không.
- Có thiếu Duration hay không.
- Start Time có hợp lệ hay không.
- Ngày có hợp lệ hay không.
- Có tạo được Start và End hay không.
- Có đủ thông tin để tạo Calendar Event hay không.

Không được âm thầm bỏ qua task lỗi.

---

# 7. YÊU CẦU ĐẶC BIỆT VỀ TÍNH CHÍNH XÁC

1. Phải đọc và đối chiếu toàn bộ file SMART CALENDAR SYNC V3.2 trên GitHub trước khi kết luận cơ chế nào đó.
2. Không tự viết lại quy tắc dựa trên suy đoán.
3. Giữ `STT` theo thứ tự READY; chỉ thay đổi thứ tự thời gian khi cần tối ưu
   dưới các ràng buộc đã xác nhận và giảm thiểu số lần đảo thứ tự.
4. Không lấy nhầm Duration READY thay cho MASTER.
5. Không nhầm GROUP CLASS với CLASS.
6. Không nhầm Start Time với CLOCK.
7. Không nhầm DESCRIPTION với nội dung cột D.
8. Không tự tạo ICON hoặc màu theo quy tắc mới.
9. Không thay đổi dữ liệu gốc trong Google Sheets.
10. Mỗi trường dữ liệu phải truy ngược được đến nguồn.

Nếu có điểm nào chưa xác minh được từ mã nguồn V3.2, hãy ghi rõ `CHƯA XÁC MINH`, không tự đưa ra kết luận.

---

# 8. PHẠM VI VÀ KẾT QUẢ MONG MUỐN

Tài liệu mapping này xác định dữ liệu và thứ tự MAIN TASK. Triển khai
Google Apps Script Web App pilot hiện thực hóa việc đọc, preview, chuẩn hóa và
import Calendar test theo thứ tự READY; đây không phải khẳng định cơ chế nội bộ
của V3.2 đã được xác minh.

Kết quả cần có:

1. Bản đồ địa chỉ ô nguồn.
2. Bản đồ liên kết READY → MASTER DATABASE.
3. Danh sách đầy đủ các trường dữ liệu.
4. Quy tắc chuyển đổi từng trường.
5. Quy tắc tạo ICON, DESCRIPTION, CLOCK và COLOR.
6. Cấu trúc dữ liệu trung gian hoàn chỉnh.
7. Cơ chế truy xuất ngược từ một task về đúng ô nguồn.
8. Thứ tự nguồn được giữ xuyên suốt từ READY, STT, snapshot đến Calendar.
9. Danh sách những điểm chưa xác minh.

Mục tiêu cuối cùng là có thể đọc dữ liệu Google Sheets và tái tạo chính xác thông tin của từng MAIN TASK BLOCK mà SMART CALENDAR SYNC V3.2 sử dụng trước khi import lên Google Calendar.

**Ưu tiên tuyệt đối: ĐÚNG NGUỒN – ĐÚNG LIÊN KẾT – ĐÚNG GIÁ TRỊ – ĐÚNG QUY TẮC CHUYỂN ĐỔI.**