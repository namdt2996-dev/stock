import { useEffect, useState } from 'react'
import { getProducts } from '../services/masterData'
import { getTransactions, getTransactionDetails } from '../services/inventory'
import { exportToCsv } from '../utils/exportCsv'
import { formatCurrency } from '../utils/formatCurrency'

const EXIT_REASON_LABELS = {
  PROCESSING: 'Xuất bếp',
  SALE: 'Xuất bán',
  STAFF: 'Nội bộ',
  WASTE: 'Hủy hàng',
}

const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('vi-VN'))
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')

// 30 ngày gần nhất
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
const today = () => new Date().toISOString().slice(0, 10)

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

function TransactionHistory() {
  const [filters, setFilters] = useState({
    transaction_type: 'all',
    date_from: daysAgo(30),
    date_to: today(),
    product_id: '',
  })
  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Modal chi tiết
  const [selected, setSelected] = useState(null) // header phiếu đang xem
  const [details, setDetails] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  async function search() {
    setLoading(true)
    setError(null)
    try {
      setRows(
        await getTransactions({
          transaction_type: filters.transaction_type,
          date_from: filters.date_from,
          date_to: filters.date_to,
          product_id: filters.product_id || undefined,
        })
      )
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function openDetails(row) {
    setSelected(row)
    setDetailLoading(true)
    setDetails([])
    try {
      setDetails(await getTransactionDetails(row.transaction_id))
    } catch (e) {
      setError(e.message)
    }
    setDetailLoading(false)
  }

  function closeModal() {
    setSelected(null)
    setDetails([])
  }

  const detailTotal = details.reduce(
    (s, d) => s + (Number(d.total_amount) || 0),
    0
  )

  const typeLabel = (t) =>
    t === 'IN' ? 'Nhập kho' : t === 'OUT' ? 'Xuất hàng' : t

  function handleExport() {
    const headers = [
      'Ngày', 'Loại', 'Lý do xuất', 'Đối tác',
      'Số phiếu tham chiếu', 'Số dòng', 'Tổng giá trị',
    ]
    const data = rows.map((r) => [
      fmtDate(r.transaction_date),
      typeLabel(r.transaction_type),
      r.transaction_type === 'OUT'
        ? EXIT_REASON_LABELS[r.exit_reason_code] || r.exit_reason_code || ''
        : '',
      r.partner_name || '',
      r.reference_doc || '',
      r.line_count,
      r.total_value,
    ])
    const date = new Date().toISOString().slice(0, 10)
    exportToCsv(`lich-su-giao-dich-${date}.csv`, headers, data)
  }

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Lịch sử giao dịch</h2>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded p-4 mb-4">
        <label className="flex flex-col text-sm text-gray-600">
          Loại
          <select
            className={inputClass}
            value={filters.transaction_type}
            onChange={(e) =>
              setFilters({ ...filters, transaction_type: e.target.value })
            }
          >
            <option value="all">Tất cả</option>
            <option value="IN">Nhập kho</option>
            <option value="OUT">Xuất hàng</option>
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Từ ngày
          <input
            type="date"
            className={inputClass}
            value={filters.date_from}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
          />
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Đến ngày
          <input
            type="date"
            className={inputClass}
            value={filters.date_to}
            onChange={(e) =>
              setFilters({ ...filters, date_to: e.target.value })
            }
          />
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Sản phẩm
          <select
            className={inputClass}
            value={filters.product_id}
            onChange={(e) =>
              setFilters({ ...filters, product_id: e.target.value })
            }
          >
            <option value="">Tất cả</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="bg-green-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Đang tìm…' : 'Tìm kiếm'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          className="no-print bg-gray-700 text-white text-sm font-medium px-5 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          Xuất CSV
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">Lỗi: {error}</p>}

      {/* DANH SÁCH PHIẾU */}
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Ngày</th>
              <th className="text-left px-3 py-2">Loại</th>
              <th className="text-left px-3 py-2">Lý do xuất</th>
              <th className="text-left px-3 py-2">Đối tác</th>
              <th className="text-left px-3 py-2">Số phiếu</th>
              <th className="text-right px-3 py-2">Số dòng</th>
              <th className="text-right px-3 py-2">Tổng giá trị</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-400">
                  {loading ? 'Đang tải…' : 'Không có phiếu nào'}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.transaction_id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-700">
                    {fmtDate(r.transaction_date)}
                  </td>
                  <td className="px-3 py-2">
                    {r.transaction_type === 'IN' ? (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
                        Nhập kho
                      </span>
                    ) : r.transaction_type === 'OUT' ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                        Xuất hàng
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">
                        {r.transaction_type}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.transaction_type === 'OUT'
                      ? EXIT_REASON_LABELS[r.exit_reason_code] ||
                        r.exit_reason_code ||
                        '—'
                      : ''}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.partner_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.reference_doc || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {r.line_count}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      r.transaction_type === 'ADJUST'
                        ? r.total_value < 0
                          ? 'text-red-600'
                          : 'text-green-600'
                        : 'text-gray-800'
                    }`}
                  >
                    {r.transaction_type === 'ADJUST' && r.total_value > 0
                      ? `+${formatCurrency(r.total_value)}`
                      : formatCurrency(r.total_value)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => openDetails(r)}
                      className="text-sm font-medium text-green-700 hover:text-green-800"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CHI TIẾT */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-gray-200 p-4">
              <div className="text-sm text-gray-700 space-y-1">
                <div className="text-base font-bold text-gray-800">
                  {selected.transaction_type === 'IN'
                    ? 'Phiếu nhập kho'
                    : 'Phiếu xuất kho'}
                </div>
                <div>Ngày: {fmtDate(selected.transaction_date)}</div>
                {selected.transaction_type === 'OUT' && (
                  <div>
                    Lý do:{' '}
                    {EXIT_REASON_LABELS[selected.exit_reason_code] ||
                      selected.exit_reason_code ||
                      '—'}
                  </div>
                )}
                <div>Đối tác: {selected.partner_name || '—'}</div>
                <div>Số phiếu: {selected.reference_doc || '—'}</div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-2 py-2">Sản phẩm</th>
                    <th className="text-left px-2 py-2">Số lô</th>
                    <th className="text-left px-2 py-2">Hạn dùng</th>
                    <th className="text-right px-2 py-2">SL</th>
                    <th className="text-left px-2 py-2">ĐVT</th>
                    <th className="text-right px-2 py-2">Đơn giá</th>
                    <th className="text-right px-2 py-2">Thành tiền</th>
                    <th className="text-left px-2 py-2">Kho</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-3 text-center text-gray-400">
                        Đang tải…
                      </td>
                    </tr>
                  ) : (
                    details.map((d, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-2 text-gray-800">{d.product_name}</td>
                        <td className="px-2 py-2 text-gray-600">{d.lot_number}</td>
                        <td className="px-2 py-2 text-gray-600">{fmtDate(d.expiry_date)}</td>
                        <td className="px-2 py-2 text-right text-gray-700">{fmt(d.quantity_moved)}</td>
                        <td className="px-2 py-2 text-gray-600">{d.unit_of_measure}</td>
                        <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(d.unit_cost)}</td>
                        <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(d.total_amount)}</td>
                        <td className="px-2 py-2 text-gray-600">
                          {d.location_to_name || d.location_from_name || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                    <td colSpan={6} className="px-2 py-2 text-right">
                      Tổng giá trị
                    </td>
                    <td className="px-2 py-2 text-right text-green-700">
                      {formatCurrency(detailTotal)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end border-t border-gray-200 p-4">
              <button
                type="button"
                onClick={closeModal}
                className="bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded hover:bg-gray-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionHistory
