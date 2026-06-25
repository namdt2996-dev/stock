import { Fragment, useEffect, useRef, useState } from 'react'
import {
  getProducts,
  createProduct,
  updateProduct,
  toggleProductActive,
  checkSkuExists,
  getPartners,
  createPartner,
  updatePartner,
  getLocations,
  createLocation,
  updateLocation,
  getCategories,
  getParentCategories,
  getChildCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProductSuppliers,
  addProductSupplier,
  removeProductSupplier,
  setPrimarySupplier,
} from '../services/masterData'

const TABS = [
  { key: 'categories', label: 'Danh mục' },
  { key: 'products', label: 'Sản phẩm' },
  { key: 'partners', label: 'Đối tác' },
  { key: 'locations', label: 'Kho' },
]

function MasterData() {
  const [tab, setTab] = useState('products')

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Master Data</h2>

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

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'partners' && <PartnersTab />}
      {tab === 'locations' && <LocationsTab />}
    </div>
  )
}

const inputClass =
  'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const btnClass =
  'bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-green-700 disabled:opacity-50'

// ---------- Categories (2 cấp) ----------
function CategoriesTab() {
  const [cats, setCats] = useState([])
  const [products, setProducts] = useState([])
  const [selectedParent, setSelectedParent] = useState(null)
  const [error, setError] = useState(null)

  const [parentName, setParentName] = useState('')
  const [childName, setChildName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  async function load() {
    setError(null)
    try {
      const [c, p] = await Promise.all([getCategories(), getProducts(false)])
      setCats(c)
      setProducts(p)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const parents = cats.filter((c) => !c.parent_id)
  const childCount = (id) => cats.filter((c) => c.parent_id === id).length
  const directProductCount = (id) =>
    products.filter((p) => p.category_id === id).length
  const parentProductCount = (id) => {
    const childIds = cats.filter((c) => c.parent_id === id).map((c) => c.category_id)
    const ids = new Set([id, ...childIds])
    return products.filter((p) => ids.has(p.category_id)).length
  }
  const children = selectedParent
    ? cats.filter((c) => c.parent_id === selectedParent.category_id)
    : []

  async function addParent(e) {
    e.preventDefault()
    if (!parentName.trim()) return
    try {
      await createCategory({ name: parentName.trim(), parent_id: null })
      setParentName('')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }
  async function addChild(e) {
    e.preventDefault()
    if (!childName.trim() || !selectedParent) return
    try {
      await createCategory({
        name: childName.trim(),
        parent_id: selectedParent.category_id,
      })
      setChildName('')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }
  function startEdit(c) {
    setEditId(c.category_id)
    setEditName(c.name)
    setError(null)
  }
  async function saveEdit() {
    if (!editName.trim()) return
    try {
      await updateCategory(editId, { name: editName.trim() })
      setEditId(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleDelete(c) {
    if (!window.confirm(`Xóa danh mục "${c.name}"?`)) return
    try {
      await deleteCategory(c.category_id)
      if (selectedParent?.category_id === c.category_id) setSelectedParent(null)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const editCell = (c, fallback) =>
    editId === c.category_id ? (
      <input
        className={inputClass}
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
      />
    ) : (
      fallback
    )
  const actionCell = (c) =>
    editId === c.category_id ? (
      <>
        <button onClick={saveEdit} className="text-green-700 text-sm mr-2">💾 Lưu</button>
        <button onClick={() => setEditId(null)} className="text-gray-500 text-sm">✕ Hủy</button>
      </>
    ) : (
      <>
        <button onClick={() => startEdit(c)} className="text-gray-600 hover:text-gray-900 text-sm mr-2">✏️ Sửa</button>
        <button onClick={() => handleDelete(c)} className="text-red-600 hover:text-red-700 text-sm">🗑️ Xóa</button>
      </>
    )

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* PARENT CATEGORIES */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-800">Nhóm cha</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Tên nhóm</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Số nhóm con</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Số SP</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {parents.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-3 text-center text-gray-400">Chưa có nhóm cha</td></tr>
              ) : (
                parents.map((c) => (
                  <tr key={c.category_id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {editCell(
                        c,
                        <button
                          onClick={() => setSelectedParent(c)}
                          title="Click để xem nhóm con"
                          className={`flex items-center gap-1 text-left cursor-pointer hover:underline ${
                            selectedParent?.category_id === c.category_id
                              ? 'text-blue-700 font-medium'
                              : 'text-blue-600'
                          }`}
                        >
                          <span className="text-xs">
                            {selectedParent?.category_id === c.category_id ? '▼' : '▶'}
                          </span>
                          {c.name}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{childCount(c.category_id)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{parentProductCount(c.category_id)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{actionCell(c)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <form onSubmit={addParent} className="flex gap-2 items-end">
          <input
            className={inputClass}
            placeholder="Tên nhóm cha"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
          <button className={btnClass}>Thêm</button>
        </form>
      </div>

      {/* CHILD CATEGORIES */}
      {selectedParent && (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">
            <button onClick={() => setSelectedParent(null)} className="hover:underline">
              Tất cả nhóm
            </button>
            {' > '}
            <span className="text-gray-800 font-medium">{selectedParent.name}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Tên nhóm con</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600">Số SP</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {children.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-3 text-center text-gray-400">Chưa có nhóm con</td></tr>
                ) : (
                  children.map((c) => (
                    <tr key={c.category_id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-800">{editCell(c, c.name)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{directProductCount(c.category_id)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{actionCell(c)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <form onSubmit={addChild} className="flex gap-2 items-end">
            <input
              className={inputClass}
              placeholder={`Tên nhóm con của "${selectedParent.name}"`}
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
            />
            <button className={btnClass}>Thêm</button>
          </form>
        </div>
      )}
    </div>
  )
}

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

  // Danh mục + NCC (cho edit mode)
  const [allCategories, setAllCategories] = useState([])
  const [parentCats, setParentCats] = useState([])
  const [supplierPartners, setSupplierPartners] = useState([])
  const [editCatParent, setEditCatParent] = useState('')
  const [editCatChild, setEditCatChild] = useState('')
  const [editChildCats, setEditChildCats] = useState([])
  const [editSuppliers, setEditSuppliers] = useState([])
  const [addSupplierId, setAddSupplierId] = useState('')
  const [addSupplierPrimary, setAddSupplierPrimary] = useState(false)

  useEffect(() => {
    getCategories().then(setAllCategories).catch(() => {})
    getParentCategories().then(setParentCats).catch(() => {})
    getPartners('SUPPLIER').then(setSupplierPartners).catch(() => {})
  }, [])

  async function onEditParentChange(parentId) {
    setEditCatParent(parentId)
    setEditCatChild('')
    setEditChildCats([])
    if (parentId) {
      try {
        setEditChildCats(await getChildCategories(parentId))
      } catch {
        /* ignore */
      }
    }
  }

  async function reloadEditSuppliers(product_id) {
    try {
      setEditSuppliers(await getProductSuppliers(product_id))
    } catch (e) {
      setError(e.message)
    }
    // đồng bộ tên NCC chính ở hàng hiển thị
    await load()
  }

  async function handleAddSupplier() {
    if (!addSupplierId) return
    try {
      await addProductSupplier(editId, addSupplierId, addSupplierPrimary)
      setAddSupplierId('')
      setAddSupplierPrimary(false)
      await reloadEditSuppliers(editId)
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleSetPrimary(id) {
    try {
      await setPrimarySupplier(id, editId)
      await reloadEditSuppliers(editId)
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleRemoveSupplier(id) {
    try {
      await removeProductSupplier(id)
      await reloadEditSuppliers(editId)
    } catch (e) {
      setError(e.message)
    }
  }

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

  // ----- inline edit -----
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editSkuError, setEditSkuError] = useState(null)

  function startEdit(r) {
    setEditId(r.product_id)
    setEditForm({
      name: r.name || '',
      sku: r.sku || '',
      unit_of_measure: r.unit_of_measure || '',
      pack_unit: r.pack_unit || '',
      conversion_factor: r.conversion_factor ?? '',
    })
    setEditSkuError(null)
    setError(null)

    // Prefill cascade danh mục từ category_id của SP
    const cat = allCategories.find((c) => c.category_id === r.category_id)
    let parent = '',
      child = ''
    if (cat) {
      if (cat.parent_id) {
        parent = cat.parent_id
        child = cat.category_id
      } else {
        parent = cat.category_id
      }
    }
    setEditCatParent(parent)
    setEditCatChild(child)
    if (parent) getChildCategories(parent).then(setEditChildCats).catch(() => {})
    else setEditChildCats([])

    getProductSuppliers(r.product_id).then(setEditSuppliers).catch(() => {})
    setAddSupplierId('')
    setAddSupplierPrimary(false)
  }
  function cancelEdit() {
    setEditId(null)
    setEditForm(null)
    setEditSkuError(null)
    setEditSuppliers([])
  }
  function setEf(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }))
    if (field === 'sku') setEditSkuError(null)
  }

  async function handleEditSave() {
    if (!editForm.name.trim() || !editForm.sku.trim()) {
      setEditSkuError(null)
      setError('Tên và SKU không được để trống.')
      return
    }
    try {
      if (await checkSkuExists(editForm.sku, editId)) {
        setEditSkuError('SKU này đã tồn tại')
        return
      }
    } catch {
      // bỏ qua lỗi kiểm tra, để DB bắt 23505
    }
    try {
      await updateProduct(editId, {
        ...editForm,
        conversion_factor: editForm.conversion_factor
          ? Number(editForm.conversion_factor)
          : undefined,
        category_id: editCatChild || editCatParent || null,
      })
      cancelEdit()
      await load() // tải lại để cập nhật category_path + NCC chính
    } catch (e) {
      if (e.code === '23505') {
        setEditSkuError('SKU đã tồn tại, vui lòng dùng SKU khác')
      } else {
        setError(e.message)
      }
      return
    }
  }

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
              <th className="text-left px-3 py-2 font-medium text-gray-600">Danh mục</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">NCC chính</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Trạng thái</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-3 text-center text-gray-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              visibleRows.map((r) => {
                const active = r.is_active !== false
                const editing = editId === r.product_id
                if (editing) {
                  return (
                    <Fragment key={r.product_id}>
                    <tr className="border-t border-gray-100 bg-green-50/40">
                      <td className="px-3 py-2">
                        <input
                          className={inputClass}
                          value={editForm.name}
                          onChange={(e) => setEf('name', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={`${inputClass} ${editSkuError ? 'border-red-500 focus:ring-red-500' : ''}`}
                          value={editForm.sku}
                          onChange={(e) => setEf('sku', e.target.value)}
                        />
                        {editSkuError && (
                          <div className="text-red-600 text-xs mt-0.5">{editSkuError}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={`${inputClass} w-20`}
                          value={editForm.unit_of_measure}
                          onChange={(e) => setEf('unit_of_measure', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            className={`${inputClass} w-24`}
                            placeholder="thùng…"
                            value={editForm.pack_unit}
                            onChange={(e) => setEf('pack_unit', e.target.value)}
                          />
                          {editForm.pack_unit && (
                            <input
                              type="number"
                              min="1"
                              className={`${inputClass} w-16`}
                              placeholder="SL"
                              value={editForm.conversion_factor}
                              onChange={(e) => setEf('conversion_factor', e.target.value)}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">↓ bên dưới</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">↓ bên dưới</td>
                      <td className="px-3 py-2 text-gray-400 text-xs">—</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={handleEditSave}
                          className="text-green-700 hover:text-green-800 text-sm mr-2"
                        >
                          💾 Lưu
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          ✕ Hủy
                        </button>
                      </td>
                    </tr>
                    <tr className="bg-green-50/40">
                      <td colSpan={8} className="px-3 pb-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Danh mục cascade */}
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Danh mục</div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                className={inputClass}
                                value={editCatParent}
                                onChange={(e) => onEditParentChange(e.target.value)}
                              >
                                <option value="">-- Nhóm cha --</option>
                                {parentCats.map((c) => (
                                  <option key={c.category_id} value={c.category_id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
                                value={editCatChild}
                                disabled={!editCatParent}
                                onChange={(e) => setEditCatChild(e.target.value)}
                              >
                                <option value="">-- Nhóm con --</option>
                                {editChildCats.map((c) => (
                                  <option key={c.category_id} value={c.category_id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Quản lý NCC */}
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</div>
                            <ul className="space-y-1 mb-2">
                              {editSuppliers.length === 0 && (
                                <li className="text-xs text-gray-400">Chưa có NCC</li>
                              )}
                              {editSuppliers.map((s) => (
                                <li key={s.id} className="flex items-center gap-2 text-sm">
                                  <button
                                    type="button"
                                    onClick={() => handleSetPrimary(s.id)}
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      s.is_primary
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                    title="Đặt làm NCC chính"
                                  >
                                    {s.is_primary ? '★ Chính' : '☆ Phụ'}
                                  </button>
                                  <span className="text-gray-700">{s.partner_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSupplier(s.id)}
                                    className="text-red-500 hover:text-red-700 text-xs ml-auto"
                                  >
                                    ✕
                                  </button>
                                </li>
                              ))}
                            </ul>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className={inputClass}
                                value={addSupplierId}
                                onChange={(e) => setAddSupplierId(e.target.value)}
                              >
                                <option value="">-- Chọn NCC --</option>
                                {supplierPartners
                                  .filter(
                                    (p) =>
                                      !editSuppliers.some(
                                        (s) => s.partner_id === p.partner_id
                                      )
                                  )
                                  .map((p) => (
                                    <option key={p.partner_id} value={p.partner_id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                              <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={addSupplierPrimary}
                                  onChange={(e) => setAddSupplierPrimary(e.target.checked)}
                                />
                                NCC chính
                              </label>
                              <button
                                type="button"
                                onClick={handleAddSupplier}
                                disabled={!addSupplierId}
                                className="bg-gray-700 text-white text-xs font-medium px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
                              >
                                Thêm NCC
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  )
                }
                return (
                  <tr key={r.product_id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.sku}</td>
                    <td className="px-3 py-2 text-gray-600">{r.unit_of_measure}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.pack_unit ? `${r.pack_unit}/${r.conversion_factor ?? 1}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.category_path || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.primary_supplier_name || '—'}</td>
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
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        ✏️ Sửa
                      </button>
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

  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  function startEdit(r) {
    setEditId(r.partner_id)
    setEditForm({ name: r.name || '', type: r.type || 'SUPPLIER' })
    setError(null)
  }
  function cancelEdit() {
    setEditId(null)
    setEditForm(null)
  }
  async function handleEditSave() {
    if (!editForm.name.trim()) {
      setError('Tên đối tác không được để trống.')
      return
    }
    try {
      const updated = await updatePartner(editId, editForm)
      setRows((prev) =>
        prev.map((r) => (r.partner_id === editId ? { ...r, ...updated } : r))
      )
      cancelEdit()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Tên đối tác</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Loại</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-center text-gray-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              rows.map((r) =>
                editId === r.partner_id ? (
                  <tr key={r.partner_id} className="border-t border-gray-100 bg-green-50/40">
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className={inputClass}
                        value={editForm.type}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, type: e.target.value }))
                        }
                      >
                        <option value="SUPPLIER">SUPPLIER</option>
                        <option value="CUSTOMER">CUSTOMER</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={handleEditSave}
                        className="text-green-700 hover:text-green-800 text-sm mr-2"
                      >
                        💾 Lưu
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        ✕ Hủy
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.partner_id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.type}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        ✏️ Sửa
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
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

  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  function startEdit(r) {
    setEditId(r.location_id)
    setEditForm({ warehouse_name: r.warehouse_name || '', address: r.address || '' })
    setError(null)
  }
  function cancelEdit() {
    setEditId(null)
    setEditForm(null)
  }
  async function handleEditSave() {
    if (!editForm.warehouse_name.trim()) {
      setError('Tên kho không được để trống.')
      return
    }
    try {
      const updated = await updateLocation(editId, editForm)
      setRows((prev) =>
        prev.map((r) => (r.location_id === editId ? { ...r, ...updated } : r))
      )
      cancelEdit()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Tên kho</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Địa chỉ</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-center text-gray-400">
                  Chưa có dữ liệu
                </td>
              </tr>
            ) : (
              rows.map((r) =>
                editId === r.location_id ? (
                  <tr key={r.location_id} className="border-t border-gray-100 bg-green-50/40">
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        value={editForm.warehouse_name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, warehouse_name: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        value={editForm.address}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, address: e.target.value }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={handleEditSave}
                        className="text-green-700 hover:text-green-800 text-sm mr-2"
                      >
                        💾 Lưu
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        ✕ Hủy
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.location_id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{r.warehouse_name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.address}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        ✏️ Sửa
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
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
