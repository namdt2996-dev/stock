-- Migration: 002_rls_policies
-- RLS policies cho 7 bảng: chỉ authenticated user mới đọc/ghi được.
-- File idempotent: bật RLS tường minh + DROP POLICY IF EXISTS trước mỗi CREATE
-- để có thể chạy lại an toàn.

-- =====================================================================
-- Bật Row Level Security cho 7 bảng
-- =====================================================================
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_details   ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Policies: authenticated_all (chỉ authenticated user đọc/ghi)
-- =====================================================================
DROP POLICY IF EXISTS "authenticated_all" ON products;
CREATE POLICY "authenticated_all" ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON partners;
CREATE POLICY "authenticated_all" ON partners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON locations;
CREATE POLICY "authenticated_all" ON locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON batches;
CREATE POLICY "authenticated_all" ON batches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON inventory_stock_level;
CREATE POLICY "authenticated_all" ON inventory_stock_level
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON transactions;
CREATE POLICY "authenticated_all" ON transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON transaction_details;
CREATE POLICY "authenticated_all" ON transaction_details
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
