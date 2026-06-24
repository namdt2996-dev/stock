import { useEffect, useState } from 'react'
import { getPartners, getLocations, getProducts } from '../services/masterData'
import { createInboundReceipt } from '../services/inventory'
import PrintButton from '../components/PrintButton'
import { formatCurrency } from '../utils/formatCurrency'

const today = () => new Date().toISOString().slice(0, 10)

const emptyLine = () => ({
  product_id: '',
  unit_of_measure: '',
  lot_number: '',
  expiry_date: '',
  quantity: '',
  unit_cost: '',
})

const emptyHeader = () => ({
  transaction_date: today(),
  partner_id: '',
  entry_reason_code: 'PURCHASE',
  location_id: '',
  reference_doc: '',
})

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

const fmt = (n) =>
  isNaN(n) ? '0' : Number(n).toLocaleString('vi-VN')

function InboundReceipt() {
  const [header, setHeader] = useState(emptyHeader())
  const [lines, setLines] = useState([emptyLine()])

  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])

  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Đánh dấu "có thay đổi chưa lưu" nếu user sửa sau khi đã lưu
  function touch() {
    if (saved) setIsDirty(true)
  }

  // Tự ẩn toast sau 15 giây
  useEffect(() => {
    if (!showToast) return
    const timer = setTimeout(() => setShowToast(false), 15000)
    return () => clearTimeout(timer)
  }, [showToast])

  useEffect(() => {
    async function loadRefs() {
      try {
        const [s, l, p] = await Promise.all([
          getPartners('SUPPLIER'),
          getLocations(),
          getProducts(),
        ])
        setSuppliers(s)
        setLocations(l)
        setProducts(p)
      } catch (e) {
        setError(`Lỗi tải dữ liệu danh mục: ${e.message}`)
      }
    }
    loadRefs()
  }, [])

  const lineTotal = (line) =>
    (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0)

  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)

  function updateHeader(field, value) {
    touch()
    setHeader((h) => ({ ...h, [field]: value }))
  }

  function updateLine(index, field, value) {
    touch()
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    )
  }

  // Chọn sản phẩm: gán product_id + tự điền ĐVT (unit_of_measure) read-only
  function handleProductChange(index, product_id) {
    touch()
    const p = products.find((x) => x.product_id === product_id)
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, product_id, unit_of_measure: p?.unit_of_measure ?? '' }
          : l
      )
    )
  }

  function addLine() {
    touch()
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index) {
    touch()
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    )
  }

  function resetForm() {
    setHeader(emptyHeader())
    setLines([emptyLine()])
    setError(null)
    setSuccess(null)
    setSaved(false)
    setIsDirty(false)
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)
    setSaved(false)
    setIsDirty(false)

    const isPurchase = header.entry_reason_code === 'PURCHASE'
    if (isPurchase && !header.partner_id) {
      return setError('Lý do "Mua hàng" yêu cầu chọn nhà cung cấp.')
    }
    if (!header.location_id) return setError('Vui lòng chọn kho nhập.')

    // PRODUCTION: không có NCC -> partner_id = null
    const headerToSave = { ...header, partner_id: header.partner_id || null }

    const cleanLines = lines
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id,
        lot_number: l.lot_number,
        expiry_date: l.expiry_date || null,
        quantity: Number(l.quantity),
        unit_cost: Number(l.unit_cost),
      }))

    if (cleanLines.length === 0) {
      return setError('Phiếu nhập phải có ít nhất 1 dòng sản phẩm hợp lệ.')
    }
    if (cleanLines.some((l) => !l.quantity || l.quantity <= 0)) {
      return setError('Số lượng mỗi dòng phải lớn hơn 0.')
    }

    setSaving(true)
    try {
      const transaction_id = await createInboundReceipt(headerToSave, cleanLines)
      setSuccess(`Đã lưu phiếu nhập thành công (mã: ${transaction_id}).`)
      setShowToast(true)
      // Giữ nguyên dữ liệu phiếu để có thể IN; bấm "Hủy" để tạo phiếu mới.
      setSaved(true)
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6">
      {/* TOAST thành công — góc trên phải, tự ẩn sau 15s */}
      {showToast && (
        <div className="no-print fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded shadow-lg">
          ✓ Phiếu nhập kho đã được lưu thành công!
        </div>
      )}

      {/* FORM nhập liệu — ẩn khi in */}
      <div className="no-print">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Phiếu nhập kho</h2>

      {/* HEADER — 5 field: mobile 1 cột, sm 2 cột, lg 5 cột */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white border border-gray-200 rounded p-4 mb-4">
        <label className="flex flex-col text-sm text-gray-600">
          Ngày nhập
          <input
            type="date"
            className={inputClass}
            value={header.transaction_date}
            max={today()}
            onChange={(e) => updateHeader('transaction_date', e.target.value)}
          />
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Nhà cung cấp{' '}
          {header.entry_reason_code === 'PURCHASE' && (
            <span className="text-red-500 text-xs">*</span>
          )}
          <select
            className={inputClass}
            value={header.partner_id}
            onChange={(e) => updateHeader('partner_id', e.target.value)}
          >
            <option value="">
              {header.entry_reason_code === 'PURCHASE'
                ? '-- Chọn NCC --'
                : '-- Không --'}
            </option>
            {suppliers.map((s) => (
              <option key={s.partner_id} value={s.partner_id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Lý do nhập
          <select
            className={inputClass}
            value={header.entry_reason_code}
            onChange={(e) => updateHeader('entry_reason_code', e.target.value)}
          >
            <option value="PURCHASE">Mua hàng</option>
            <option value="PRODUCTION">Nhập sản lượng</option>
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Kho nhập
          <select
            className={inputClass}
            value={header.location_id}
            onChange={(e) => updateHeader('location_id', e.target.value)}
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
          Số phiếu tham chiếu
          <input
            type="text"
            className={inputClass}
            value={header.reference_doc}
            onChange={(e) => updateHeader('reference_doc', e.target.value)}
          />
        </label>
      </div>

      {/* LINES */}
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Sản phẩm</th>
              <th className="text-left px-3 py-2">ĐVT</th>
              <th className="text-left px-3 py-2">Số lô</th>
              <th className="text-left px-3 py-2">Hạn dùng</th>
              <th className="text-right px-3 py-2">Số lượng</th>
              <th className="text-right px-3 py-2">Giá cost</th>
              <th className="text-right px-3 py-2">Thành tiền</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <select
                    className={inputClass}
                    value={line.product_id}
                    onChange={(e) => handleProductChange(i, e.target.value)}
                  >
                    <option value="">-- Chọn SP --</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {line.unit_of_measure || '—'}
                </td>
                <td className="px-3 py-2">
                  <input
                    className={inputClass}
                    value={line.lot_number}
                    onChange={(e) => updateLine(i, 'lot_number', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    className={inputClass}
                    value={line.expiry_date}
                    onChange={(e) => updateLine(i, 'expiry_date', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} text-right w-24`}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} text-right w-28`}
                    value={line.unit_cost}
                    onChange={(e) => updateLine(i, 'unit_cost', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {formatCurrency(lineTotal(line))}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-red-500 hover:text-red-700 disabled:opacity-30"
                    disabled={lines.length === 1}
                    title="Xóa dòng"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50 font-medium">
              <td colSpan={6} className="px-3 py-2 text-right">
                Tổng giá trị
              </td>
              <td className="px-3 py-2 text-right text-green-700">
                {formatCurrency(grandTotal)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={addLine}
          className="text-sm font-medium text-green-700 hover:text-green-800"
        >
          + Thêm sản phẩm
        </button>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saved}
          className="bg-green-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saved ? 'Đã lưu ✓' : saving ? 'Đang lưu…' : 'Lưu phiếu nhập'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded hover:bg-gray-300"
        >
          Hủy
        </button>
        {saved && !isDirty && <PrintButton />}
        {saved && isDirty && (
          <span className="text-xs text-amber-600">Có thay đổi chưa lưu</span>
        )}
      </div>

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      {success && <p className="mt-4 text-green-700 text-sm">{success}</p>}
      </div>

      {/* KHỐI IN — chỉ hiện khi @media print */}
      <div className="print-only">
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 8 }}>
          PHIẾU NHẬP KHO
        </h1>
        <div style={{ fontSize: 13, lineHeight: '20px', marginBottom: 12 }}>
          <div>Số phiếu tham chiếu: {header.reference_doc || '—'}</div>
          <div>Ngày nhập: {header.transaction_date}</div>
          <div>
            Nhà cung cấp:{' '}
            {suppliers.find((s) => s.partner_id === header.partner_id)?.name ||
              '—'}
          </div>
          <div>
            Kho nhập:{' '}
            {locations.find((l) => l.location_id === header.location_id)
              ?.warehouse_name || '—'}
          </div>
        </div>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <thead>
            <tr>
              {['STT', 'Sản phẩm', 'ĐVT', 'Số lô', 'Hạn dùng', 'Số lượng', 'Giá cost', 'Thành tiền'].map(
                (h) => (
                  <th
                    key={h}
                    style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'left' }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {lines
              .filter((l) => l.product_id)
              .map((l, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px' }}>
                    {products.find((p) => p.product_id === l.product_id)?.name || ''}
                  </td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{l.unit_of_measure}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{l.lot_number}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{l.expiry_date || '—'}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'right' }}>{fmt(l.quantity)}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(l.unit_cost)}</td>
                  <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'right' }}>{formatCurrency(lineTotal(l))}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>
                Tổng giá trị
              </td>
              <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>
                {formatCurrency(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default InboundReceipt
