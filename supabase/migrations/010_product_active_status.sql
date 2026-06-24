-- Migration: 010_product_active_status
-- Thêm cờ is_active cho sản phẩm (ngừng dùng / đang dùng).
-- Sản phẩm Inactive không hiện trong các dropdown nhập/xuất/kiểm kho,
-- nhưng vẫn giữ trong Master Data và lịch sử.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
