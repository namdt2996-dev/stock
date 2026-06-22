import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase.from('products').select('*')
      if (error) {
        setError(error.message)
      } else {
        setProducts(data ?? [])
      }
      setLoading(false)
    }
    fetchProducts()
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-green-600">Stock System — OK</h1>

      {loading && <p className="mt-4">Đang tải products…</p>}

      {error && (
        <p className="mt-4 text-red-600">Lỗi: {error}</p>
      )}

      {!loading && !error && (
        <div className="mt-4">
          <p className="font-medium">
            Lấy được {products.length} product(s) từ Supabase.
          </p>
          <pre className="mt-2 text-left text-sm bg-gray-100 p-3 rounded overflow-auto">
            {JSON.stringify(products, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default App
