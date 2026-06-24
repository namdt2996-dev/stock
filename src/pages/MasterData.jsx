import { useEffect, useRef, useState } from 'react'
import {
  getProducts,
  createProduct,
  toggleProductActive,
  checkSkuExists,
  getPartners,
  createPartner,
  getLocations,
  createLocation,
} from '../services/masterData'

const TABS = [
  { key: 'products', label: 'Sản phẩm' },
  { key: 'partners', label: 'Đối tác' },
  { key: 'locations', label: 'Kho' },
]

function MasterData() {
  const [tab, setTab] = useState('products')

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Master Data</h2>

      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
              tab === t.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'partners' && <PartnersTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}

// ---------- shared UI ----------
function Table({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm border border-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {columns.map((c) => (
            <th key={c.key} className="text-left px-3 py-2 font-medium text-gray-600">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-3 py-3 text-center text-gray-400">
              Chưa có dữ liệu
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.product_id || r.partner_id || r.location_id} className="border-t border-gray-100">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-gray-700">
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
    </div>
  )
}

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const btnClass =
  'bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-green-700 disabled:opacity-50'

// ---------- Products ----------
function ProductsTab() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({
    name: '',
    sku: '',
    unit_of_measure: '',
    pack_unit: '',
    conversion_factor: '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active') // active | inactive | all
  const [skuError, setSkuError] = useState(null)
  const skuRef = useRef(null)

  async function handleSkuBlur() {
    const value = form.sku.trim()
    if (!value) {
      setSkuError(null)
      return
    }
    try {
      if (await checkSkuExists(value)) {
        setSkuError('SKU này đã tồn tại')
      } else {
        setSkuError(null)
      }
    } catch {
      // lỗi mạng khi kiểm tra — bỏ qua, để bước submit bắt 23505
      setSkuError(null)
    }
  }

  async function load() {
    try {
      setRows(await getProducts(false)) // lấy tất cả, lọc client-side
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function handleToggle(product_id, current) {
    setError(null)
    const next = !current
    // Cập nhật realtime (optimistic) — không reload trang
    setRows((prev) =>
      prev.map((r) =>
        r.product_id === product_id ? { ...r, is_active: next } : r
      )
    )
    try {
      await toggleProductActive(product_id, next)
    } catch (e) {
      setError(e.message)
      // revert nếu lỗi
      setRows((prev) =>
        prev.map((r) =>
          r.product_id === product_id ? { ...r, is_active: current } : r
        )
      )
    }
  }

  const visibleRows = rows.filter((r) => {
    if (statusFilter === 'active') return r.is_active !== false
    if (statusFilter === 'inactive') return r.is_active === false
    return true
  })

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)

    if (skuError) {
      skuRef.current?.focus()
      return
    }

    setSaving(true)
    try {
      await createProduct({
        ...form,
        conversion_factor: form.conversion_factor
          ? Number(form.conversion_factor)
          : undefined,
      })
      setForm({
        name: '',
        sku: '',
        unit_of_measure: '',
        pack_unit: '',
        conversion_factor: '',
      })
      setSkuError(null)
      await load()
    } catch (e) {
      if (e.code === '23505') {
        setSkuError('SKU đã tồn tại, vui lòng dùng SKU khác')
        skuRef.current?.focus()
      } else {
        setError(e.message)
      }
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Trạng thái:</span>
        {[
          { v: 'active', l: 'Đang dùng' },
          { v: 'inactive', l: 'Ngừng dùng' },
          { v: 'all', l: 'Tất cả' },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setStatusFilter(o.v)}
            className={`px-2 py-1 rounded ${
              statusFilter === o.v
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Tên sản phẩm</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">SKU</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">ĐVT</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Đơn vị đóng gói</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center text-gray-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => {
                const active = r.is_active !== false
                return (
                  <tr key={r.product_id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.sku}</td>
                    <td className="px-3 py-2 text-gray-600">{r.unit_of_measure}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.pack_unit ? `${r.pack_unit}/${r.conversion_factor ?? 1}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active}
                          onClick={() => handleToggle(r.product_id, active)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                            active ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                          title="Bấm để đổi trạng thái"
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              active ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <span
                          className={`text-xs ${
                            active ? 'text-green-700' : 'text-gray-500'
                          }`}
                        >
                          {active ? 'Đang dùng' : 'Ngừng dùng'}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
        <input
          className={inputClass}
          placeholder="Tên sản phẩm"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <div className="flex flex-col">
          <input
            ref={skuRef}
            className={`${inputClass} ${skuError ? 'border-red-500 focus:ring-red-500' : ''}`}
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => {
              setForm({ ...form, sku: e.target.value })
              if (skuError) setSkuError(null)
            }}
            onBlur={handleSkuBlur}
            required
          />
          {skuError && (
            <span className="text-red-600 text-xs mt-0.5">{skuError}</span>
          )}
        </div>
        <input
          className={inputClass}
          placeholder="Đơn vị tính"
          value={form.unit_of_measure}
          onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="VD: thùng, két, hộp"
          value={form.pack_unit}
          onChange={(e) => setForm({ ...form, pack_unit: e.target.value })}
        />
        {form.pack_unit && (
          <input
            type="number"
            min="1"
            className={inputClass}
            placeholder="VD: 12 (1 thùng = 12 lon)"
            value={form.conversion_factor}
            onChange={(e) =>
              setForm({ ...form, conversion_factor: e.target.value })
            }
          />
        )}
        <button className={btnClass} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Thêm'}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}

// ---------- Partners ----------
function PartnersTab() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ name: '', type: 'SUPPLIER' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setRows(await getPartners())
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createPartner(form)
      setForm({ name: '', type: 'SUPPLIER' })
      await load()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <Table
        columns={[
          { key: 'name', label: 'Tên' },
          { key: 'type', label: 'Loại' },
        ]}
        rows={rows}
      />
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
        <input
          className={inputClass}
          placeholder="Tên đối tác"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className={inputClass}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="SUPPLIER">SUPPLIER</option>
          <option value="CUSTOMER">CUSTOMER</option>
        </select>
        <button className={btnClass} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Thêm'}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}

// ---------- Locations ----------
function LocationsTab() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ warehouse_name: '', address: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setRows(await getLocations())
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createLocation(form)
      setForm({ warehouse_name: '', address: '' })
      await load()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <Table
        columns={[
          { key: 'warehouse_name', label: 'Tên kho' },
          { key: 'address', label: 'Địa chỉ' },
        ]}
        rows={rows}
      />
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
        <input
          className={inputClass}
          placeholder="Tên kho"
          value={form.warehouse_name}
          onChange={(e) => setForm({ ...form, warehouse_name: e.target.value })}
          required
        />
        <input
          className={inputClass}
          placeholder="Địa chỉ"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <button className={btnClass} disabled={saving}>
          {saving ? 'Đang lưu…' : 'Thêm'}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  )
}

export default MasterData
