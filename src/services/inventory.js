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
    p_lines: lines,
  })
  if (error) throw error
  return data
}

/**
 * Lấy danh sách tồn kho hiện tại — JOIN inventory_stock_level với batches,
 * products và locations.
 *
 * Trả về mảng phẳng các dòng:
 *   { product_name, sku, unit_of_measure, lot_number, expiry_date,
 *     current_quantity, warehouse_name, received_date }
 * Sắp xếp theo product_name ASC, expiry_date ASC.
 */
export async function getStockLevels() {
  const { data, error } = await supabase
    .from('inventory_stock_level')
    .select(
      `
      current_quantity,
      batches:batch_id (
        lot_number,
        expiry_date,
        received_date,
        products:product_id ( name, sku, unit_of_measure )
      ),
      locations:location_id ( warehouse_name )
    `
    )
  if (error) throw error

  const rows = (data ?? []).map((r) => ({
    product_name: r.batches?.products?.name ?? '',
    sku: r.batches?.products?.sku ?? '',
    unit_of_measure: r.batches?.products?.unit_of_measure ?? '',
    lot_number: r.batches?.lot_number ?? '',
    expiry_date: r.batches?.expiry_date ?? null,
    current_quantity: r.current_quantity,
    warehouse_name: r.locations?.warehouse_name ?? '',
    received_date: r.batches?.received_date ?? null,
  }))

  rows.sort((a, b) => {
    const byName = a.product_name.localeCompare(b.product_name)
    if (byName !== 0) return byName
    // expiry_date null xuống cuối
    if (!a.expiry_date) return 1
    if (!b.expiry_date) return -1
    return a.expiry_date.localeCompare(b.expiry_date)
  })

  return rows
}
