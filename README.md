# Quiz Buzzer – Đấu trường tri thức (v3.0)

Ứng dụng web nhiều người chơi theo thời gian thực, sử dụng trình duyệt trên điện thoại, máy tính và máy tính bảng.

## Chức năng

- Host tạo phòng, nhập bộ câu hỏi thủ công theo cặp `[Câu hỏi]|[Câu trả lời]` hoặc tải Excel `.xlsx`, `.xls`, `.csv` theo 3 cột `STT | Câu hỏi | Câu trả lời`.
- Xem trước và xóa câu hỏi trước khi tạo phòng; danh sách câu hỏi thu gọn mặc định và mở rộng bằng mũi tên; có tùy chọn xáo trộn.
- 2–12 thí sinh; tên trong phòng không trùng nhau; mã phòng 6 ký tự, link và QR tham gia.
- Bốn giao diện riêng: Host điều khiển, MC quan sát/dẫn chương trình, màn hình trình chiếu và thí sinh.
- Khi tạo phòng, các màn hình hiển thị lời chào; câu hỏi chỉ xuất hiện khi Host bắt đầu câu.
- Host bấm **Mở chuông** thủ công sau khi câu hỏi đã hiển thị. Thời gian chờ chuông mặc định 15 giây, có thể chọn 10/20/30 giây hoặc không giới hạn.
- Người đầu tiên bấm chuông được ghi nhận ngay. Sau đó hệ thống mở cửa sổ 1,5 giây để ghi nhận tối đa 2 người tiếp theo; người đầu tiên là người duy nhất được trả lời.
- MC xem câu hỏi, đáp án, thời gian bấm của tối đa 3 thí sinh đầu tiên và toàn bộ bảng điểm. MC không có nút điều khiển.
- Thời gian trả lời mặc định 5 giây, có thể chọn 10/15/20 giây hoặc không giới hạn. Hết giờ không tự động trừ điểm; Host vẫn quyết định đúng/sai.
- Host xác nhận đúng +10, sai −5; điểm tối thiểu 0. Mỗi lượt chỉ được ghi nhận một lần.
- Host có thể hiện đáp án, mở lại câu hỏi từ đầu, chuyển câu trực tiếp sang câu mới (đã sửa luồng sự kiện Câu hỏi tiếp theo), kết thúc trò chơi và công bố bảng xếp hạng riêng biệt.
- Host có thể chỉnh sửa tổng điểm của từng thí sinh bằng cách nhập điểm mới; hệ thống xác nhận trước khi lưu và tự động cập nhật bảng điểm/thứ hạng.
- Trong lúc thi, bảng điểm của thí sinh/máy chiếu giữ quy tắc cũ: tối đa 6 người thì hiện tất cả, từ 7 người thì hiện top 4. MC và Host luôn thấy toàn bộ. Khi công bố kết quả cuối cùng, thí sinh và máy chiếu thấy đầy đủ tên và điểm.

## Chạy thử trên máy tính

Cần Node.js 18 trở lên.

```bash
npm install
npm start
```

Mở `http://localhost:3000`.

## Triển khai trên Render

Cấu hình `render.yaml` dùng `npm install` và `npm start`. Có thể cập nhật mã nguồn trong repository GitHub hiện tại; nếu Render bật Auto-Deploy, dịch vụ sẽ triển khai lại trên URL hiện tại.

## Lưu ý

- Dữ liệu phòng và điểm hiện lưu trong bộ nhớ máy chủ. Khi Render khởi động lại tiến trình hoặc deploy, phòng đang chạy có thể mất. Không deploy trong lúc thi.
- Mã Host lưu trong localStorage của trình duyệt Host. Không chia sẻ thiết bị/trình duyệt Host.
- QR và đọc Excel dùng thư viện CDN, cần Internet.
- Cần thử nghiệm thực tế trên nhiều thiết bị và mạng trước khi dùng trong sự kiện chính thức. Bản V3 đã được kiểm tra cú pháp JavaScript; vẫn cần diễn tập trực tiếp trên nhiều thiết bị và mạng trước khi dùng trong sự kiện chính thức.
