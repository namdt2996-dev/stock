-- Migration: 009_rpc_stock_adjustment_by_batch
-- Kiểm kho theo TỪNG LÔ: điều chỉnh trực tiếp current_quantity của stock_id
-- về số thực tế đếm được, ghi transaction_details cho phần chênh lệch.
--   - Thiếu (v_diff < 0): location_from = kho
--   - Thừa (v_diff > 0): location_to   = kho
-- Thay thế bản cũ (điều chỉnh theo product_id) ở migration 008.

DROP FUNCTION IF EXISTS create_stock_adjustment(UUID, DATE, JSONB);

CREATE OR REPLACE FUNCTION create_stock_adjustment(
  p_location_id UUID,
  p_transaction_date DATE,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_item JSONB;
  v_batch_id UUID;
  v_stock_id UUID;
  v_actual_qty NUMERIC;
  v_system_qty NUMERIC;
  v_diff NUMERIC;
  v_unit_cost NUMERIC;
BEGIN
  INSERT INTO transactions (transaction_type, transaction_date,
    reference_doc)
  VALUES ('ADJUST', p_transaction_date, 'Kiểm kho')
  RETURNING transaction_id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_batch_id   := (v_item->>'batch_id')::UUID;
    v_stock_id   := (v_item->>'stock_id')::UUID;
    v_actual_qty := (v_item->>'actual_quantity')::NUMERIC;

    SELECT current_quantity INTO v_system_qty
    FROM inventory_stock_level
    WHERE stock_id = v_stock_id;

    SELECT unit_cost INTO v_unit_cost
    FROM batches WHERE batch_id = v_batch_id;

    v_diff := v_actual_qty - v_system_qty;
    CONTINUE WHEN v_diff = 0;

    UPDATE inventory_stock_level
    SET current_quantity = v_actual_qty
    WHERE stock_id = v_stock_id;

    INSERT INTO transaction_details (
      transaction_id, batch_id,
      location_from, location_to,
      quantity_moved, unit_cost, total_amount
    ) VALUES (
      v_transaction_id, v_batch_id,
      CASE WHEN v_diff < 0 THEN p_location_id ELSE NULL END,
      CASE WHEN v_diff > 0 THEN p_location_id ELSE NULL END,
      ABS(v_diff), v_unit_cost,
      ABS(v_diff) * v_unit_cost
    );
  END LOOP;

  RETURN v_transaction_id;
END;
$$;
