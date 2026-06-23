import { useEffect, useState } from 'react'
import { getPartners, getLocations } from '../services/masterData'
import {
  createOutboundReceipt,
  getProductsByLocation,
} from '../services/inventory'

const today = () => new Date().toISOString().slice(0, 10)

const EXIT_REASONS = [
  { code: 'PROCESSING', label: 'Xuất bếp' },
  { code: 'SALE', label: 'Xuất bán' },
  { code: 'STAFF', label: 'Nội bộ' },
  { code: 'WASTE', label: 'Hủy hàng' },
]

const emptyLine = () => ({ product_id: '', quantity: '' })

const emptyHeader = () => ({
  transaction_date: today(),
  exit_reason_code: 'PROCESSING',
  location_id: '',
  partner_id: '',
  reference_doc: '',
})

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

function OutboundReceipt() {
  const [header, setHeader] = useState(emptyHeader())
  const [lines, setLines] = useState([emptyLine()])

  const [partners, setPartners] = useState([])
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(false)

  // Tự ẩn toast sau 15 giây
  useEffect(() => {
    if (!showToast) return
    const timer = setTimeout(() => setShowToast(false), 15000)
    return () => clearTimeout(timer)
  }, [showToast])

  useEffect(() => {
    async function loadRefs() {
      try {
        const [pa, lo] = await Promise.all([getPartners(), getLocations()])
        setPartners(pa)
        setLocations(lo)
      } catch (e) {
        setError(`Lỗi tải dữ liệu danh mục: ${e.message}`)
      }
    }
    loadRefs()
  }, [])

  const isSale = header.exit_reason_code === 'SALE'

  // Đổi kho: load lại sản phẩm có tồn trong kho đó + reset toàn bộ dòng
  async function handleLocationChange(location_id) {
    setHeader((h) => ({ ...h, location_id }))
    setLines([emptyLine()])
    setProducts([])
    setError(null)
    if (!location_id) return
    try {
      setProducts(await getProductsByLocation(location_id))
    } catch (e) {
      setError(`Lỗi tải sản phẩm theo kho: ${e.message}`)
    }
  }

  function updateLine(index, field, value) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    )
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index) {
    setLines((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    )
  }

  function resetForm() {
    setHeader(emptyHeader())
    setLines([emptyLine()])
    setError(null)
  }

  async function handleSave() {
    setError(null)

    if (!header.location_id) {
      return setError('Vui lòng chọn kho xuất.')
    }
    if (isSale && !header.partner_id) {
      return setError('Lý do "Xuất bán" yêu cầu chọn đối tác (khách hàng).')
    }

    const cleanLines = lines
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity),
      }))

    if (cleanLines.length === 0) {
      return setError('Phiếu xuất phải có ít nhất 1 dòng sản phẩm hợp lệ.')
    }
    if (cleanLines.some((l) => !l.quantity || l.quantity <= 0)) {
      return setError('Số lượng mỗi dòng phải lớn hơn 0.')
    }

    setSaving(true)
    try {
      await createOutboundReceipt(header, cleanLines)
      setShowToast(true)
      resetForm()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* TOAST thành công — góc trên phải, tự ẩn sau 15s */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded shadow-lg">
          ✓ Phiếu xuất kho đã được lưu thành công!
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-4">Phiếu xuất kho</h2>

      {/* HEADER */}
      <div className="bg-white border border-gray-200 rounded p-4 mb-4 space-y-4">
        {/* Hàng 1: 4 field — mobile 1 cột, sm 2 cột, lg 4 cột */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="flex flex-col text-sm text-gray-600">
          Ngày xuất
          <input
            type="date"
            className={inputClass}
            value={header.transaction_date}
            max={today()}
            onChange={(e) =>
              setHeader({ ...header, transaction_date: e.target.value })
            }
          />
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Lý do xuất
          <select
            className={inputClass}
            value={header.exit_reason_code}
            onChange={(e) =>
              setHeader({ ...header, exit_reason_code: e.target.value })
            }
          >
            {EXIT_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Kho xuất <span className="text-red-500">*</span>
          <select
            className={inputClass}
            value={header.location_id}
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
          Đối tác {isSale && <span className="text-red-500">*</span>}
          <select
            className={inputClass}
            value={header.partner_id}
            onChange={(e) =>
              setHeader({ ...header, partner_id: e.target.value })
            }
          >
            <option value="">-- {isSale ? 'Chọn khách hàng' : 'Không'} --</option>
            {partners.map((p) => (
              <option key={p.partner_id} value={p.partner_id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        </div>

        {/* Hàng 2: số phiếu tham chiếu — chiếm cột đầu, rộng ~50% trên màn lớn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col text-sm text-gray-600">
          Số phiếu tham chiếu
          <input
            type="text"
            className={inputClass}
            value={header.reference_doc}
            onChange={(e) =>
              setHeader({ ...header, reference_doc: e.target.value })
            }
          />
        </label>
        </div>
      </div>

      {/* Ghi chú FEFO */}
      <p className="text-sm text-gray-500 mb-2">
        ℹ️ Hệ thống tự động chọn lô theo FEFO (hạn dùng gần nhất xuất trước).
      </p>

      {/* LINES */}
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Sản phẩm</th>
              <th className="text-right px-3 py-2">Số lượng cần xuất</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <select
                    className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
                    value={line.product_id}
                    disabled={!header.location_id}
                    onChange={(e) => updateLine(i, 'product_id', e.target.value)}
                  >
                    <option value="">
                      {header.location_id ? '-- Chọn SP --' : 'Chọn kho trước'}
                    </option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} text-right w-28`}
                    value={line.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                  />
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
          disabled={saving}
          className="bg-green-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu…' : 'Lưu phiếu xuất'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="bg-gray-200 text-gray-700 text-sm font-medium px-5 py-2 rounded hover:bg-gray-300"
        >
          Hủy
        </button>
      </div>

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
    </div>
  )
}

export default OutboundReceipt
