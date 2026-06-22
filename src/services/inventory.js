import { supabase } from '../lib/supabase'

/**
 * Tạo phiếu nhập kho (inbound receipt) — ATOMIC qua Postgres function (RPC).
 *
 * header: { transaction_date, partner_id, location_id, reference_doc, notes }
 * lines:  [{ product_id, lot_number, expiry_date, quantity, unit_cost }]
 *
 * Toàn bộ việc ghi (transactions -> batches -> inventory_stock_level ->
 * transaction_details) nằm trong một transaction DB ở phía Postgres
 * (function create_inbound_receipt, migration 003). Lỗi ở bất kỳ bước nào
 * sẽ rollback sạch toàn bộ phiếu.
 *
 * Trả về transaction_id (UUID) của phiếu vừa tạo.
 */
export async function createInboundReceipt(header, lines) {
  if (!lines || lines.length === 0) {
    throw new Error('Phiếu nhập phải có ít nhất 1 dòng sản phẩm.')
  }

  const { data, error } = await supabase.rpc('create_inbound_receipt', {
    p_transaction_date: header.transaction_date,
    p_partner_id: header.partner_id,
    p_location_id: header.location_id,
    p_reference_doc: header.reference_doc || null,
    p_lines: JSON.stringify(lines),
  })
  if (error) throw error
  return data
}
