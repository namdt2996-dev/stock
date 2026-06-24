-- Migration: 012_entry_reason_code
-- Lý do nhập kho: PURCHASE (mua hàng) / PRODUCTION (nhập sản lượng tự sản xuất).
-- Đã chạy thủ công trên Supabase Dashboard.

CREATE TYPE entry_reason_code AS ENUM ('PURCHASE', 'PRODUCTION');

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS entry_reason_code entry_reason_code;

-- Phiếu nhập cũ mặc định coi là mua hàng
UPDATE transactions SET entry_reason_code = 'PURCHASE'
WHERE transaction_type = 'IN';
