# CLAUDE.md

Hướng dẫn ngữ cảnh dự án cho Claude Code và các thành viên phát triển.

---

## 1. Mô tả dự án

**Stock** là hệ thống quản lý tồn kho (Inventory Management System) hỗ trợ theo dõi
hàng hóa theo lô (batch), vị trí lưu kho (location) và đối tác (partner). Hệ thống
quản lý nhập – xuất – chuyển kho, và đặc biệt áp dụng nguyên tắc **FEFO
(First Expired, First Out)** để ưu tiên xuất các lô hàng có hạn sử dụng sớm nhất.

### Stack công nghệ

| Lớp        | Công nghệ                                   |
| ---------- | ------------------------------------------- |
| Frontend   | Vite + React + Tailwind CSS                 |
| Backend    | Supabase (PostgreSQL + Auth + RLS)          |
| Deploy FE  | Vercel                                      |
| Repo       | https://github.com/namdt2996-dev/stock.git  |

---

## 2. Schema cơ sở dữ liệu (7 bảng)

> Tất cả bảng dùng PostgreSQL trên Supabase. Khóa chính mặc định `id bigint generated
> always as identity` (hoặc `uuid` cho bảng cần). Mọi bảng có `created_at timestamptz
> default now()` và `updated_at timestamptz default now()`.

### 2.1. `Products` — Sản phẩm

| Field          | Type           | Ghi chú                              |
| -------------- | -------------- | ------------------------------------ |
| id             | bigint (PK)    | Khóa chính                           |
| sku            | text (unique)  | Mã sản phẩm                          |
| name           | text           | Tên sản phẩm                         |
| description    | text           | Mô tả                                |
| unit           | text           | Đơn vị tính (cái, hộp, kg…)          |
| barcode        | text           | Mã vạch                              |
| min_stock      | numeric        | Mức tồn tối thiểu (cảnh báo)         |
| is_active      | boolean        | Còn kinh doanh hay không             |
| created_at     | timestamptz    |                                      |
| updated_at     | timestamptz    |                                      |

### 2.2. `Partners` — Đối tác (NCC / Khách hàng)

| Field          | Type           | Ghi chú                              |
| -------------- | -------------- | ------------------------------------ |
| id             | bigint (PK)    | Khóa chính                           |
| code           | text (unique)  | Mã đối tác                           |
| name           | text           | Tên đối tác                          |
| type           | text           | `supplier` \| `customer` \| `both`   |
| phone          | text           | Số điện thoại                        |
| email          | text           | Email                                |
| address        | text           | Địa chỉ                              |
| is_active      | boolean        | Trạng thái                           |
| created_at     | timestamptz    |                                      |
| updated_at     | timestamptz    |                                      |

### 2.3. `Locations` — Vị trí lưu kho

| Field          | Type           | Ghi chú                              |
| -------------- | -------------- | ------------------------------------ |
| id             | bigint (PK)    | Khóa chính                           |
| code           | text (unique)  | Mã vị trí (VD: A-01-02)              |
| name           | text           | Tên vị trí / khu vực                 |
| type           | text           | `warehouse` \| `zone` \| `shelf`     |
| parent_id      | bigint (FK)    | → `Locations.id` (cây phân cấp)      |
| is_active      | boolean        | Trạng thái                           |
| created_at     | timestamptz    |                                      |
| updated_at     | timestamptz    |                                      |

### 2.4. `Batches` — Lô hàng (cốt lõi cho FEFO)

| Field          | Type           | Ghi chú                                  |
| -------------- | -------------- | ---------------------------------------- |
| id             | bigint (PK)    | Khóa chính                               |
| batch_no       | text           | Số lô                                     |
| product_id     | bigint (FK)    | → `Products.id`                          |
| manufacture_date | date         | Ngày sản xuất                            |
| expiry_date    | date           | **Hạn sử dụng — khóa cho logic FEFO**    |
| received_date  | date           | Ngày nhập kho                            |
| supplier_id    | bigint (FK)    | → `Partners.id` (đối tác cung cấp)       |
| cost_price     | numeric        | Giá vốn lô                               |
| created_at     | timestamptz    |                                          |
| updated_at     | timestamptz    |                                          |

> Ràng buộc gợi ý: `unique(product_id, batch_no)`; index trên `(product_id,
> expiry_date)` để truy vấn FEFO nhanh.

### 2.5. `InventoryStockLevel` — Mức tồn theo lô & vị trí

| Field          | Type           | Ghi chú                                  |
| -------------- | -------------- | ---------------------------------------- |
| id             | bigint (PK)    | Khóa chính                               |
| product_id     | bigint (FK)    | → `Products.id`                          |
| batch_id       | bigint (FK)    | → `Batches.id`                           |
| location_id    | bigint (FK)    | → `Locations.id`                         |
| quantity       | numeric        | Số lượng tồn hiện tại                     |
| reserved_qty   | numeric        | Số lượng đã giữ chỗ (chưa xuất)          |
| updated_at     | timestamptz    |                                          |

> Ràng buộc gợi ý: `unique(product_id, batch_id, location_id)`. Đây là bảng
> "số dư" — luôn được cập nhật khi có Transaction được xác nhận.

### 2.6. `Transactions` — Phiếu giao dịch (header)

| Field          | Type           | Ghi chú                                          |
| -------------- | -------------- | ------------------------------------------------ |
| id             | bigint (PK)    | Khóa chính                                       |
| code           | text (unique)  | Mã phiếu                                          |
| type           | text           | `inbound` \| `outbound` \| `transfer` \| `adjust`|
| partner_id     | bigint (FK)    | → `Partners.id` (NCC hoặc khách)                 |
| status         | text           | `draft` \| `confirmed` \| `cancelled`            |
| transaction_date | timestamptz  | Ngày giao dịch                                   |
| note           | text           | Ghi chú                                          |
| created_by     | uuid (FK)      | → `auth.users.id` (Supabase Auth)                |
| created_at     | timestamptz    |                                                  |
| updated_at     | timestamptz    |                                                  |

### 2.7. `TransactionDetails` — Chi tiết giao dịch (line items)

| Field           | Type           | Ghi chú                                          |
| --------------- | -------------- | ------------------------------------------------ |
| id              | bigint (PK)    | Khóa chính                                       |
| transaction_id  | bigint (FK)    | → `Transactions.id` (on delete cascade)          |
| product_id      | bigint (FK)    | → `Products.id`                                  |
| batch_id        | bigint (FK)    | → `Batches.id`                                   |
| from_location_id| bigint (FK)    | → `Locations.id` (xuất / chuyển từ)              |
| to_location_id  | bigint (FK)    | → `Locations.id` (nhập / chuyển đến)             |
| quantity        | numeric        | Số lượng                                          |
| unit_price      | numeric        | Đơn giá                                            |
| created_at      | timestamptz    |                                                  |

### Sơ đồ quan hệ FK

```
Products  1───* Batches               (Batches.product_id)
Partners  1───* Batches               (Batches.supplier_id)
Partners  1───* Transactions          (Transactions.partner_id)
Locations 1───* Locations             (Locations.parent_id, tự tham chiếu)

Products  1───* InventoryStockLevel   (InventoryStockLevel.product_id)
Batches   1───* InventoryStockLevel   (InventoryStockLevel.batch_id)
Locations 1───* InventoryStockLevel   (InventoryStockLevel.location_id)

Transactions 1───* TransactionDetails (TransactionDetails.transaction_id)
Products     1───* TransactionDetails (TransactionDetails.product_id)
Batches      1───* TransactionDetails (TransactionDetails.batch_id)
Locations    1───* TransactionDetails (from_location_id / to_location_id)

auth.users   1───* Transactions       (Transactions.created_by)
```

---

## 3. Lộ trình 5 giai đoạn

### ☐ Giai đoạn 1 — Khởi tạo & Schema
- [ ] Khởi tạo project Vite + React + Tailwind
- [ ] Tạo project Supabase, cấu hình biến môi trường
- [ ] Viết & test SQL tạo 7 bảng + ràng buộc FK
- [ ] Thiết lập RLS cơ bản cho các bảng
- [ ] Cấu hình deploy Vercel (preview)

### ☐ Giai đoạn 2 — Danh mục (Master Data)
- [ ] CRUD `Products`
- [ ] CRUD `Partners`
- [ ] CRUD `Locations` (hỗ trợ cây phân cấp)
- [ ] CRUD `Batches`
- [ ] Tìm kiếm / lọc / phân trang danh mục

### ☐ Giai đoạn 3 — Giao dịch kho
- [ ] Phiếu nhập kho (inbound) → cập nhật `InventoryStockLevel`
- [ ] Phiếu xuất kho (outbound)
- [ ] Phiếu chuyển kho (transfer giữa Locations)
- [ ] Phiếu điều chỉnh (adjust)
- [ ] Luồng trạng thái draft → confirmed → cancelled

### ☐ Giai đoạn 4 — Logic FEFO & Tồn kho
- [ ] Thuật toán gợi ý xuất theo FEFO (expiry_date sớm nhất trước)
- [ ] Báo cáo tồn kho theo sản phẩm / lô / vị trí
- [ ] Cảnh báo hàng sắp/đã hết hạn
- [ ] Cảnh báo tồn dưới `min_stock`
- [ ] Xử lý `reserved_qty` khi giữ chỗ

### ☐ Giai đoạn 5 — Hoàn thiện & Triển khai
- [ ] Auth & phân quyền theo vai trò
- [ ] Dashboard tổng quan
- [ ] Báo cáo xuất/nhập theo kỳ
- [ ] Tối ưu hiệu năng & index
- [ ] Deploy production trên Vercel

---

## 4. Quy tắc làm việc

1. **Test SQL trước.** Mọi thay đổi schema/migration phải được chạy thử và kiểm
   tra trên Supabase (SQL Editor hoặc migration) **trước khi** viết code frontend
   phụ thuộc vào nó.
2. **Commit sau mỗi milestone.** Hoàn thành một mục/đầu việc trong lộ trình thì
   commit ngay với message rõ ràng; không gộp nhiều milestone vào một commit.
3. **FEFO là ưu tiên cao nhất.** Mọi logic xuất kho mặc định tuân theo nguyên tắc
   First Expired, First Out — ưu tiên lô có `expiry_date` sớm nhất. Bất kỳ ngoại lệ
   nào cũng phải được nêu rõ và xác nhận trước khi triển khai.
