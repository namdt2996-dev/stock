import { supabase } from './../lib/supabase'

/**
 * Lấy TỪNG LÔ đang có tồn (> 0) trong một kho (không gom theo sản phẩm).
 * Trả về mảng dòng:
 *   { stock_id, batch_id, system_quantity, lot_number, expiry_date,
 *     received_date, unit_cost, product_id, product_name, unit_of_measure,
 *     pack_unit, conversion_factor, warehouse_name }
 * Sort theo product_name ASC, expiry_date ASC.
 */
export async function getStockForTake(location_id) {
  const { data, error } = await supabase
    .from('inventory_stock_level')
    .select(
      `
      stock_id,
      batch_id,
      current_quantity,
      batches:batch_id (
        lot_number, expiry_date, received_date, unit_cost,
        products:product_id (
          product_id, name, unit_of_measure, pack_unit, conversion_factor
        )
      ),
      locations:location_id ( warehouse_name )
    `
    )
    .eq('location_id', location_id)
    .gt('current_quantity', 0)
  if (error) throw error

  const rows = (data ?? []).map((r) => {
    const b = r.batches
    const p = b?.products
    return {
      stock_id: r.stock_id,
      batch_id: r.batch_id,
      system_quantity: Number(r.current_quantity) || 0,
      lot_number: b?.lot_number ?? '',
      expiry_date: b?.expiry_date ?? null,
      received_date: b?.received_date ?? null,
      unit_cost: b?.unit_cost ?? null,
      product_id: p?.product_id ?? null,
      product_name: p?.name ?? '',
      unit_of_measure: p?.unit_of_measure ?? '',
      pack_unit: p?.pack_unit ?? null,
      conversion_factor: p?.conversion_factor ?? null,
      warehouse_name: r.locations?.warehouse_name ?? '',
    }
  })

  rows.sort((a, b) => {
    const byName = a.product_name.localeCompare(b.product_name)
    if (byName !== 0) return byName
    if (!a.expiry_date) return 1
    if (!b.expiry_date) return -1
    return a.expiry_date.localeCompare(b.expiry_date)
  })

  return rows
}

/**
 * Tạo phiếu điều chỉnh tồn (kiểm kho) theo TỪNG LÔ — ATOMIC qua RPC.
 * items: [{ batch_id, stock_id, actual_quantity }]
 * Chỉ nên truyền các lô có chênh lệch ≠ 0.
 */
export async function createStockAdjustment(location_id, date, items) {
  const { data, error } = await supabase.rpc('create_stock_adjustment', {
    p_location_id: location_id,
    p_transaction_date: date,
    p_items: items,
  })
  if (error) throw error
  return data
}
