-- Migration: 001_create_tables
-- Tạo 6 bảng còn lại cho hệ thống quản lý tồn kho.
-- Bảng products đã được tạo trước trên Supabase => BỎ QUA.
-- Thứ tự tạo theo phụ thuộc FK:
--   partners -> locations -> batches -> inventory_stock_level
--   -> transactions -> transaction_details
-- Lưu ý: KHÔNG bật RLS trong file này (bật qua Supabase Dashboard).

-- =====================================================================
-- ENUM TYPES
-- =====================================================================
CREATE TYPE partner_type AS ENUM ('SUPPLIER', 'CUSTOMER');
CREATE TYPE transaction_type AS ENUM ('IN', 'OUT', 'TRANSFER');
CREATE TYPE exit_reason_code AS ENUM ('PROCESSING', 'SALE', 'STAFF', 'WASTE');

-- =====================================================================
-- 1. partners
-- =====================================================================
CREATE TABLE partners (
    partner_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    type        partner_type NOT NULL
);

-- =====================================================================
-- 2. locations
-- =====================================================================
CREATE TABLE locations (
    location_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_name  text NOT NULL,
    address         text
);

-- =====================================================================
-- 3. batches
--    product_id -> products (đã tạo sẵn), partner_id -> partners (Supplier)
-- =====================================================================
CREATE TABLE batches (
    batch_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        uuid NOT NULL REFERENCES products (product_id),
    partner_id        uuid REFERENCES partners (partner_id),
    lot_number        text,
    expiry_date       date,
    received_date     date,
    initial_quantity  numeric NOT NULL DEFAULT 0,
    unit_cost         numeric NOT NULL DEFAULT 0
);

-- =====================================================================
-- 4. inventory_stock_level
-- =====================================================================
CREATE TABLE inventory_stock_level (
    stock_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id          uuid NOT NULL REFERENCES batches (batch_id),
    location_id       uuid NOT NULL REFERENCES locations (location_id),
    current_quantity  numeric NOT NULL DEFAULT 0
);

-- =====================================================================
-- 5. transactions
--    CHECK: transaction_type = 'OUT' => exit_reason_code IS NOT NULL
-- =====================================================================
CREATE TABLE transactions (
    transaction_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id        uuid REFERENCES partners (partner_id),
    transaction_type  transaction_type NOT NULL,
    exit_reason_code  exit_reason_code,
    reference_doc     text,
    transaction_date  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_out_requires_exit_reason
        CHECK (transaction_type <> 'OUT' OR exit_reason_code IS NOT NULL)
);

-- =====================================================================
-- 6. transaction_details
--    location_from / location_to cho phép NULL
-- =====================================================================
CREATE TABLE transaction_details (
    detail_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  uuid NOT NULL REFERENCES transactions (transaction_id) ON DELETE CASCADE,
    batch_id        uuid NOT NULL REFERENCES batches (batch_id),
    location_from   uuid REFERENCES locations (location_id),
    location_to     uuid REFERENCES locations (location_id),
    quantity_moved  numeric NOT NULL,
    unit_cost       numeric,
    total_amount    numeric
);
