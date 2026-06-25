import { supabase } from '../lib/supabase'

// ---------- Products ----------
// activeOnly=true (mặc định): chỉ sản phẩm đang dùng (is_active = true).
// activeOnly=false: tất cả (dùng cho trang Master Data).
export async function getProducts(activeOnly = true) {
  let query = supabase
    .from('products')
    .select(
      `
      *,
      categories:category_id ( name, parent:parent_id ( name ) ),
      product_suppliers ( is_primary, partners:partner_id ( name ) )
    `
    )
    .order('name', { ascending: true })
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((p) => {
    const cat = p.categories
    const category_path = cat
      ? cat.parent
        ? `${cat.parent.name} > ${cat.name}`
        : cat.name
      : null
    const primary = (p.product_suppliers ?? []).find((s) => s.is_primary)
    return {
      ...p,
      category_path,
      primary_supplier_name: primary?.partners?.name ?? null,
    }
  })
}

// Kiểm tra SKU đã tồn tại chưa (true = đã có).
// excludeId: bỏ qua chính sản phẩm này (dùng khi update).
export async function checkSkuExists(sku, excludeId = null) {
  const value = (sku || '').trim()
  if (!value) return false
  let query = supabase.from('products').select('product_id').eq('sku', value)
  if (excludeId) query = query.neq('product_id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return !!data
}

export async function toggleProductActive(product_id, is_active) {
  const { data, error } = await supabase
    .from('products')
    .update({ is_active })
    .eq('product_id', product_id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createProduct({
  name,
  sku,
  unit_of_measure,
  pack_unit,
  conversion_factor,
}) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      sku,
      unit_of_measure,
      pack_unit: pack_unit || null,
      conversion_factor: pack_unit ? conversion_factor || 1 : null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(
  product_id,
  { name, sku, unit_of_measure, pack_unit, conversion_factor, category_id }
) {
  const patch = {
    name,
    sku,
    unit_of_measure,
    pack_unit: pack_unit || null,
    conversion_factor: pack_unit ? conversion_factor || 1 : null,
  }
  // chỉ cập nhật category_id khi được truyền (undefined = giữ nguyên)
  if (category_id !== undefined) patch.category_id = category_id || null

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('product_id', product_id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Partners ----------
export async function getPartners(type) {
  let query = supabase.from('partners').select('*').order('name', { ascending: true })
  if (type) query = query.eq('type', type)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createPartner({ name, type }) {
  const { data, error } = await supabase
    .from('partners')
    .insert({ name, type })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePartner(partner_id, { name, type }) {
  const { data, error } = await supabase
    .from('partners')
    .update({ name, type })
    .eq('partner_id', partner_id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Locations ----------
export async function getLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('warehouse_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createLocation({ warehouse_name, address }) {
  const { data, error } = await supabase
    .from('locations')
    .insert({ warehouse_name, address })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLocation(location_id, { warehouse_name, address }) {
  const { data, error } = await supabase
    .from('locations')
    .update({ warehouse_name, address })
    .eq('location_id', location_id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Categories (2 cấp) ----------
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*, parent:parent_id ( name )')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((c) => ({ ...c, parent_name: c.parent?.name ?? null }))
}

export async function getParentCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getChildCategories(parent_id) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parent_id)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCategory({ name, parent_id }) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, parent_id: parent_id || null })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(category_id, { name, parent_id }) {
  const patch = { name }
  if (parent_id !== undefined) patch.parent_id = parent_id || null
  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('category_id', category_id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Chỉ cho xóa nếu không có sản phẩm nào dùng danh mục này.
export async function deleteCategory(category_id) {
  const { count, error: countErr } = await supabase
    .from('products')
    .select('product_id', { count: 'exact', head: true })
    .eq('category_id', category_id)
  if (countErr) throw countErr
  if ((count ?? 0) > 0) {
    throw new Error('Không thể xóa: còn sản phẩm thuộc danh mục này.')
  }
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('category_id', category_id)
  if (error) throw error
}

// ---------- Product Suppliers ----------
export async function getProductSuppliers(product_id) {
  const { data, error } = await supabase
    .from('product_suppliers')
    .select('id, product_id, partner_id, is_primary, partners:partner_id ( name )')
    .eq('product_id', product_id)
  if (error) throw error
  return (data ?? []).map((s) => ({
    ...s,
    partner_name: s.partners?.name ?? '',
  }))
}

export async function addProductSupplier(product_id, partner_id, is_primary = false) {
  const { data, error } = await supabase
    .from('product_suppliers')
    .insert({ product_id, partner_id, is_primary })
    .select()
    .single()
  if (error) throw error
  if (is_primary) await setPrimarySupplier(data.id, product_id)
  return data
}

export async function removeProductSupplier(id) {
  const { error } = await supabase.from('product_suppliers').delete().eq('id', id)
  if (error) throw error
}

// Set is_primary=true cho id này, false cho tất cả NCC khác của product_id.
export async function setPrimarySupplier(id, product_id) {
  const { error: e1 } = await supabase
    .from('product_suppliers')
    .update({ is_primary: false })
    .eq('product_id', product_id)
  if (e1) throw e1
  const { error: e2 } = await supabase
    .from('product_suppliers')
    .update({ is_primary: true })
    .eq('id', id)
  if (e2) throw e2
}
