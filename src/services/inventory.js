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
    p_entry_reason_code: header.entry_reason_code || 'PURCHASE',
    p_lines: lines,
  })
  if (error) throw error
  return data
}

/**
 * Tạo phiếu xuất kho (outbound receipt) — ATOMIC qua Postgres function (RPC).
 *
 * header: { transaction_date, partner_id, exit_reason_code, reference_doc }
 * lines:  [{ product_id, quantity }]
 *
 * Việc chọn LÔ để xuất do phía DB tự quyết theo FEFO (hạn dùng gần nhất xuất
 * trước) trong function create_outbound_receipt — client KHÔNG chọn lô.
 *
 * Trả về transaction_id (UUID) của phiếu vừa tạo.
 */
export async function createOutboundReceipt(header, lines) {
  if (!lines || lines.length === 0) {
    throw new Error('Phiếu xuất phải có ít nhất 1 dòng sản phẩm.')
  }

  const { data, error } = await supabase.rpc('create_outbound_receipt', {
    p_transaction_date: header.transaction_date,
    p_partner_id: header.partner_id || null,
    p_location_id: header.location_id,
    p_exit_reason_code: header.exit_reason_code,
    p_reference_doc: header.reference_doc || null,
    p_lines: lines,
  })
  if (error) throw error
  return data
}

/**
 * Tạo phiếu chuyển kho (TRANSFER) — ATOMIC qua RPC create_transfer.
 * Trừ tồn kho đi theo FEFO, cộng vào kho đến.
 *
 * header: { transaction_date, location_from, location_to, reference_doc }
 * lines:  [{ product_id, quantity }]
 */
export async function createTransfer(header, lines) {
  if (!lines || lines.length === 0) {
    throw new Error('Phiếu chuyển phải có ít nhất 1 dòng sản phẩm.')
  }

  const { data, error } = await supabase.rpc('create_transfer', {
    p_transaction_date: header.transaction_date,
    p_location_from: header.location_from,
    p_location_to: header.location_to,
    p_reference_doc: header.reference_doc || null,
    p_lines: lines,
  })
  if (error) throw error
  return data
}

/**
 * Lấy danh sách sản phẩm CÓ TỒN (> 0) trong một kho cụ thể.
 * Dùng cho phiếu xuất: chỉ cho chọn sản phẩm thực sự có hàng trong kho đó.
 *
 * Trả về mảng { product_id, name, unit_of_measure } (distinct), sort name ASC.
 */
export async function getProductsByLocation(location_id) {
  const { data, error } = await supabase
    .from('inventory_stock_level')
    .select(
      `
      current_quantity,
      batches:batch_id (
        products:product_id ( product_id, name, unit_of_measure, is_active )
      )
    `
    )
    .eq('location_id', location_id)
    .gt('current_quantity', 0)
  if (error) throw error

  // Gộp distinct theo product_id; bỏ sản phẩm đã ngừng dùng (is_active = false)
  const map = new Map()
  for (const r of data ?? []) {
    const p = r.batches?.products
    if (p && p.is_active !== false && !map.has(p.product_id)) {
      map.set(p.product_id, {
        product_id: p.product_id,
        name: p.name,
        unit_of_measure: p.unit_of_measure,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Lấy danh sách tồn kho hiện tại — JOIN inventory_stock_level với batches,
 * products và locations.
 *
 * Trả về mảng phẳng các dòng:
 *   { product_name, sku, unit_of_measure, lot_number, expiry_date,
 *     current_quantity, warehouse_name, received_date }
 * Sắp xếp theo product_name ASC, expiry_date ASC.
 *
 * location_id (optional): nếu có giá trị thì chỉ lấy tồn của kho đó.
 */
export async function getStockLevels(location_id = null) {
  let query = supabase
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
  if (location_id) query = query.eq('location_id', location_id)

  const { data, error } = await query
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

/**
 * Lấy danh sách phiếu giao dịch (mỗi phiếu 1 dòng header) kèm số dòng chi tiết
 * và tổng giá trị.
 *
 * filters: { transaction_type, exit_reason_code, date_from, date_to, product_id }
 *   — đều optional.
 * Sắp xếp transaction_date DESC, created_at DESC (created_at thêm ở migration 006).
 */
export async function getTransactions(filters = {}) {
  const {
    transaction_type,
    exit_reason_code,
    entry_reason_code,
    date_from,
    date_to,
    product_id,
  } = filters

  // Lọc theo sản phẩm: tìm trước các transaction_id có chứa sản phẩm đó.
  let txIds = null
  if (product_id) {
    const { data: d, error: e } = await supabase
      .from('transaction_details')
      .select('transaction_id, batches!inner(product_id)')
      .eq('batches.product_id', product_id)
    if (e) throw e
    txIds = [...new Set((d ?? []).map((r) => r.transaction_id))]
    if (txIds.length === 0) return []
  }

  let query = supabase.from('transactions').select(
    `
      transaction_id, transaction_date, transaction_type,
      exit_reason_code, entry_reason_code, reference_doc,
      partners:partner_id ( name ),
      transaction_details (
        total_amount, location_from, location_to,
        batches:batch_id ( products:product_id ( categories:category_id ( name ) ) )
      )
    `
  )

  if (exit_reason_code) {
    query = query.eq('exit_reason_code', exit_reason_code)
  }
  if (entry_reason_code) {
    query = query.eq('entry_reason_code', entry_reason_code)
  }
  if (transaction_type && transaction_type !== 'all') {
    query = query.eq('transaction_type', transaction_type)
  }
  if (date_from) query = query.gte('transaction_date', date_from)
  if (date_to) query = query.lte('transaction_date', `${date_to}T23:59:59`)
  if (txIds) query = query.in('transaction_id', txIds)

  query = query
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((t) => {
    const details = t.transaction_details ?? []
    // ADJUST: tổng có dấu (tăng = location_to, giảm = location_from).
    // Các loại khác: tổng dương như thường.
    const total_value =
      t.transaction_type === 'ADJUST'
        ? details.reduce(
            (s, d) =>
              s + (d.location_to ? 1 : -1) * (Number(d.total_amount) || 0),
            0
          )
        : details.reduce((s, d) => s + (Number(d.total_amount) || 0), 0)
    // Danh sách category (distinct) của các SP trong phiếu — dùng cho báo cáo.
    const category_names = [
      ...new Set(
        details
          .map((d) => d.batches?.products?.categories?.name)
          .filter(Boolean)
      ),
    ]
    return {
      transaction_id: t.transaction_id,
      transaction_date: t.transaction_date,
      transaction_type: t.transaction_type,
      exit_reason_code: t.exit_reason_code,
      entry_reason_code: t.entry_reason_code,
      reference_doc: t.reference_doc,
      partner_name: t.partners?.name ?? null,
      line_count: details.length,
      total_value,
      category_names,
    }
  })
}

/**
 * Lấy chi tiết các dòng của một phiếu giao dịch.
 * Trả về: product_name, unit_of_measure, lot_number, expiry_date,
 *         quantity_moved, unit_cost, total_amount,
 *         location_from_name, location_to_name
 */
export async function getTransactionDetails(transaction_id) {
  const { data, error } = await supabase
    .from('transaction_details')
    .select(
      `
      quantity_moved, unit_cost, total_amount,
      batches:batch_id (
        lot_number, expiry_date,
        products:product_id ( name, unit_of_measure )
      ),
      from_loc:locations!location_from ( warehouse_name ),
      to_loc:locations!location_to ( warehouse_name )
    `
    )
    .eq('transaction_id', transaction_id)
  if (error) throw error

  return (data ?? []).map((d) => ({
    product_name: d.batches?.products?.name ?? '',
    unit_of_measure: d.batches?.products?.unit_of_measure ?? '',
    lot_number: d.batches?.lot_number ?? '',
    expiry_date: d.batches?.expiry_date ?? null,
    quantity_moved: d.quantity_moved,
    unit_cost: d.unit_cost,
    total_amount: d.total_amount,
    location_from_name: d.from_loc?.warehouse_name ?? null,
    location_to_name: d.to_loc?.warehouse_name ?? null,
  }))
}

/**
 * Số liệu tổng quan cho Dashboard. Tính từ inventory_stock_level (chỉ dòng còn
 * tồn > 0) JOIN batches.
 * Trả về: total_products, total_batches, expiring_7days, expiring_45days,
 *         total_stock_value.
 */
export async function getDashboardStats() {
  const { data, error } = await supabase
    .from('inventory_stock_level')
    .select(
      `
      batch_id,
      current_quantity,
      batches:batch_id ( product_id, expiry_date, unit_cost )
    `
    )
    .gt('current_quantity', 0)
  if (error) throw error

  const todayMs = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()
  const daysUntil = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - todayMs) / 86400000)
  }

  const products = new Set()
  const batches = new Set()
  const batches7 = new Set()
  const batches45 = new Set()
  let totalValue = 0

  for (const r of data ?? []) {
    const b = r.batches
    if (b?.product_id) products.add(b.product_id)
    batches.add(r.batch_id)
    totalValue += (Number(r.current_quantity) || 0) * (Number(b?.unit_cost) || 0)
    const d = daysUntil(b?.expiry_date)
    if (d !== null && d <= 7) batches7.add(r.batch_id)
    if (d !== null && d <= 45) batches45.add(r.batch_id)
  }

  return {
    total_products: products.size,
    total_batches: batches.size,
    expiring_7days: batches7.size,
    expiring_45days: batches45.size,
    total_stock_value: totalValue,
  }
}

/**
 * 5 (mặc định) giao dịch gần nhất — dùng lại getTransactions, không filter.
 */
export async function getRecentTransactions(limit = 5) {
  const all = await getTransactions({})
  return all.slice(0, limit)
}
