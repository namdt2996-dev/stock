import { useEffect, useState } from 'react'
import { getStockLevels } from '../services/inventory'

// Số ngày còn lại tới hạn dùng (null nếu không có expiry_date)
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
  return Math.round((expiry - today) / (1000 * 60 * 60 * 24))
}

// Ưu tiên: đỏ ≤ 7 ngày, cam ≤ 45 ngày, vàng ≤ 90 ngày, ngược lại null
function expiryLevel(dateStr) {
  const d = daysUntil(dateStr)
  if (d === null) return null
  if (d <= 7) return 'red'
  if (d <= 45) return 'orange'
  if (d <= 90) return 'yellow'
  return null
}

const fmtQty = (n) => (n == null ? '' : Number(n).toLocaleString('vi-VN'))

function StockLevel() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setRows(await getStockLevels())
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const redCount = rows.filter((r) => expiryLevel(r.expiry_date) === 'red').length
  const orangeCount = rows.filter(
    (r) => expiryLevel(r.expiry_date) === 'orange'
  ).length
  const yellowCount = rows.filter(
    (r) => expiryLevel(r.expiry_date) === 'yellow'
  ).length

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Tồn kho</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Đang tải…' : '↻ Làm mới'}
        </button>
      </div>

      {/* Cảnh báo hạn dùng */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <span className="inline-flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded">
          <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
          {redCount} lô sắp/đã hết hạn (≤ 7 ngày)
        </span>
        <span className="inline-flex items-center gap-2 bg-orange-50 text-orange-800 border border-orange-200 px-3 py-1 rounded">
          <span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />
          {orangeCount} lô cảnh báo (≤ 45 ngày)
        </span>
        <span className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-800 border border-yellow-200 px-3 py-1 rounded">
          <span className="w-3 h-3 rounded-sm bg-yellow-300 inline-block" />
          {yellowCount} lô cần chú ý (≤ 90 ngày)
        </span>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">Lỗi: {error}</p>}

      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Sản phẩm</th>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">ĐVT</th>
              <th className="text-left px-3 py-2">Số lô</th>
              <th className="text-left px-3 py-2">Hạn dùng</th>
              <th className="text-right px-3 py-2">Tồn</th>
              <th className="text-left px-3 py-2">Kho</th>
              <th className="text-left px-3 py-2">Ngày nhập</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-400">
                  {loading ? 'Đang tải…' : 'Chưa có tồn kho'}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const level = expiryLevel(r.expiry_date)
                const rowClass =
                  level === 'red'
                    ? 'bg-red-50'
                    : level === 'orange'
                      ? 'bg-orange-50'
                      : level === 'yellow'
                        ? 'bg-yellow-50'
                        : ''
                return (
                  <tr key={i} className={`border-t border-gray-100 ${rowClass}`}>
                    <td className="px-3 py-2 text-gray-800">{r.product_name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.sku}</td>
                    <td className="px-3 py-2 text-gray-600">{r.unit_of_measure}</td>
                    <td className="px-3 py-2 text-gray-600">{r.lot_number}</td>
                    <td className="px-3 py-2 text-gray-700">{r.expiry_date ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-800">
                      {fmtQty(r.current_quantity)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.warehouse_name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.received_date ?? '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StockLevel
