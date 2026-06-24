-- Migration: 011_rpc_create_transfer
-- Chuyển kho (TRANSFER): trừ tồn ở kho đi theo FEFO, cộng vào kho đến.

-- BẮT BUỘC: ON CONFLICT (batch_id, location_id) trong function cần một
-- ràng buộc UNIQUE tương ứng. Bảng inventory_stock_level (migration 001)
-- chưa có nên thêm ở đây (guarded để idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_stock_level_batch_location_key'
  ) THEN
    ALTER TABLE inventory_stock_level
      ADD CONSTRAINT inventory_stock_level_batch_location_key
      UNIQUE (batch_id, location_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION create_transfer(
  p_transaction_date DATE,
  p_location_from UUID,
  p_location_to UUID,
  p_reference_doc TEXT,
  p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_line JSONB;
  v_product_id UUID;
  v_qty_needed NUMERIC;
  v_qty_remaining NUMERIC;
  v_total_available NUMERIC;
  v_batch RECORD;
  v_take NUMERIC;
BEGIN
  -- Validate: kho đi và kho đến không được giống nhau
  IF p_location_from = p_location_to THEN
    RAISE EXCEPTION 'Kho đi và kho đến không được giống nhau';
  END IF;

  INSERT INTO transactions (
    transaction_type, transaction_date, reference_doc
  )
  VALUES ('TRANSFER', p_transaction_date, p_reference_doc)
  RETURNING transaction_id INTO v_transaction_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::UUID;
    v_qty_needed := (v_line->>'quantity')::NUMERIC;

    -- Kiểm tra tồn kho tại kho đi
    SELECT COALESCE(SUM(isl.current_quantity), 0)
    INTO v_total_available
    FROM inventory_stock_level isl
    JOIN batches b ON b.batch_id = isl.batch_id
    WHERE b.product_id = v_product_id
      AND isl.location_id = p_location_from
      AND isl.current_quantity > 0;

    IF v_total_available < v_qty_needed THEN
      RAISE EXCEPTION 'Không đủ tồn kho tại kho đi: cần % nhưng chỉ có %',
        v_qty_needed, v_total_available;
    END IF;

    -- FEFO từ kho đi
    v_qty_remaining := v_qty_needed;

    FOR v_batch IN
      SELECT isl.stock_id, isl.batch_id, isl.current_quantity, b.unit_cost
      FROM inventory_stock_level isl
      JOIN batches b ON b.batch_id = isl.batch_id
      WHERE b.product_id = v_product_id
        AND isl.location_id = p_location_from
        AND isl.current_quantity > 0
      ORDER BY b.expiry_date ASC, b.received_date ASC
    LOOP
      EXIT WHEN v_qty_remaining <= 0;
      v_take := LEAST(v_batch.current_quantity, v_qty_remaining);

      -- Trừ tồn kho đi
      UPDATE inventory_stock_level
      SET current_quantity = current_quantity - v_take
      WHERE stock_id = v_batch.stock_id;

      -- Cộng vào kho đến (upsert theo batch + location)
      INSERT INTO inventory_stock_level (batch_id, location_id, current_quantity)
      VALUES (v_batch.batch_id, p_location_to, v_take)
      ON CONFLICT (batch_id, location_id)
      DO UPDATE SET current_quantity =
        inventory_stock_level.current_quantity + v_take;

      -- Ghi transaction detail
      INSERT INTO transaction_details (
        transaction_id, batch_id,
        location_from, location_to,
        quantity_moved, unit_cost, total_amount
      ) VALUES (
        v_transaction_id, v_batch.batch_id,
        p_location_from, p_location_to,
        v_take, v_batch.unit_cost,
        v_take * v_batch.unit_cost
      );

      v_qty_remaining := v_qty_remaining - v_take;
    END LOOP;
  END LOOP;

  RETURN v_transaction_id;
END;
$$;
