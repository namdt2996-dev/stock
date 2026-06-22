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

## 2. Schema database (7 bảng — thiết kế gốc)

### Products
- `product_id` (PK)
- `name`
- `sku` (UNIQUE)
- `unit_of_measure`

### Partners
- `partner_id` (PK)
- `name`
- `type` (ENUM: `'SUPPLIER'`, `'CUSTOMER'`)

### Locations
- `location_id` (PK)
- `warehouse_name`
- `address`

### Batches
- `batch_id` (PK)
- `product_id` (FK → `Products`)
- `partner_id` (FK → `Partners`) — lưu Supplier giao lô này
- `lot_number`
- `expiry_date`
- `received_date`
- `initial_quantity`
- `unit_cost`

### InventoryStockLevel
- `stock_id` (PK)
- `batch_id` (FK → `Batches`)
- `location_id` (FK → `Locations`)
- `current_quantity`

### Transactions
- `transaction_id` (PK)
- `partner_id` (FK → `Partners`)
- `transaction_type` (`IN` / `OUT` / `TRANSFER`)
- `exit_reason_code` (ENUM: `'PROCESSING'`, `'SALE'`, `'STAFF'`, `'WASTE'`)
  - NULL nếu `transaction_type` là `IN` hoặc `TRANSFER`
  - Bắt buộc có giá trị nếu `transaction_type` là `OUT`
- `reference_doc`
- `transaction_date`

### TransactionDetails
- `detail_id` (PK)
- `transaction_id` (FK → `Transactions`)
- `batch_id` (FK → `Batches`)
- `location_from` (FK → `Locations`, NULL nếu là giao dịch IN)
- `location_to` (FK → `Locations`, NULL nếu là giao dịch OUT)
- `quantity_moved`
- `unit_cost`
- `total_amount`

### Sơ đồ quan hệ FK

```
Products  1───* Batches               (Batches.product_id)
Partners  1───* Batches               (Batches.partner_id — Supplier giao lô)
Partners  1───* Transactions          (Transactions.partner_id)

Batches   1───* InventoryStockLevel   (InventoryStockLevel.batch_id)
Locations 1───* InventoryStockLevel   (InventoryStockLevel.location_id)

Transactions 1───* TransactionDetails (TransactionDetails.transaction_id)
Batches      1───* TransactionDetails (TransactionDetails.batch_id)
Locations    1───* TransactionDetails (location_from / location_to)
```

---

## 2b. Quy tắc xuất hàng (`exit_reason_code`)

Mọi giao dịch xuất (`transaction_type = 'OUT'`) phải mang một mã lý do xuất. Tất cả
đều tuân theo nguyên tắc **FEFO** (ưu tiên lô có `expiry_date` sớm nhất).

| Mã           | Ý nghĩa                          | FEFO | Partner       |
| ------------ | -------------------------------- | ---- | ------------- |
| `PROCESSING` | Xuất chế biến / bếp              | ✅   | NULL          |
| `SALE`       | Xuất bán thương mại              | ✅   | = khách hàng  |
| `STAFF`      | Sử dụng nội bộ                   | ✅   | NULL          |
| `WASTE`      | Hủy hàng hỏng / hết hạn          | ✅   | NULL          |

---

## 3. Lộ trình 5 giai đoạn

- [x] Giai đoạn 1A: Database — 7 bảng đã tạo trên Supabase ✓
- [x] Giai đoạn 1B: Vite + React + Tailwind khởi tạo thành công ✓
- [x] Giai đoạn 1C: React kết nối Supabase — fetch products OK ✓
- [ ] Giai đoạn 2: Auth (đăng nhập / đăng xuất)
- [ ] Giai đoạn 3: Nhập kho
- [ ] Giai đoạn 4: Tồn kho + Xuất hàng (FEFO)
- [ ] Giai đoạn 5: Báo cáo

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

---

## Ghi chú triển khai
- Tên bảng dùng lowercase + underscore (snake_case)
- Bảng products tạo riêng, 6 bảng còn lại qua migration `001_create_tables.sql`
- RLS đã bật trên tất cả 7 bảng
- `.env.local` chứa Supabase keys, không commit (covered by `*.local`)
- Anon/publishable key được dùng ở client, bảo mật qua RLS policies
- `src/lib/supabase.js` là entry point kết nối duy nhất
