import Dashboard from './Dashboard'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(uid) {
  const { data, error } = await supabase
    .from('users')
    .select('full_name, role, agency_id')
    .eq('id', uid)
    .single()
  console.log('profile:', data, 'error:', error)
  setProfile(data)
  setLoading(false)
}

  function handleLogout() {
    supabase.auth.signOut()
  }

  if (loading) return <div style={{padding:'2rem'}}>Yükleniyor...</div>
  if (!user || !profile) return <Login onLogin={() => {}} />

  return (
    <div style={{padding:'2rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div>
          <strong>{profile.full_name}</strong>
          <span style={{marginLeft:'8px',fontSize:'12px',padding:'2px 8px',background:'#f0f0f0',borderRadius:'20px'}}>
            {profile.role}
          </span>
        </div>
        <button onClick={handleLogout} style={{fontSize:'12px',padding:'6px 12px',cursor:'pointer'}}>
          Çıkış
        </button>
      </div>
      <div style={{color:'#666',fontSize:'14px'}}>
        return <Dashboard profile={profile} onLogout={handleLogout} />
      </div>
    </div>
  )
}

export default App