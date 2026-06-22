-- Migration: 004_rpc_create_outbound_receipt
-- Postgres function ghi phiếu xuất kho ATOMIC theo nguyên tắc FEFO
-- (First Expired, First Out): tự chọn lô có expiry_date gần nhất để xuất trước.
-- Nếu tổng tồn không đủ -> RAISE EXCEPTION (rollback toàn bộ phiếu).

CREATE OR REPLACE FUNCTION create_outbound_receipt(
  p_transaction_date DATE,
  p_partner_id UUID,
  p_exit_reason_code TEXT,
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
  INSERT INTO transactions (
    partner_id, transaction_type, exit_reason_code,
    transaction_date, reference_doc
  )
  VALUES (
    p_partner_id, 'OUT', p_exit_reason_code::exit_reason_code,
    p_transaction_date, p_reference_doc
  )
  RETURNING transaction_id INTO v_transaction_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::UUID;
    v_qty_needed := (v_line->>'quantity')::NUMERIC;

    SELECT COALESCE(SUM(isl.current_quantity), 0)
    INTO v_total_available
    FROM inventory_stock_level isl
    JOIN batches b ON b.batch_id = isl.batch_id
    WHERE b.product_id = v_product_id
      AND isl.current_quantity > 0;

    IF v_total_available < v_qty_needed THEN
      RAISE EXCEPTION 'Không đủ tồn kho: sản phẩm % cần % nhưng chỉ có %',
        v_product_id, v_qty_needed, v_total_available;
    END IF;

    v_qty_remaining := v_qty_needed;

    FOR v_batch IN
      SELECT isl.stock_id, isl.batch_id, isl.current_quantity,
             isl.location_id, b.expiry_date, b.unit_cost
      FROM inventory_stock_level isl
      JOIN batches b ON b.batch_id = isl.batch_id
      WHERE b.product_id = v_product_id
        AND isl.current_quantity > 0
      ORDER BY b.expiry_date ASC, b.received_date ASC
    LOOP
      EXIT WHEN v_qty_remaining <= 0;
      v_take := LEAST(v_batch.current_quantity, v_qty_remaining);

      UPDATE inventory_stock_level
      SET current_quantity = current_quantity - v_take
      WHERE stock_id = v_batch.stock_id;

      INSERT INTO transaction_details (
        transaction_id, batch_id,
        location_from, location_to,
        quantity_moved, unit_cost, total_amount
      )
      VALUES (
        v_transaction_id, v_batch.batch_id,
        v_batch.location_id, NULL,
        v_take, v_batch.unit_cost,
        v_take * v_batch.unit_cost
      );

      v_qty_remaining := v_qty_remaining - v_take;
    END LOOP;
  END LOOP;

  RETURN v_transaction_id;
END;
$$;
