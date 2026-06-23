import { supabase } from '../lib/supabase'

// ---------- Products ----------
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
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
