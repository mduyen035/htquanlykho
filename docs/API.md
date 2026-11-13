# Hợp đồng REST đề xuất

Chưa có OpenAPI hay server thật được cung cấp. Các đường dẫn dưới đây là điểm nối của adapter mẫu, **không khẳng định là endpoint đang tồn tại**.

## Cấu hình

```dotenv
VITE_DATA_SOURCE=rest
VITE_API_BASE_URL=http://localhost:8080/api
```

Frontend dùng `fetch` với `credentials: include`. Backend cần cấu hình CORS cho origin frontend và cookie session phù hợp. Không đặt khóa bí mật vào biến `VITE_*`. Backend chịu trách nhiệm xác thực, quyền, chi nhánh và chống CSRF theo cơ chế session đã chọn. Tài khoản demo chỉ có hiệu lực trong mock.

## Auth

| Method | Path           | Request               | Response                       |
| ------ | -------------- | --------------------- | ------------------------------ |
| POST   | `/auth/login`  | `{username,password}` | `{id,name,role,branchId}`      |
| POST   | `/auth/logout` | Không có              | JSON object, ví dụ `{ok:true}` |

`role`: `owner`, `manager`, `staff`. Adapter hiện không khôi phục session REST sau khi tải lại trang; bổ sung `GET /auth/me` theo contract backend sau này. Sai thông tin hoặc lỗi API được hiển thị cho người dùng.

## Snapshot và command

| Method | Path                  | Mô tả                                       |
| ------ | --------------------- | ------------------------------------------- |
| GET    | `/inventory/snapshot` | Snapshot domain JSON trong phạm vi được cấp |
| POST   | `/inventory/commands` | Command JSON; trả snapshot sau giao dịch    |

Response snapshot theo `Database` trong `src/domain/model.ts`. `mapDatabase` dùng Zod để kiểm tra kiểu và số hợp lệ, bỏ các trường ngoài schema. Thiếu collection/trường cần thiết sẽ chuyển sang trạng thái lỗi có nút thử lại. Khi backend trả DTO snake_case/envelope, chuyển đổi tại mapper trước khi parse.

`POST /inventory/commands` gửi header `Idempotency-Key` (UUID). Backend phải lưu và thực thi khóa này để tránh lặp giao dịch khi retry. Frontend chỉ gửi lệnh, không gửi danh tính/quyền actor để server tin cậy. Server lấy actor từ session.

Ví dụ tạo phiếu:

```json
{
  "type": "saveMovement",
  "editing": false,
  "movement": {
    "id": "PNK-client-generated-id",
    "kind": "inbound",
    "branchId": "hc",
    "supplier": "Cà phê Tây Nguyên",
    "type": "internal",
    "reason": "",
    "note": "Bổ sung nguyên liệu tuần mới",
    "date": "2026-11-10T08:00:00.000Z",
    "expectedDate": "2026-11-12",
    "creator": "Thông tin hiển thị, server phải thay thế",
    "status": "pending",
    "lines": [{ "materialId": "NVL-001", "quantity": 25 }]
  }
}
```

Các command union được khai báo đầy đủ tại `src/application/ports.ts`:

- `saveMaterial`, `saveRecipe`: `operation=create|update|delete`, xóa bắt buộc `reason` không rỗng. Actor quản lý tạo đề xuất chờ duyệt; actor Chủ cửa hàng áp dụng trực tiếp và lưu lịch sử hoàn tất. Backend phải lấy vai trò từ session, không tin actor phía client.
- `saveMovement`, `deleteMovement`: server kiểm tra trạng thái, quyền và số dư.
- `recordMovement`: `id`, `lines`, `note`, `outcome`, `incidentReason`. Nhập kho: `received` là **số nhận thêm của đợt này**, `defective` là số lỗi trong đợt. Số đạt = received − defective. Xuất kho: received đại diện số thực xuất; `outcome=incident` bắt buộc lý do, không dùng cột hàng lỗi của nhập kho.
- `decide`: `id`, `approve`, `reason`; chỉ owner, trạng thái pending, lý do bắt buộc khi từ chối.
- `beginCount`: `{id,branchId}` tạo draft và đóng băng tồn lý thuyết ngay lúc bắt đầu. Server giữ snapshot này, chỉ trả những trường được phép theo vai trò.
- `count`: gửi `draftId` và số thực tế; lấy số lý thuyết từ draft, không tin giá trị client. Nhân viên gửi xong chuyển `pendingHandling`, không tự tạo đề xuất thiếu lý do.
- `handleCount`: quản lý/chủ cửa hàng gửi `{id,lines:[{materialId,reason,remedy}]}`; yêu cầu giải trình từng dòng chênh lệch, sau đó mới tạo đề xuất điều chỉnh.
- `sales`: `period` nhận `YYYY-MM` hoặc `YYYY-Q1`…`YYYY-Q4`; `replaceOverlapping=true` chỉ sau xác nhận. Thay thế atomically các kỳ chồng nhau cùng chi nhánh, hoàn tiêu hao cũ rồi áp dụng tiêu hao mới. Lưu `missingRecipeIds` và chỉ tính món có công thức.

Snapshot bổ sung tùy chọn `countDrafts`, `stockSnapshots`, ảnh trước thay đổi `beforeMaterial`/`beforeRecipe` của đề xuất. Schema vẫn đọc dữ liệu mock cũ; không tự xóa dữ liệu người dùng. Backend phải cung cấp snapshot theo ngày từ sổ kho và lược bỏ tồn lý thuyết/chênh lệch khỏi mọi payload dành cho nhân viên. Frontend mock giữ dữ liệu trong trình duyệt nên không thay thế bảo mật API.

Backend nên trả lỗi `{message: string}` với HTTP status thích hợp. Lỗi HTTP/mạng/schema đều hiển thị rõ, không tự động chuyển sang mock.

## Trước khi vận hành thật

1. Thống nhất OpenAPI, DTO, đơn vị đo, quy tắc kỳ và timezone chi nhánh.
2. Thay snapshot bằng query theo tính năng và phân trang nếu dữ liệu lớn; không trả dữ liệu ngoài quyền, đặc biệt tồn lý thuyết cho nhân viên.
3. Thực hiện transaction, khóa cạnh tranh/optimistic concurrency, idempotency, ID phía server, audit và versioning.
4. Chốt nghiệp vụ điều chuyển hai đầu và các trường hợp ghi đè dữ liệu kỳ đã kiểm kê/đã điều chỉnh.
5. Kiểm thử contract/integration với server thật. Hệ thống chưa được kiểm thử với backend nào ở bản bàn giao này.
