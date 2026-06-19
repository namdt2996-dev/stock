-- Migration: 001_create_tables
-- Tạo 6 bảng còn lại cho hệ thống quản lý tồn kho.
-- Bảng Products đã được tạo trước trên Supabase => BỎ QUA.
-- Thứ tự tạo theo phụ thuộc FK:
--   Partners -> Locations -> Batches -> InventoryStockLevel
--   -> Transactions -> TransactionDetails
-- Lưu ý: KHÔNG bật RLS trong file này (bật qua Supabase Dashboard).

-- =====================================================================
-- ENUM TYPES
-- =====================================================================
CREATE TYPE partner_type AS ENUM ('SUPPLIER', 'CUSTOMER');
CREATE TYPE transaction_type AS ENUM ('IN', 'OUT', 'TRANSFER');
CREATE TYPE exit_reason_code AS ENUM ('PROCESSING', 'SALE', 'STAFF', 'WASTE');

-- =====================================================================
-- 1. Partners
-- =====================================================================
CREATE TABLE Partners (
    partner_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    type        partner_type NOT NULL
);

-- =====================================================================
-- 2. Locations
-- =====================================================================
CREATE TABLE Locations (
    location_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_name  text NOT NULL,
    address         text
);

-- =====================================================================
-- 3. Batches
--    product_id -> Products (đã tạo sẵn), partner_id -> Partners (Supplier)
-- =====================================================================
CREATE TABLE Batches (
    batch_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        uuid NOT NULL REFERENCES Products (product_id),
    partner_id        uuid REFERENCES Partners (partner_id),
    lot_number        text,
    expiry_date       date,
    received_date     date,
    initial_quantity  numeric NOT NULL DEFAULT 0,
    unit_cost         numeric NOT NULL DEFAULT 0
);

-- =====================================================================
-- 4. InventoryStockLevel
-- =====================================================================
CREATE TABLE InventoryStockLevel (
    stock_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id          uuid NOT NULL REFERENCES Batches (batch_id),
    location_id       uuid NOT NULL REFERENCES Locations (location_id),
    current_quantity  numeric NOT NULL DEFAULT 0
);

-- =====================================================================
-- 5. Transactions
--    CHECK: transaction_type = 'OUT' => exit_reason_code IS NOT NULL
-- =====================================================================
CREATE TABLE Transactions (
    transaction_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id        uuid REFERENCES Partners (partner_id),
    transaction_type  transaction_type NOT NULL,
    exit_reason_code  exit_reason_code,
    reference_doc     text,
    transaction_date  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_out_requires_exit_reason
        CHECK (transaction_type <> 'OUT' OR exit_reason_code IS NOT NULL)
);

-- =====================================================================
-- 6. TransactionDetails
--    location_from / location_to cho phép NULL
-- =====================================================================
CREATE TABLE TransactionDetails (
    detail_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  uuid NOT NULL REFERENCES Transactions (transaction_id) ON DELETE CASCADE,
    batch_id        uuid NOT NULL REFERENCES Batches (batch_id),
    location_from   uuid REFERENCES Locations (location_id),
    location_to     uuid REFERENCES Locations (location_id),
    quantity_moved  numeric NOT NULL,
    unit_cost       numeric,
    total_amount    numeric
);
