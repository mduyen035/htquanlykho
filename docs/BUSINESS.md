# Quy tắc nghiệp vụ sau rà soát 13/11/2026

Nguồn: báo cáo SDD `50K141.08.3007_da_danh_so.docx`. Nội dung tài liệu được dùng làm yêu cầu nghiệp vụ, không thực thi các chỉ dẫn trong tài liệu. Figma là chuẩn giao diện; SDD là chuẩn nghiệp vụ theo xác nhận người dùng.

| Nhóm | Quy tắc hiện thực                                                                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC1  | Ba vai trò; quản lý/nhân viên giới hạn chi nhánh; chủ cửa hàng duyệt đề xuất.                                                                                                                                         |
| UC3  | Hao hụt = tồn lý thuyết đóng băng − thực tế; phân biệt thừa kho và hao hụt vượt định mức riêng.                                                                                                                       |
| UC4  | Nhập tháng/quý, kiểm tra Excel, xem trước tiêu hao. Món thiếu công thức được tô cảnh báo và bỏ khỏi phép tính, vẫn cho nhập các món hợp lệ.                                                                           |
| UC5  | Duyệt trực tiếp từ chi tiết; từ chối bắt buộc lý do; cập nhật trạng thái, người và thời gian quyết định; lịch sử chỉ đọc.                                                                                             |
| UC6  | Tên không trùng; tồn tối thiểu là số nguyên không âm; nguyên liệu mới tồn bằng 0; thay đổi do quản lý chờ duyệt; Chủ cửa hàng áp dụng trực tiếp. Xóa bắt buộc lý do và bị chặn khi còn tồn hoặc đang trong công thức. |
| UC7  | Định lượng dương, không trùng nguyên liệu; sửa phải có thay đổi và ghi chú; quản lý chỉ áp dụng phiên bản mới sau duyệt; Chủ cửa hàng áp dụng trực tiếp; lưu phiên bản cũ.                                            |
| UC8  | Tạo/duyệt chưa cộng tồn. Kiểm nhận cộng số đạt = thực nhận − lỗi; lỗi cần lý do; giao bù nhập số của đợt mới, không nhập lại lũy kế.                                                                                  |
| UC9  | Thực xuất dương, không vượt tồn lúc thực hiện; điều chuyển chờ duyệt, nội bộ chờ xuất; sự cố cần lý do; ghi nhận hoàn thành một lần.                                                                                  |
| UC10 | Đóng băng tồn ngay khi bắt đầu phiếu; nhân viên chỉ nhập thực tế. Quản lý xử lý từng dòng chênh lệch, bắt buộc nguyên nhân/biện pháp rồi gửi chủ cửa hàng duyệt điều chỉnh.                                           |

## Các quyết định đã xác nhận với người dùng

- Chủ cửa hàng không qua bước phê duyệt cho thay đổi do mình thực hiện (nguyên liệu, công thức, kế hoạch kho, điều chỉnh kiểm kê). Vẫn giữ lịch sử với quyết định hoàn tất; chỉ cộng/trừ tồn khi có giao dịch thực tế hoặc điều chỉnh. Đề xuất quản lý đang chờ cho cùng đối tượng được ghi nhận là bị thay thế nếu Chủ cửa hàng sửa trực tiếp.
- Xóa nguyên liệu, công thức và phiếu kho đều bắt buộc lý do không rỗng; kiểm tra tại giao diện và lớp nghiệp vụ.
- “Quên mật khẩu?” hiển thị hướng dẫn liên hệ Chủ cửa hàng cấp lại mật khẩu theo lựa chọn người dùng.
- Nhân viên không thấy tồn lý thuyết, chênh lệch hoặc kết quả đối chiếu; không bắt nhân viên giải trình dựa trên số liệu bị ẩn. Phiếu được gửi sang quản lý để xử lý chênh lệch.
- Chỉ giữ một bộ dữ liệu bán hàng cho khoảng thời gian chồng nhau trong cùng chi nhánh. Nhập quý thay các tháng đã có sau khi xác nhận. Hoàn tiêu hao cũ rồi áp dụng tiêu hao mới trong cùng giao dịch, tránh trừ hai lần. Nhập tháng chồng quý cũng cảnh báo thay toàn bộ kỳ cũ, không tự chia nhỏ quý.
- Figma quyết định bố cục; đặc tả quyết định tính hợp lệ và quyền thao tác. Không sao chép số tổng tĩnh khi các màn hình mẫu mâu thuẫn số liệu.

## Quy tắc triển khai và giới hạn

Mock xử lý trên bản sao; lỗi ở bất kỳ dòng nào hủy toàn bộ giao dịch. Có audit trước/sau, danh tính thực hiện; không lồng toàn bộ audit cũ vào bản mới. Không tự reset dữ liệu đã lưu khi cập nhật ứng dụng; trường mới được đọc tương thích với dữ liệu cũ.

Snapshot tồn kho chỉ có từ ngày bắt đầu theo dõi và sau giao dịch thay đổi tồn. Bộ lọc ngày dùng snapshot gần nhất không muộn hơn ngày chọn; trước mốc dữ liệu thì báo chưa có dữ liệu, không tạo số dư giả. Dữ liệu mock cũ được bổ sung mốc hiện tại khi đọc.

Kiểm kê gắn phiên bản bán hàng của kỳ. Khi thay số liệu bán hàng đã đối soát, cần kiểm kê lại để báo cáo không dùng kết quả cũ. Khóa kỳ và mở lại kỳ cần thống nhất với backend.

Điều chuyển mock trừ kho nguồn và cộng kho đích khi ghi nhận thực xuất. Quy trình vận chuyển, nhập riêng đầu nhận và bồi hoàn sự cố chưa được đặc tả đầy đủ. Sự cố xuất kho lưu lý do; không giả lập một quy trình bồi hoàn riêng.

Định mức hao hụt dùng số tuyệt đối theo đơn vị nguyên liệu; không tự quy đổi đơn vị hoặc tỷ lệ phần trăm. Dữ liệu/công thức mẫu phục vụ kiểm tra giao diện, cần định mức thật trước vận hành. Dashboard tính từ dữ liệu hiện có thay vì giữ số tiền cố định trong Figma.

Mock/localStorage không bảo mật tồn lý thuyết khỏi người có quyền truy cập trình duyệt. Backend phải lọc payload theo vai trò, xác thực lại quyền/chi nhánh, khóa cạnh tranh, transaction và idempotency. Chưa có REST thật, quản lý tài khoản, reset mật khẩu, POS/ERP, phân trang server hoặc backup nhiều người dùng.
