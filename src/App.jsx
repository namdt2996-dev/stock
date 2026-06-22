import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import MasterData from './pages/MasterData'
import InboundReceipt from './pages/InboundReceipt'
import StockLevel from './pages/StockLevel'
import OutboundReceipt from './pages/OutboundReceipt'

function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('masterData')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!session) {
    return <Login />
  }

  const navLink = (key, label) => (
    <button
      onClick={() => setPage(key)}
      className={`text-sm font-medium ${
        page === key ? 'text-green-700' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <nav className="flex items-center gap-4">
          {navLink('masterData', 'Master Data')}
          {navLink('inbound', 'Nhập kho')}
          {navLink('stock', 'Tồn kho')}
          {navLink('outbound', 'Xuất hàng')}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Xin chào {session.user.email}</span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="bg-gray-700 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-800"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <main>
        {page === 'masterData' && <MasterData />}
        {page === 'inbound' && <InboundReceipt />}
        {page === 'stock' && <StockLevel />}
        {page === 'outbound' && <OutboundReceipt />}
      </main>
    </div>
  )
}

export default App
