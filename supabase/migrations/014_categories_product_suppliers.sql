-- Migration: 014_categories_product_suppliers
-- Danh mục 2 cấp (categories tự tham chiếu parent_id) + bảng nối nhiều NCC cho
-- mỗi sản phẩm (product_suppliers, có cờ NCC chính). Đã chạy thủ công trên
-- Supabase Dashboard.

CREATE TABLE categories (
  category_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(category_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(category_id);

CREATE TABLE product_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(partner_id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(product_id, partner_id)
);
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON product_suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
