-- Migration: 008_rpc_stock_adjustment
-- Postgres function ghi phiếu điều chỉnh tồn (kiểm kho) ATOMIC.
-- Mỗi item: so sánh số thực tế với tồn hệ thống; nếu lệch thì điều chỉnh
-- current_quantity theo lô (ORDER BY expiry_date ASC) và ghi transaction_details.
--   - Thiếu (v_diff < 0): trừ tồn  -> location_from = kho
--   - Thừa (v_diff > 0): cộng tồn  -> location_to   = kho

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
  v_product_id UUID;
  v_actual_qty NUMERIC;
  v_batch RECORD;
  v_system_qty NUMERIC;
  v_diff NUMERIC;
  v_remaining NUMERIC;
  v_take NUMERIC;
BEGIN
  INSERT INTO transactions (transaction_type, transaction_date,
    reference_doc)
  VALUES ('ADJUST', p_transaction_date, 'Kiểm kho')
  RETURNING transaction_id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_actual_qty := (v_item->>'actual_quantity')::NUMERIC;

    SELECT COALESCE(SUM(isl.current_quantity), 0)
    INTO v_system_qty
    FROM inventory_stock_level isl
    JOIN batches b ON b.batch_id = isl.batch_id
    WHERE b.product_id = v_product_id
      AND isl.location_id = p_location_id;

    v_diff := v_actual_qty - v_system_qty;
    CONTINUE WHEN v_diff = 0;

    v_remaining := ABS(v_diff);

    FOR v_batch IN
      SELECT isl.stock_id, isl.batch_id, isl.current_quantity,
             b.unit_cost, b.expiry_date
      FROM inventory_stock_level isl
      JOIN batches b ON b.batch_id = isl.batch_id
      WHERE b.product_id = v_product_id
        AND isl.location_id = p_location_id
        AND isl.current_quantity > 0
      ORDER BY b.expiry_date ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_batch.current_quantity, v_remaining);

      UPDATE inventory_stock_level
      SET current_quantity = current_quantity +
        (CASE WHEN v_diff > 0 THEN v_take ELSE -v_take END)
      WHERE stock_id = v_batch.stock_id;

      INSERT INTO transaction_details (
        transaction_id, batch_id,
        location_from, location_to,
        quantity_moved, unit_cost, total_amount
      ) VALUES (
        v_transaction_id, v_batch.batch_id,
        CASE WHEN v_diff < 0 THEN p_location_id ELSE NULL END,
        CASE WHEN v_diff > 0 THEN p_location_id ELSE NULL END,
        v_take, v_batch.unit_cost,
        v_take * v_batch.unit_cost
      );

      v_remaining := v_remaining - v_take;
    END LOOP;
  END LOOP;

  RETURN v_transaction_id;
END;
$$;
