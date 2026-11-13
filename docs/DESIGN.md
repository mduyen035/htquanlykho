# Nguồn thiết kế và quy ước giao diện

File Figma: https://www.figma.com/design/3r0MaVbRRf7a6gKV2EVfh3/50K141.08.3007?node-id=0-1

Đã dùng skill `figma-web-project` đính kèm và `figma-design-to-code`, đọc context chi tiết và screenshot cho các màn hình dưới đây. Canvas gốc 0:1 không trả code trực tiếp; đã lấy metadata để tìm frame rồi đọc context từng frame.

| Nhóm                           | Node tham chiếu           |
| ------------------------------ | ------------------------- |
| Đăng nhập                      | 4:18486                   |
| Tổng quan chủ cửa hàng         | 37:394                    |
| Nguyên vật liệu, thêm NVL      | 4:4687, 4:4816            |
| Nhập kho, tạo phiếu, kiểm nhận | 17:4558, 17:4367, 17:3782 |
| Xuất kho, tạo phiếu            | 14:2661, 14:3171          |
| Kiểm kê, tạo kiểm kê           | 1:1320, 1:961             |
| Phê duyệt điều chỉnh           | 4:146                     |
| Công thức, tạo công thức       | 12:2059, 12:2351          |
| Dữ liệu bán hàng               | 12:4875                   |
| Hao hụt, tồn kho               | 1:696, 1:875              |

Design tokens từ context: brand `#004777`, text `#0B2239`, secondary `#4A5B6C`, border `#D5DEE6`, strong border `#9FB1C2`, canvas `#F5F8FB`; sidebar 256 px, topbar 64 px, content inset 24/16 px; H1 28/36, H3 18/26, body 14/22, label 13/20, caption 12/16. Inter được đóng gói local gồm glyph tiếng Việt. CSS thuần, không cài Tailwind.

Asset gốc đã tải vào `public/assets`: logo trắng (sidebar), logo xanh (login), ảnh cà phê (login), edit/trash 17×17, chevron 24×24, circle 10×10 cho checkbox đăng nhập. Không dùng screenshot làm nền UI, không dùng URL asset Figma tạm thời ở runtime. Icon SVG giữ kích thước nội tại; logo đặt vào khung 96×96 như context. Các image có alt text khi có nội dung.

Implementation chuyển frame tuyệt đối thành flex/grid/table semantic. Phiếu nhập/xuất, kiểm kê, chi tiết nguyên vật liệu và chi tiết phê duyệt dùng trang riêng với breadcrumb và nút quay lại. Thêm/sửa nguyên vật liệu và công thức dùng dialog đúng nhóm màn hình nguồn. Bảng cuộn ngang ở mobile, sidebar chuyển menu đóng/mở. Responsive là quyết định triển khai vì không có frame mobile được cung cấp.

Đợt rà soát 13/11/2026 mở rộng đối chiếu dashboard quản lý/nhân viên (33:8632,33:8571), chi tiết nhập/xuất (17:4453,14:3102), sự cố (14:3812), chi tiết kiểm kê (1:1232,1:2448), bốn chi tiết phê duyệt (4:207,4:481,4:625,4:762), từ chối/thành công (4:904,4:992,4:1171), công thức/lịch sử (12:3137), xem trước và lỗi nhập bán hàng (12:4992,12:5115,12:5215,12:5334), lỗi đăng nhập (4:18500,4:18517). Đã sửa chiều rộng dialog, nhóm thông tin, cột bảng, trạng thái nút, vị trí thông báo dưới phải và định dạng ngày.

Khác biệt có chủ ý theo người dùng: nhân viên không thấy tồn lý thuyết/chênh lệch dù frame mẫu có hiển thị; số tổng hợp được tính từ dữ liệu mock thực; trạng thái sau duyệt phản ánh giao dịch thực. Có bộ lọc ngày tồn kho, chỉ trả snapshot đã có. Không khẳng định đối chiếu pixel tự động hoặc mọi tổ hợp state; xem VALIDATION.md.
