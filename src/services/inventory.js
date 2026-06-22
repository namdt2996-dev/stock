import { supabase } from '../lib/supabase'

/**
 * Tạo phiếu nhập kho (inbound receipt).
 *
 * header: { transaction_date, partner_id, location_id, reference_doc, notes }
 * lines:  [{ product_id, lot_number, expiry_date, quantity, unit_cost }]
 *
 * Ghi theo thứ tự: transactions -> (mỗi line: batches -> inventory_stock_level
 * -> transaction_details). Nếu bất kỳ bước nào lỗi thì throw error.
 *
 * LƯU Ý: Supabase JS client không bọc nhiều INSERT trong một transaction DB,
 * nên đây KHÔNG phải atomic thực sự — nếu lỗi giữa chừng có thể để lại dữ liệu
 * dang dở. Để atomic tuyệt đối cần chuyển logic này vào một Postgres function
 * (RPC). Xem ghi chú khi triển khai.
 */
export async function createInboundReceipt(header, lines) {
  if (!lines || lines.length === 0) {
    throw new Error('Phiếu nhập phải có ít nhất 1 dòng sản phẩm.')
  }

  // a. INSERT transactions (header)
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      transaction_type: 'IN',
      partner_id: header.partner_id,
      transaction_date: header.transaction_date,
      reference_doc: header.reference_doc || null,
    })
    .select('transaction_id')
    .single()

  if (txError) {
    throw new Error(`Lỗi tạo phiếu (transactions): ${txError.message}`)
  }
  const transaction_id = tx.transaction_id

  // b. Mỗi dòng sản phẩm
  for (const [i, line] of lines.entries()) {
    const rowNo = i + 1

    // b1. INSERT batches
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        product_id: line.product_id,
        partner_id: header.partner_id,
        lot_number: line.lot_number || null,
        expiry_date: line.expiry_date || null,
        received_date: header.transaction_date,
        initial_quantity: line.quantity,
        unit_cost: line.unit_cost,
      })
      .select('batch_id')
      .single()

    if (batchError) {
      throw new Error(`Dòng ${rowNo} — lỗi tạo lô (batches): ${batchError.message}`)
    }
    const batch_id = batch.batch_id

    // b2. INSERT inventory_stock_level
    const { error: stockError } = await supabase
      .from('inventory_stock_level')
      .insert({
        batch_id,
        location_id: header.location_id,
        current_quantity: line.quantity,
      })

    if (stockError) {
      throw new Error(
        `Dòng ${rowNo} — lỗi cập nhật tồn (inventory_stock_level): ${stockError.message}`
      )
    }

    // b3. INSERT transaction_details
    const { error: detailError } = await supabase
      .from('transaction_details')
      .insert({
        transaction_id,
        batch_id,
        location_from: null,
        location_to: header.location_id,
        quantity_moved: line.quantity,
        unit_cost: line.unit_cost,
        total_amount: line.quantity * line.unit_cost,
      })

    if (detailError) {
      throw new Error(
        `Dòng ${rowNo} — lỗi tạo chi tiết (transaction_details): ${detailError.message}`
      )
    }
  }

  return { transaction_id }
}
