import { useEffect, useState } from 'react'
import { getLocations } from '../services/masterData'
import { createTransfer, getProductsByLocation } from '../services/inventory'

const today = () => new Date().toISOString().slice(0, 10)

const emptyLine = () => ({ product_id: '', unit_of_measure: '', quantity: '' })

const emptyHeader = () => ({
  transaction_date: today(),
  location_from: '',
  location_to: '',
  reference_doc: '',
})

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

function Transfer() {
  const [header, setHeader] = useState(emptyHeader())
  const [lines, setLines] = useState([emptyLine()])

  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!showToast) return
    const t = setTimeout(() => setShowToast(false), 15000)
    return () => clearTimeout(t)
  }, [showToast])

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((e) => setError(`Lỗi tải danh mục kho: ${e.message}`))
  }, [])

  // Đổi kho đi: load lại sản phẩm có tồn + reset dòng
  async function handleFromChange(location_from) {
    setHeader((h) => ({ ...h, location_from }))
    setLines([emptyLine()])
    setProducts([])
    setError(null)
    if (!location_from) return
    try {
      setProducts(await getProductsByLocation(location_from))
    } catch (e) {
      setError(`Lỗi tải sản phẩm theo kho: ${e.message}`)
    }
  }

  function updateLine(index, field, value) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    )
  }

  function handleProductChange(index, product_id) {
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
    setProducts([])
    setError(null)
  }

  async function handleSave() {
    setError(null)
    if (!header.location_from) return setError('Vui lòng chọn kho đi.')
    if (!header.location_to) return setError('Vui lòng chọn kho đến.')
    if (header.location_from === header.location_to) {
      return setError('Kho đi và kho đến không được giống nhau.')
    }

    const cleanLines = lines
      .filter((l) => l.product_id)
      .map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) }))

    if (cleanLines.length === 0) {
      return setError('Phiếu chuyển phải có ít nhất 1 dòng sản phẩm hợp lệ.')
    }
    if (cleanLines.some((l) => !l.quantity || l.quantity <= 0)) {
      return setError('Số lượng mỗi dòng phải lớn hơn 0.')
    }

    setSaving(true)
    try {
      await createTransfer(header, cleanLines)
      setShowToast(true)
      resetForm()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6">
      {showToast && (
        <div className="no-print fixed top-4 right-4 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded shadow-lg">
          ✓ Phiếu chuyển kho đã được lưu thành công!
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-4">Phiếu chuyển kho</h2>

      {/* HEADER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white border border-gray-200 rounded p-4 mb-4">
        <label className="flex flex-col text-sm text-gray-600">
          Ngày chuyển
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
          <span>Kho đi <span className="text-red-500 text-xs">*</span></span>
          <select
            className={inputClass}
            value={header.location_from}
            onChange={(e) => handleFromChange(e.target.value)}
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
          <span>Kho đến <span className="text-red-500 text-xs">*</span></span>
          <select
            className={inputClass}
            value={header.location_to}
            onChange={(e) =>
              setHeader({ ...header, location_to: e.target.value })
            }
          >
            <option value="">-- Chọn kho --</option>
            {locations
              .filter((l) => l.location_id !== header.location_from)
              .map((l) => (
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

      {/* Ghi chú FEFO */}
      <p className="text-sm text-gray-500 mb-2">
        ℹ️ Hệ thống tự chọn lô theo FEFO từ kho đi (hạn dùng gần nhất trước).
      </p>

      {/* LINES */}
      <div className="bg-white border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Sản phẩm</th>
              <th className="text-left px-3 py-2">ĐVT</th>
              <th className="text-right px-3 py-2">Số lượng cần chuyển</th>
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
                    disabled={!header.location_from}
                    onChange={(e) => handleProductChange(i, e.target.value)}
                  >
                    <option value="">
                      {header.location_from ? '-- Chọn SP --' : 'Chọn kho đi trước'}
                    </option>
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
          {saving ? 'Đang lưu…' : 'Lưu phiếu chuyển'}
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

export default Transfer
