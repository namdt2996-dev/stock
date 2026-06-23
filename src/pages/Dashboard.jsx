import { useEffect, useState } from 'react'
import { getDashboardStats, getRecentTransactions } from '../services/inventory'
import { formatCurrency } from '../utils/formatCurrency'

const fmt = (n) => (n == null ? '0' : Number(n).toLocaleString('vi-VN'))
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')

function MetricCard({ icon, label, value, danger }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${
          danger ? 'text-red-600' : 'text-gray-800'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [s, r] = await Promise.all([
          getDashboardStats(),
          getRecentTransactions(5),
        ])
        setStats(s)
        setRecent(r)
      } catch (e) {
        setError(e.message)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Dashboard</h2>

      {error && <p className="text-red-600 text-sm mb-3">Lỗi: {error}</p>}
      {loading && <p className="text-gray-500 text-sm mb-3">Đang tải…</p>}

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          icon="🏬"
          label="Sản phẩm đang tồn"
          value={fmt(stats?.total_products)}
        />
        <MetricCard
          icon="📦"
          label="Lô hàng active"
          value={fmt(stats?.total_batches)}
        />
        <MetricCard
          icon="⏰"
          label="Sắp hết hạn (≤7 ngày)"
          value={fmt(stats?.expiring_7days)}
          danger={(stats?.expiring_7days ?? 0) > 0}
        />
        <MetricCard
          icon="💰"
          label="Tổng giá trị tồn kho"
          value={formatCurrency(stats?.total_stock_value)}
        />
      </div>

      {/* CẢNH BÁO HẾT HẠN */}
      {(stats?.expiring_7days ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4 flex items-center justify-between text-sm">
          <span>
            ⚠️ Có {stats.expiring_7days} lô sắp/đã hết hạn
          </span>
          <button
            type="button"
            onClick={() => onNavigate?.('stock')}
            className="font-medium underline hover:no-underline"
          >
            Xem tồn kho
          </button>
        </div>
      )}

      {/* GIAO DỊCH GẦN NHẤT */}
      <div className="bg-white border border-gray-200 rounded">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="font-medium text-gray-800">Giao dịch gần nhất</h3>
          <button
            type="button"
            onClick={() => onNavigate?.('history')}
            className="text-sm font-medium text-green-700 hover:text-green-800"
          >
            Xem tất cả
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2">Ngày</th>
              <th className="text-left px-4 py-2">Loại</th>
              <th className="text-left px-4 py-2">Đối tác</th>
              <th className="text-right px-4 py-2">Tổng giá trị</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-gray-400">
                  {loading ? 'Đang tải…' : 'Chưa có giao dịch'}
                </td>
              </tr>
            ) : (
              recent.map((r) => (
                <tr key={r.transaction_id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-700">
                    {fmtDate(r.transaction_date)}
                  </td>
                  <td className="px-4 py-2">
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
                  <td className="px-4 py-2 text-gray-600">
                    {r.partner_name || '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-800">
                    {formatCurrency(r.total_value)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Dashboard
