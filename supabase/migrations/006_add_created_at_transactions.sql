-- Migration: 006_add_created_at_transactions
-- Thêm cột created_at để có mốc thời điểm tạo phiếu (phân biệt thứ tự các phiếu
-- cùng transaction_date). Đã chạy thủ công trên Supabase Dashboard.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
