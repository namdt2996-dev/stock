import { supabase } from './../lib/supabase'

/**
 * Lấy danh sách sản phẩm đang có tồn (> 0) trong một kho, gom theo sản phẩm.
 * Trả về: { product_id, name, unit_of_measure, pack_unit, conversion_factor,
 *           system_quantity } — sort theo name ASC.
 */
export async function getStockForTake(location_id) {
  const { data, error } = await supabase
    .from('inventory_stock_level')
    .select(
      `
      current_quantity,
      batches:batch_id (
        products:product_id (
          product_id, name, unit_of_measure, pack_unit, conversion_factor
        )
      )
    `
    )
    .eq('location_id', location_id)
    .gt('current_quantity', 0)
  if (error) throw error

  // Gom theo product_id, cộng dồn current_quantity
  const map = new Map()
  for (const r of data ?? []) {
    const p = r.batches?.products
    if (!p) continue
    const existing = map.get(p.product_id)
    const qty = Number(r.current_quantity) || 0
    if (existing) {
      existing.system_quantity += qty
    } else {
      map.set(p.product_id, {
        product_id: p.product_id,
        name: p.name,
        unit_of_measure: p.unit_of_measure,
        pack_unit: p.pack_unit,
        conversion_factor: p.conversion_factor,
        system_quantity: qty,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Tạo phiếu điều chỉnh tồn (kiểm kho) — ATOMIC qua RPC create_stock_adjustment.
 * items: [{ product_id, actual_quantity, note }]
 * Chỉ nên truyền các item có chênh lệch ≠ 0.
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
