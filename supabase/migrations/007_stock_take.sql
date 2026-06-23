-- Migration: 007_stock_take
-- Chuẩn bị cho chức năng Kiểm kho:
--  - products: thêm đơn vị đóng gói (pack_unit) + hệ số quy đổi (conversion_factor)
--  - transaction_type: thêm giá trị 'ADJUST' (điều chỉnh tồn khi kiểm kho)
-- Đã chạy thủ công trên Supabase Dashboard.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pack_unit TEXT,
  ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1;

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'ADJUST';
