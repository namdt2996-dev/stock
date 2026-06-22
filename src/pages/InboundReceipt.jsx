import { useEffect, useState } from 'react'
import { getPartners, getLocations, getProducts } from '../services/masterData'
import { createInboundReceipt } from '../services/inventory'

const today = () => new Date().toISOString().slice(0, 10)

const emptyLine = () => ({
  product_id: '',
  lot_number: '',
  expiry_date: '',
  quantity: '',
  unit_cost: '',
})

const emptyHeader = () => ({
  transaction_date: today(),
  partner_id: '',
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
    setSuccess(null)
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)

    if (!header.partner_id) return setError('Vui lòng chọn nhà cung cấp.')
    if (!header.location_id) return setError('Vui lòng chọn kho nhập.')

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
      const { transaction_id } = await createInboundReceipt(header, cleanLines)
      setSuccess(`Đã lưu phiếu nhập thành công (mã: ${transaction_id}).`)
      resetForm()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Phiếu nhập kho</h2>

      {/* HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border border-gray-200 rounded p-4 mb-4">
        <label className="flex flex-col text-sm text-gray-600">
          Ngày nhập
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
          Nhà cung cấp
          <select
            className={inputClass}
            value={header.partner_id}
            onChange={(e) =>
              setHeader({ ...header, partner_id: e.target.value })
            }
          >
            <option value="">-- Chọn NCC --</option>
            {suppliers.map((s) => (
              <option key={s.partner_id} value={s.partner_id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm text-gray-600">
          Kho nhập
          <select
            className={inputClass}
            value={header.location_id}
            onChange={(e) =>
              setHeader({ ...header, location_id: e.target.value })
            }
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
            onChange={(e) =>
              setHeader({ ...header, reference_doc: e.target.value })
            }
          />
        </label>
      </div>

      {/* LINES */}
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Sản phẩm</th>
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
                    onChange={(e) => updateLine(i, 'product_id', e.target.value)}
                  >
                    <option value="">-- Chọn SP --</option>
                    {products.map((p) => (
                      <option key={p.product_id} value={p.product_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
                  {fmt(lineTotal(line))}
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
              <td colSpan={5} className="px-3 py-2 text-right">
                Tổng giá trị
              </td>
              <td className="px-3 py-2 text-right text-green-700">
                {fmt(grandTotal)}
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
          disabled={saving}
          className="bg-green-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Đang lưu…' : 'Lưu phiếu nhập'}
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
      {success && <p className="mt-4 text-green-700 text-sm">{success}</p>}
    </div>
  )
}

export default InboundReceipt
