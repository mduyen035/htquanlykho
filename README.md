# Trình Cà Phê — Quản trị tồn kho & hao hụt

Ứng dụng React + TypeScript + Vite theo Clean Architecture, dựng từ Figma `3r0MaVbRRf7a6gKV2EVfh3` và báo cáo SDD `50K141.08.3007_da_danh_so.docx` (bản sửa đổi 08/11/2026). Giao diện tiếng Việt, mock data có lưu tại trình duyệt, có adapter REST để tích hợp sau. Chưa có backend thật và chưa triển khai hosting.

## Chạy dự án

Yêu cầu Node.js 24 LTS (đã kiểm tra với 24.22.1). Trong thư mục dự án:

```powershell
npm.cmd ci
npm.cmd run dev
```

Trên Windows PowerShell, chạy `npm.cmd` thay cho `npm` để tránh lỗi Execution Policy chặn `npm.ps1`. Không cần thay đổi chính sách bảo mật Windows. Các script trong package.json gọi trực tiếp CLI qua Node để chạy được khi đường dẫn dự án có dấu &; không cần đổi tên thư mục. Bạn cũng có thể chạy `.\install.cmd` để cài dependency, sau đó `.\start.cmd` để khởi động; hai tệp tự chuyển tới thư mục dự án.

Mở http://127.0.0.1:5173. Mặc định dùng mock, không cần tạo `.env`.

| Vai trò            | Tên đăng nhập  | Mật khẩu demo |
| ------------------ | -------------- | ------------- |
| Chủ cửa hàng       | buiducmanh     | Trinh@123     |
| Quản lý Hải Châu   | nguyenthihuong | Trinh@123     |
| Nhân viên Hải Châu | nguyenminhanh  | Trinh@123     |

Các tài khoản này chỉ thuộc môi trường demo. Dữ liệu lưu bằng localStorage (`trinh-inventory-v1`), phiên đăng nhập lưu sessionStorage. Để khởi tạo lại dữ liệu demo, xóa riêng khóa localStorage này rồi tải lại trang. Mock phù hợp thử luồng trong một tab, không phải cơ sở dữ liệu nhiều người dùng.

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run preview
```

## Chức năng

- Đăng nhập demo ba vai trò; điều hướng và phạm vi chi nhánh theo vai trò.
- Tổng quan yêu cầu chờ duyệt và cảnh báo tồn thấp.
- Nguyên vật liệu: lọc/tìm kiếm/xem chi tiết; đề xuất thêm, sửa, ngừng sử dụng; quản lý gửi chờ duyệt, Chủ cửa hàng áp dụng trực tiếp.
- Nhập kho: tạo/sửa/xóa mềm phiếu chưa duyệt; phê duyệt; kiểm nhận; ghi nhận giao bù nhiều đợt; cộng tồn theo số đạt chất lượng mới nhận.
- Xuất kho: nội bộ chuyển thẳng chờ xuất; điều chuyển do quản lý tạo chờ duyệt; ghi nhận thực xuất và kiểm tra lại tồn kho tại thời điểm thực hiện.
- Kiểm kê: nhập số thực tế, tự đối chiếu số hệ thống, đề xuất điều chỉnh nếu có chênh lệch. Nhân viên không thấy tồn lý thuyết hoặc chênh lệch.
- Bốn nhóm phê duyệt; xem chi tiết, chấp thuận, từ chối có lý do và lịch sử quyết định.
- Công thức: xem định lượng/phiên bản/lịch sử; đề xuất thêm/sửa/xóa, quản lý giữ phiên bản cũ cho đến khi được duyệt; Chủ cửa hàng áp dụng trực tiếp.
- Dữ liệu bán hàng: tải tệp mẫu `.xlsx`, kiểm tra và xem trước; nhập theo tháng/quý và chi nhánh; xác nhận thay thế kỳ chồng nhau, hoàn tiêu hao cũ trước khi tính dữ liệu mới. Món thiếu công thức được cảnh báo riêng.
- Báo cáo tồn kho theo ngày có snapshot và hao hụt theo kỳ; lọc và xuất Excel thật.
- Trạng thái tải, lỗi, rỗng, thông báo kết quả; dialog bàn phím, focus, menu mobile và bảng cuộn ngang.

## Kiến trúc

```text
src/
  domain/          Entity, vai trò, trạng thái, quy tắc thuần; không phụ thuộc React/API
  application/     Hợp đồng repository, command/use case giao dịch, truy vấn báo cáo
  infrastructure/  Mock/localStorage, REST/HTTP, Zod DTO mapper, Excel, seed
  presentation/    Trang, component, CSS design tokens
  app/             Composition root, DI, auth/session và state orchestration
tests/
  business.test.ts Kiểm thử giao dịch, phân quyền, hao hụt, ghi đè, DTO
  e2e/             Kiểm thử trình duyệt, thao tác chính, responsive, xuất file
docs/
  API.md           Hợp đồng REST đề xuất và hướng dẫn tích hợp
  BUSINESS.md      Quy tắc, quyết định khi tài liệu mâu thuẫn, giới hạn mock
  DESIGN.md        Nguồn node Figma, asset và kiểm tra giao diện
```

UI gửi command qua `useApp().run()`. `InventoryRepository` là cổng dữ liệu. Mock gọi `executeCommand()` để kiểm tra và xử lý toàn bộ giao dịch trên bản sao, sau đó mới lưu nếu thành công. REST gửi command tới backend, nơi phải thực thi cùng quy tắc trong transaction. Không lưu state kho trực tiếp từ component.

## Kết nối REST sau

Sao chép `.env.example` thành `.env.local`, đặt `VITE_DATA_SOURCE=rest` và `VITE_API_BASE_URL`. Adapter hiện dùng hợp đồng **đề xuất**, chưa được xác nhận bởi backend. Nếu backend có endpoint/DTO khác, sửa `RestInventoryRepository` và `mapDatabase`, không sửa domain hoặc trang. Xem [docs/API.md](docs/API.md).

## Phạm vi bàn giao và lưu ý

Đây là frontend hoạt động với mock và các use case chính, chưa phải hệ thống vận hành production. Dữ liệu và định lượng mẫu không đại diện định mức thật. Chưa có API lịch sử tồn kho, phân trang server, khôi phục mật khẩu thật hay kiểm thử đối chiếu pixel tự động. Snapshot mock chỉ có từ ngày khởi tạo/theo dõi, không dựng số dư cho lịch sử chưa tồn tại. Giao diện được thích ứng mobile vì nguồn tham chiếu là desktop. Nguyên vật liệu/công thức dùng dialog; phiếu kho, kiểm kê và phê duyệt dùng trang chi tiết theo Figma.

Các lỗi/mâu thuẫn nghiệp vụ của báo cáo và giả định của bản demo đã ghi trong [docs/BUSINESS.md](docs/BUSINESS.md). Chi tiết kiểm tra cuối cùng nằm ở [docs/VALIDATION.md](docs/VALIDATION.md).
