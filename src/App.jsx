import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MasterData from './pages/MasterData'
import InboundReceipt from './pages/InboundReceipt'
import StockLevel from './pages/StockLevel'
import OutboundReceipt from './pages/OutboundReceipt'
import StockTake from './pages/StockTake'
import TransactionHistory from './pages/TransactionHistory'

// Tất cả mục điều hướng (dùng cho cả desktop nav lẫn bottom nav)
const NAV = [
  { key: 'dashboard', label: 'Dashboard', short: 'Home', icon: '🏠' },
  { key: 'masterData', label: 'Master Data', short: 'Data', icon: '🗃️' },
  { key: 'inbound', label: 'Nhập kho', short: 'Nhập', icon: '📥' },
  { key: 'stock', label: 'Tồn kho', short: 'Tồn kho', icon: '📦' },
  { key: 'outbound', label: 'Xuất hàng', short: 'Xuất', icon: '📤' },
  { key: 'stockTake', label: 'Kiểm kho', short: 'Kiểm', icon: '✅' },
  { key: 'history', label: 'Lịch sử', short: 'Lịch sử', icon: '🕘' },
]

// Bottom nav (mobile): 5 mục chính + nhóm còn lại vào "More"
const MAIN_KEYS = ['dashboard', 'inbound', 'stock', 'outbound', 'stockTake']
const mainItems = MAIN_KEYS.map((k) => NAV.find((n) => n.key === k))
const moreItems = NAV.filter((n) => !MAIN_KEYS.includes(n.key))

function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [moreOpen, setMoreOpen] = useState(false)

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

  function go(key) {
    setPage(key)
    setMoreOpen(false)
  }

  const bottomBtn = (active, onClick, icon, label, key) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
        active ? 'text-green-700' : 'text-gray-500'
      }`}
    >
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="no-print flex items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-6 py-3">
        {/* Desktop nav — ẩn dưới sm */}
        <nav className="hidden sm:flex items-center gap-4">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setPage(n.key)}
              className={`text-sm font-medium ${
                page === n.key
                  ? 'text-green-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
        {/* Mobile: tên trang hiện tại */}
        <span className="sm:hidden font-medium text-gray-800">
          {NAV.find((n) => n.key === page)?.label}
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-gray-600">
            Xin chào {session.user.email}
          </span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="bg-gray-700 text-white text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-800"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* pb-20 để nội dung không bị bottom nav che trên mobile */}
      <main className="pb-20 sm:pb-0">
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'masterData' && <MasterData />}
        {page === 'inbound' && <InboundReceipt />}
        {page === 'stock' && <StockLevel />}
        {page === 'outbound' && <OutboundReceipt />}
        {page === 'stockTake' && <StockTake />}
        {page === 'history' && <TransactionHistory />}
      </main>

      {/* Bottom nav — chỉ hiện trên mobile */}
      {moreOpen && (
        <div
          className="no-print sm:hidden fixed inset-0 z-40"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 right-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
            onClick={(e) => e.stopPropagation()}
          >
            {moreItems.map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => go(n.key)}
                className={`flex items-center gap-2 w-full text-left px-4 py-2 text-sm ${
                  page === n.key ? 'text-green-700' : 'text-gray-700'
                }`}
              >
                <span aria-hidden="true">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <nav className="no-print sm:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-gray-200 bg-white">
        {mainItems.map((n) =>
          bottomBtn(page === n.key, () => go(n.key), n.icon, n.short, n.key)
        )}
        {bottomBtn(
          moreItems.some((n) => n.key === page),
          () => setMoreOpen((o) => !o),
          '⋯',
          'More',
          'more'
        )}
      </nav>
    </div>
  )
}

export default App
