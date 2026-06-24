import { formatCurrency } from '../utils/formatCurrency'

const TYPE_TITLE = {
  IN: 'PHIẾU NHẬP KHO',
  OUT: 'PHIẾU XUẤT KHO',
  TRANSFER: 'PHIẾU CHUYỂN KHO',
  ADJUST: 'PHIẾU ĐIỀU CHỈNH (KIỂM KHO)',
}

const EXIT_REASON_LABELS = {
  PROCESSING: 'Xuất bếp',
  SALE: 'Xuất bán',
  STAFF: 'Nội bộ',
  WASTE: 'Hủy hàng',
}

const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('vi-VN'))
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')

const cell = {
  border: '1px solid #333',
  padding: '6px 8px',
  fontSize: '13px',
}
const cellR = { ...cell, textAlign: 'right' }

/**
 * Bản render phiếu để html2canvas chụp. Style INLINE để capture đúng.
 * Đặt ẩn ngoài màn hình (left: -9999px) ở component cha.
 */
function ReceiptPrintView({ id, transaction, details }) {
  if (!transaction) return null

  const total = (details ?? []).reduce(
    (s, d) => s + (Number(d.total_amount) || 0),
    0
  )

  return (
    <div
      id={id}
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        width: '720px',
        padding: '24px',
        background: '#ffffff',
        color: '#111',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
        {TYPE_TITLE[transaction.transaction_type] || 'PHIẾU GIAO DỊCH'}
      </h1>

      <div style={{ fontSize: '13px', lineHeight: '20px', marginBottom: '14px' }}>
        <div>Ngày: {fmtDate(transaction.transaction_date)}</div>
        <div>Số phiếu tham chiếu: {transaction.reference_doc || '—'}</div>
        {transaction.transaction_type === 'OUT' && (
          <div>
            Lý do xuất:{' '}
            {EXIT_REASON_LABELS[transaction.exit_reason_code] ||
              transaction.exit_reason_code ||
              '—'}
          </div>
        )}
        <div>Đối tác: {transaction.partner_name || '—'}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ ...cell, textAlign: 'left' }}>Sản phẩm</th>
            <th style={{ ...cell, textAlign: 'left' }}>Số lô</th>
            <th style={{ ...cell, textAlign: 'left' }}>Hạn dùng</th>
            <th style={cellR}>SL</th>
            <th style={{ ...cell, textAlign: 'left' }}>ĐVT</th>
            <th style={cellR}>Đơn giá</th>
            <th style={cellR}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {(details ?? []).map((d, i) => (
            <tr key={i}>
              <td style={{ ...cell, textAlign: 'left' }}>{d.product_name}</td>
              <td style={{ ...cell, textAlign: 'left' }}>{d.lot_number}</td>
              <td style={{ ...cell, textAlign: 'left' }}>{fmtDate(d.expiry_date)}</td>
              <td style={cellR}>{fmt(d.quantity_moved)}</td>
              <td style={{ ...cell, textAlign: 'left' }}>{d.unit_of_measure}</td>
              <td style={cellR}>{formatCurrency(d.unit_cost)}</td>
              <td style={cellR}>{formatCurrency(d.total_amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
            <td style={{ ...cell, textAlign: 'right' }} colSpan={6}>
              Tổng giá trị
            </td>
            <td style={cellR}>{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default ReceiptPrintView
