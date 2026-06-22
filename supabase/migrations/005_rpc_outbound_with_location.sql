-- Migration: 005_rpc_outbound_with_location
-- Cập nhật create_outbound_receipt: thêm tham số p_location_id và lọc FEFO
-- theo đúng kho xuất. Tồn kho được tính & trừ trong phạm vi một kho cụ thể.
-- Nếu tồn trong kho đó không đủ -> RAISE EXCEPTION (rollback toàn bộ phiếu).

-- Bỏ phiên bản cũ (5 tham số, không có p_location_id) để tránh tạo overload
-- trùng tên gây nhập nhằng khi PostgREST chọn hàm.
DROP FUNCTION IF EXISTS create_outbound_receipt(DATE, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION create_outbound_receipt(
  p_transaction_date DATE,
  p_partner_id UUID,
  p_location_id UUID,
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
      AND isl.location_id = p_location_id
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
        AND isl.location_id = p_location_id
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
