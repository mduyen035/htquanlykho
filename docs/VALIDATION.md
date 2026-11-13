# Kiểm tra bản rà soát 13/11/2026

Môi trường: Windows, Node.js 24, Chromium/Playwright. Phạm vi: frontend React TypeScript dùng mock; không sửa file Figma, không triển khai hosting.

## Kết quả

- 26 kiểm thử nghiệp vụ: phân quyền, snapshot kiểm kê lúc bắt đầu, xử lý chênh lệch từng dòng, kiểm kê mù, duyệt, giao bù, chống ghi nhận lặp, rollback, chống âm kho, ghi đè tháng/quý không trừ hai lần, món thiếu công thức, báo cáo theo ngày và schema dữ liệu.
- 18 kịch bản trình duyệt đều thành công trên bản sửa: các trang desktop và trang chi tiết; tạo/sửa phiếu, nhận hàng, sự cố xuất; ba dashboard; kiểm kê nhân viên sang quản lý; thêm nguyên liệu và duyệt; từ chối có lý do; Excel thật, cảnh báo thiếu công thức, xác nhận quý thay tháng; lỗi đăng nhập; xuất Excel và mobile 390×844.
- Screenshot tự động tại `test-results/audit` và `test-results/previews`, desktop 1440×900. Kiểm tra trực quan nhóm thông tin, trang chi tiết, dialog, bảng, dashboard và trạng thái lỗi. Không thực hiện pixel diff tự động.
- Asset local được kiểm tra tải thành công: logo sidebar 96×96, login 128×128, edit/trash 17×17, chevron 24×24.
- TypeScript và build production được kiểm tra trước khi bàn giao. ExcelJS tải theo nhu cầu, Vite có thể cảnh báo chunk Excel vượt 500 KB; không làm build thất bại.

Bổ sung theo 9 yêu cầu mới: breadcrumb có thể quay lại, nhãn chi nhánh theo bộ lọc, topbar/sidebar cố định khi cuộn, menu mở hết vừa các chiều cao 900/768/650 px, đăng xuất căn giữa, nút thêm nguyên liệu trong công thức, trạng thái tìm kiếm rỗng có kính lúp, lý do xóa bắt buộc và Chủ cửa hàng áp dụng trực tiếp.

## Giới hạn

Chưa có backend để kiểm thử API, CORS/session, bảo mật payload hoặc giao dịch nhiều người dùng. Chưa kiểm thử Firefox/Safari và mọi tổ hợp trạng thái của Figma. Số mock cũ được giữ nguyên, nên dữ liệu trình duyệt đang có có thể khác dữ liệu mẫu mới. Xem BUSINESS.md về các quyết định được xác nhận và giới hạn mock.

## Chạy lại trên PowerShell

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Nếu chưa có Chromium: `npx.cmd playwright install chromium`. Chạy ứng dụng bằng `.\start.cmd` trong thư mục dự án. Không cần đổi Execution Policy của Windows.
