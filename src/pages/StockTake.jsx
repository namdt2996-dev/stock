import { useEffect, useState } from 'react'
import { getLocations } from '../services/masterData'
import { getStockForTake, createStockAdjustment } from '../services/stockTake'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('vi-VN'))
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—')

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

// Lô thuộc sản phẩm có đóng gói nhiều cấp không?
const hasPack = (r) => !!r.pack_unit && (Number(r.conversion_factor) || 1) > 1

function StockTake() {
  const [locations, setLocations] = useState([])
  const [locationId, setLocationId] = useState('')
  const [date, setDate] = useState(today())
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState([])
  const [entries, setEntries] = useState({}) // stock_id -> { packs, loose }

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!showToast) return
    const t = setTimeout(() => setShowToast(false), 15000)
    return () => clearTimeout(t)
  }, [showToast])

  async function loadStock(locId) {
    if (!locId) {
      setRows([])
      setEntries({})
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRows(await getStockForTake(locId))
      setEntries({})
      setSearch('')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function handleLocationChange(locId) {
    setLocationId(locId)
    loadStock(locId)
  }

  function setEntry(stockId, field, value) {
    setEntries((prev) => ({
      ...prev,
      [stockId]: { ...prev[stockId], [field]: value },
    }))
  }

  // Tính số thực tế + cờ "đã nhập" cho 1 lô
  function computeRow(r) {
    const e = entries[r.stock_id] || {}
    const cf = Number(r.conversion_factor) || 1
    const packs = e.packs === '' || e.packs == null ? null : Number(e.packs)
    const loose = e.loose === '' || e.loose == null ? null : Number(e.loose)

    let entered, actual
    if (hasPack(r)) {
      entered = packs != null || loose != null
      actual = (packs || 0) * cf + (loose || 0)
    } else {
      entered = loose != null
      actual = loose || 0
    }
    const diff = actual - r.system_quantity
    return { entered, actual, diff }
  }

  const computed = rows.map((r) => ({ row: r, ...computeRow(r) }))
  const matchedCount = computed.filter((c) => c.entered && c.diff === 0).length
  const diffCount = computed.filter((c) => c.entered && c.diff !== 0).length

  // Gom các lô theo sản phẩm (rows đã sort name ASC, expiry ASC)
  const groupsMap = new Map()
  for (const c of computed) {
    const pid = c.row.product_id
    if (!groupsMap.has(pid)) {
      groupsMap.set(pid, {
        product_id: pid,
        product_name: c.row.product_name,
        sku: c.row.sku,
        lots: [],
      })
    }
    groupsMap.get(pid).lots.push(c)
  }
  const groups = Array.from(groupsMap.values())

  // Tiến độ: Y = số sản phẩm unique; X = số sản phẩm có ít nhất 1 lô đã nhập
  const totalProducts = groups.length
  const checkedProducts = groups.filter((g) =>
    g.lots.some((c) => c.entered)
  ).length
  const progressPct = totalProducts
    ? Math.round((checkedProducts / totalProducts) * 100)
    : 0
  const completed = totalProducts > 0 && checkedProducts === totalProducts

  // Lọc theo search (tên sản phẩm hoặc số lô)
  const q = search.trim().toLowerCase()
  const visibleGroups = !q
    ? groups
    : groups
        .map((g) => {
          if (g.product_name.toLowerCase().includes(q)) return g
          const lots = g.lots.filter((c) =>
            (c.row.lot_number || '').toLowerCase().includes(q)
          )
          return lots.length ? { ...g, lots } : null
        })
        .filter(Boolean)

  async function handleSave() {
    setError(null)
    const items = computed
      .filter((c) => c.entered && c.diff !== 0)
      .map((c) => ({
        batch_id: c.row.batch_id,
        stock_id: c.row.stock_id,
        actual_quantity: c.actual,
      }))
    if (items.length === 0) return

    setSaving(true)
    try {
      await createStockAdjustment(locationId, date, items)
      setShowToast(true)
      await loadStock(locationId) // tải lại tồn mới + reset nhập
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const diffColor = (diff) =>
    diff === 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-orange-600'

  function renderActualInput(r, e, entered, actual) {
    const cf = Number(r.conversion_factor) || 1
    if (!hasPack(r)) {
      return (
        <input
          type="number"
          min="0"
          className={`${inputClass} w-28 text-right`}
          value={e.loose ?? ''}
          onChange={(ev) => setEntry(r.stock_id, 'loose', ev.target.value)}
        />
      )
    }
    return (
      <div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            className={`${inputClass} w-16 text-right`}
            value={e.packs ?? ''}
            onChange={(ev) => setEntry(r.stock_id, 'packs', ev.target.value)}
          />
          <span className="text-gray-500">{r.pack_unit}</span>
          <input
            type="number"
            min="0"
            className={`${inputClass} w-16 text-right`}
            value={e.loose ?? ''}
            onChange={(ev) => setEntry(r.stock_id, 'loose', ev.target.value)}
          />
          <span className="text-gray-500">{r.unit_of_measure}</span>
        </div>
        {entered && (
          <div className="text-xs text-gray-400 mt-0.5">
            = {fmt(actual)} {r.unit_of_measure}
            <span className="ml-1">(1 {r.pack_unit} = {cf})</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {showToast && (
        <div className="no-print fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded shadow-lg">
          ✓ Đã lưu phiếu kiểm kho thành công!
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-4">Kiểm kho</h2>

      {/* HEADER */}
      <div className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded p-4 mb-4">
        <label className="flex flex-col text-sm text-gray-600">
          <span>Kho <span className="text-red-500 text-xs">*</span></span>
          <select
            className={inputClass}
            value={locationId}
            onChange={(e) => handleLocationChange(e.target.value)}
          >
            <option value="">-- Chọn kho --</option>
            {locations.map((l) => (
              <option key={l.location_id} value={l.location_id}>
                {l.warehouse_name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Ngày kiểm
          <input
            type="date"
            className={inputClass}
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <label className="flex flex-col text-sm text-gray-600 flex-1 min-w-[200px]">
          Tìm kiếm
          <input
            type="text"
            className={inputClass}
            placeholder="Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!locationId}
          />
        </label>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">Lỗi: {error}</p>}

      {!locationId ? (
        <p className="text-gray-500 text-sm">Chọn kho để bắt đầu kiểm kho.</p>
      ) : (
        <>
          {/* PROGRESS */}
          {totalProducts > 0 && (
            <div className="mb-3">
              <div
                className={`text-sm font-medium ${
                  completed ? 'text-green-700' : 'text-gray-500'
                }`}
              >
                Đã kiểm {checkedProducts} / {totalProducts} danh mục sản phẩm
              </div>
              <div className="mt-1 h-1.5 w-full bg-gray-200 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${
                    completed ? 'bg-green-600' : 'bg-gray-400'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Số lô</th>
                  <th className="text-left px-3 py-2">Hạn dùng</th>
                  <th className="text-left px-3 py-2">ĐVT</th>
                  <th className="text-right px-3 py-2">Tồn hệ thống</th>
                  <th className="text-left px-3 py-2">Nhập thực tế</th>
                  <th className="text-right px-3 py-2">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {computed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                      {loading ? 'Đang tải…' : 'Kho này không có tồn'}
                    </td>
                  </tr>
                ) : visibleGroups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-400">
                      Không tìm thấy sản phẩm
                    </td>
                  </tr>
                ) : (
                  visibleGroups.map((g) => (
                    <Group key={g.product_id} group={g}>
                      {g.lots.map(({ row: r, entered, actual, diff }) => {
                        const e = entries[r.stock_id] || {}
                        return (
                          <tr key={r.stock_id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-600" style={{ paddingLeft: 16 }}>
                              {r.lot_number}
                            </td>
                            <td className="px-3 py-2 text-gray-600">{fmtDate(r.expiry_date)}</td>
                            <td className="px-3 py-2 text-gray-600">{r.unit_of_measure}</td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {fmt(r.system_quantity)}
                            </td>
                            <td className="px-3 py-2">
                              {renderActualInput(r, e, entered, actual)}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${entered ? diffColor(diff) : 'text-gray-400'}`}>
                              {!entered
                                ? '—'
                                : diff === 0
                                  ? '✓'
                                  : diff > 0
                                    ? `+${fmt(diff)}`
                                    : fmt(diff)}
                            </td>
                          </tr>
                        )
                      })}
                    </Group>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* SUMMARY + ACTIONS */}
          <div className="flex items-center gap-4 mt-4">
            <span className="text-sm text-gray-600">
              <span className="text-green-700 font-medium">{matchedCount}</span> khớp /{' '}
              <span className="text-orange-700 font-medium">{diffCount}</span> lệch
            </span>
            {diffCount > 0 ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Đang lưu…' : 'Xác nhận kiểm kho'}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="bg-gray-200 text-gray-500 text-sm font-medium px-5 py-2 rounded cursor-not-allowed"
              >
                Tất cả khớp ✓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Group header + các dòng lô
function Group({ group, children }) {
  return (
    <>
      <tr style={{ background: 'var(--color-background-secondary, #f3f4f6)' }}>
        <td
          colSpan={6}
          className="px-3 py-1.5 text-left text-sm font-semibold text-gray-800 dark:text-gray-200"
        >
          {group.product_name}
          {group.sku ? ` — ${group.sku}` : ''}
        </td>
      </tr>
      {children}
    </>
  )
}

export default StockTake
