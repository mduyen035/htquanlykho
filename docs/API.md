# Kết nối backend Trình Cà Phê

Frontend dùng các endpoint nghiệp vụ của [`trinh-ca-phe-backend`](https://github.com/mduyen035/trinh-ca-phe-backend). Adapter tại `src/infrastructure/rest-adapter.ts` ghép dữ liệu API vào mô hình hiển thị và chuyển từng thao tác giao diện thành lệnh API tương ứng.

## Cấu hình

```dotenv
VITE_DATA_SOURCE=rest
VITE_API_BASE_URL=https://trinh-ca-phe-api.onrender.com/api
```

Không đưa `DATABASE_URL`, mật khẩu hoặc `JWT_SECRET` vào biến `VITE_*`. Backend phải thêm origin chính xác của frontend vào `CORS_ORIGIN` trên Render. Khi chạy local, mặc định API ở `http://127.0.0.1:4000/api`.

## Xác thực

`POST /auth/login` trả `{token,user}`. Frontend giữ token trong `sessionStorage` và gửi `Authorization: Bearer <token>`; tải lại trang sẽ kiểm tra `GET /auth/me`. `POST /auth/logout` có thể trả HTTP 204. Vai trò backend `chucuahang`, `quanly`, `nhanvien` được ánh xạ thành `owner`, `manager`, `staff` cho giao diện. Tài khoản demo mock không dùng để đăng nhập REST nếu chưa tồn tại ở backend.

## Nguồn dữ liệu theo màn hình

| Giao diện                  | API                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Danh mục, tồn và công thức | `/branches`, `/materials`, `/suppliers`, `/recipes`, `/recipes/:id/versions/:versionId` |
| Phiếu kho                  | `/imports`, `/imports/:id`, `/exports`, `/exports/:id`                                  |
| Kiểm kê, duyệt             | `/stocktakes`, `/stocktakes/:id`, `/approvals`                                          |
| POS                        | `/sales-imports`, `/sales-imports/:id`                                                  |
| Báo cáo                    | `/reports/inventory`, `/reports/loss`                                                   |

Thao tác tạo/sửa/xóa/ghi nhận/duyệt gọi endpoint tương ứng của từng nhóm. Server sinh mã phiếu, kiểm tra quyền và tồn; frontend chỉ truyền ID và dữ liệu nhập. Nhận hàng gửi `idempotencyKey` mới cho từng đợt. POS dùng `YYYY-MM` hoặc `YYYY-Q1`…`YYYY-Q4`, xác nhận `overwrite` khi các kỳ chồng lấn. POS chỉ lưu tiêu hao lý thuyết và không trừ tồn vật lý.

Phiếu kiểm kê được tạo trên server khi mở form để chụp số tồn. Nhân viên không nhận số hệ thống; quản lý xử lý nguyên nhân và biện pháp trên API `/stocktakes/:id/handling`, sau đó tạo đề xuất điều chỉnh.

## Giới hạn hiện tại

Các danh sách backend chưa có phân trang server; adapter tải chi tiết từng phiếu để giữ nguyên màn hình hiện tại. Báo cáo tồn theo ngày gọi `/reports/inventory?at=...&from=...` và lấy số liệu từ sổ biến động. Mức tối thiểu của giao diện là một giá trị cho nguyên vật liệu, trong khi backend lưu theo chi nhánh; adapter hiển thị mức của chi nhánh đang đăng nhập và khi sửa áp dụng mức đó cho các chi nhánh mà tài khoản quản lý được. Lịch sử audit riêng chưa được API công khai.
