-- Migration: 013_rpc_inbound_with_reason
-- Cập nhật create_inbound_receipt: thêm tham số p_entry_reason_code và lưu vào
-- transactions.entry_reason_code.

-- Bỏ phiên bản cũ (5 tham số, không có p_entry_reason_code) để tránh overload
-- trùng tên gây nhập nhằng khi PostgREST chọn hàm.
DROP FUNCTION IF EXISTS create_inbound_receipt(DATE, UUID, UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION create_inbound_receipt(
  p_transaction_date DATE,
  p_partner_id UUID,
  p_location_id UUID,
  p_reference_doc TEXT,
  p_entry_reason_code TEXT,
  p_lines JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_batch_id UUID;
  v_line JSONB;
BEGIN
  INSERT INTO transactions (partner_id, transaction_type,
    entry_reason_code, transaction_date, reference_doc)
  VALUES (p_partner_id, 'IN',
    p_entry_reason_code::entry_reason_code,
    p_transaction_date, p_reference_doc)
  RETURNING transaction_id INTO v_transaction_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO batches (product_id, partner_id, lot_number,
      expiry_date, received_date, initial_quantity, unit_cost)
    VALUES (
      (v_line->>'product_id')::UUID,
      p_partner_id,
      v_line->>'lot_number',
      (v_line->>'expiry_date')::DATE,
      p_transaction_date,
      (v_line->>'quantity')::NUMERIC,
      (v_line->>'unit_cost')::NUMERIC
    )
    RETURNING batch_id INTO v_batch_id;

    INSERT INTO inventory_stock_level
      (batch_id, location_id, current_quantity)
    VALUES (v_batch_id, p_location_id,
      (v_line->>'quantity')::NUMERIC);

    INSERT INTO transaction_details (transaction_id, batch_id,
      location_from, location_to, quantity_moved, unit_cost, total_amount)
    VALUES (
      v_transaction_id, v_batch_id,
      NULL, p_location_id,
      (v_line->>'quantity')::NUMERIC,
      (v_line->>'unit_cost')::NUMERIC,
      (v_line->>'quantity')::NUMERIC * (v_line->>'unit_cost')::NUMERIC
    );
  END LOOP;

  RETURN v_transaction_id;
END;
$$;
