import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'

function App() {
  const [session, setSession] = useState(null)

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <h1 className="text-2xl font-bold text-green-600">
        Xin chào {session.user.email}
      </h1>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="bg-gray-700 text-white font-medium px-4 py-2 rounded hover:bg-gray-800"
      >
        Đăng xuất
      </button>
    </div>
  )
}

export default App
