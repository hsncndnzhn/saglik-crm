import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{padding:'2rem'}}>Yükleniyor...</div>
  if (!user) return <Login onLogin={setUser} />

  return (
    <div style={{padding:'2rem'}}>
      <h2>Hoş geldiniz</h2>
      <p>Giriş yapan: {user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
    </div>
  )
}

export default App