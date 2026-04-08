import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Giriş başarısız: ' + error.message)
      setLoading(false)
    } else {
      onLogin(data.user)
    }
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f5f5f5'}}>
      <div style={{background:'white',padding:'2rem',borderRadius:'12px',width:'320px',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
        <h2 style={{marginBottom:'1.5rem',fontSize:'18px'}}>CRM Giriş</h2>
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{width:'100%',padding:'8px',marginBottom:'10px',border:'1px solid #ddd',borderRadius:'6px',fontSize:'14px'}}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{width:'100%',padding:'8px',marginBottom:'10px',border:'1px solid #ddd',borderRadius:'6px',fontSize:'14px'}}
        />
        {error && <div style={{color:'red',fontSize:'12px',marginBottom:'10px'}}>{error}</div>}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{width:'100%',padding:'10px',background:'#1a1a1a',color:'white',border:'none',borderRadius:'6px',fontSize:'14px',cursor:'pointer'}}
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
      </div>
    </div>
  )
}