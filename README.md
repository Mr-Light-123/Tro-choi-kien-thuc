# Quiz Buzzer – Đấu trường tri thức (v1.0)

Ứng dụng web nhiều người chơi theo thời gian thực, dùng trình duyệt trên điện thoại, máy tính và máy tính bảng.

## Chức năng đã có

- Host tạo phòng và tải bộ câu hỏi lên.
- Nhập thủ công theo cặp `[Câu hỏi]|[Câu trả lời]`; có thể viết liền nhiều cặp.
- Nhập Excel `.xlsx`, `.xls`, `.csv` theo 3 cột `STT | Câu hỏi | Câu trả lời`.
- Xáo trộn câu hỏi trước khi tạo phòng.
- 2–12 thí sinh; tên trong phòng không trùng nhau.
- Mã phòng 6 ký tự, link tham gia và QR.
- Host, thí sinh và màn hình trình chiếu riêng.
- Chuông được máy chủ phân xử: chỉ người đầu tiên được nhận quyền.
- 15 giây chờ chuông; 5 giây trả lời. Đồng hồ chỉ hiện số trong 3 giây cuối.
- Host xác nhận đúng/sai; đúng +10, sai -5, điểm không dưới 0.
- Hết giờ trả lời chuyển sang trạng thái chờ host xác nhận sai.
- Không tự động chuyển câu hoặc tự động công bố đáp án.
- Mỗi lượt câu hỏi chỉ có một lần bấm chuông. Muốn mở lại, host phải mở lại câu hỏi từ đầu.
- Host xem toàn bộ bảng điểm; từ 7 người, thí sinh/màn chiếu xem top 4.
- Host có thể xóa người chơi và đặt lại điểm.

## Chạy thử trên máy tính

Cần cài Node.js 18 trở lên.

```bash
npm install
npm start
```

Mở `http://localhost:3000`.

Để thử nhiều thiết bị trong cùng mạng Wi-Fi, dùng địa chỉ IP nội bộ của máy chạy server, ví dụ `http://192.168.1.10:3000`. Không dùng `localhost` trên điện thoại.

## Đưa lên Internet (Render)

1. Tạo tài khoản GitHub và một repository mới.
2. Tải toàn bộ thư mục dự án này lên repository.
3. Tạo Web Service mới trên Render và kết nối repository.
4. Render sẽ nhận cấu hình từ `render.yaml`; build command `npm install`, start command `npm start`.
5. Sau khi deploy, mở URL Render. Host tạo phòng và chia sẻ QR/link cho thí sinh.

Lưu ý: gói hosting miễn phí có thể ngủ khi không có truy cập, khiến lần mở đầu chậm. Với cuộc thi chính thức, nên chọn dịch vụ hosting ổn định.

## Cách sử dụng

1. Host mở website → Tạo phòng thi.
2. Nhập thủ công hoặc tải Excel → xem trước → tùy chọn xáo trộn → Tạo phòng.
3. Chia sẻ mã/QR.
4. Thí sinh nhập tên để tham gia.
5. Host bấm **Mở câu hỏi / chuông**.
6. Người chơi bấm chuông. Nếu có người bấm, máy chủ khóa các chuông khác và bắt đầu 5 giây.
7. Host bấm **Xác nhận đúng** hoặc **Xác nhận sai**. Nếu quá 5 giây, host vẫn cần bấm xác nhận sai để trừ điểm.
8. Host có thể **Hiện đáp án**, **Câu tiếp theo**, hoặc **Mở lại từ đầu**. Không có tự động chuyển câu.
9. Mở màn hình trình chiếu từ nút trên giao diện Host.

## Lưu ý kỹ thuật của bản 1.0

- Dữ liệu phòng đang lưu trong bộ nhớ máy chủ. Nếu dịch vụ khởi động lại hoặc ngủ rồi khởi động lại tiến trình, phòng và điểm hiện tại có thể mất. Không đóng trang Host trong khi đang thi.
- Mã host được lưu trong localStorage của trình duyệt host để kết nối lại; không chia sẻ thiết bị/tài khoản trình duyệt host.
- QR và đọc Excel dùng thư viện CDN, cần kết nối Internet.
- Đây là bản nền có thể chạy và triển khai; trước một cuộc thi chính thức cần thử tải thực tế, kiểm tra mạng tại địa điểm và nâng cấp lưu trữ bền vững nếu cần.
