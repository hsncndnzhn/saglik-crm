import AnaRapor from './AnaRapor'
import { useState } from 'react'
import FiyatListesi from './FiyatListesi'
export default function Dashboard({ profile, onLogout }) {
  return (
    <div style={{padding:'1.5rem',maxWidth:'900px',margin:'0 auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',paddingBottom:'1rem',borderBottom:'1px solid #eee'}}>
        <div>
          <div style={{fontSize:'18px',fontWeight:'500'}}>{profile.full_name}</div>
          <div style={{fontSize:'12px',color:'#888',marginTop:'2px',textTransform:'capitalize'}}>{profile.role}</div>
        </div>
        <button onClick={onLogout} style={{fontSize:'12px',padding:'6px 14px',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer',background:'white'}}>
          Çıkış
        </button>
      </div>

      {profile.role === 'yonetici' && <YoneticiEkrani profile={profile} />}
      {profile.role === 'satis' && <SatisciEkrani profile={profile} />}
      {profile.role === 'tahsilat' && <TahsilatciEkrani profile={profile} />}
    </div>
  )
}

function YoneticiEkrani({ profile }) {
  const [activeTab, setActiveTab] = useState('fiyat')

  const tabs = [
    { id: 'fiyat', label: 'Fiyat Listesi' },
    { id: 'rapor', label: 'Ana Rapor' },
    { id: 'onay', label: 'Onay Kuyruğu' },
    { id: 'hedef', label: 'Hedef Girişi' },
    { id: 'eksik', label: 'Eksik Bilgiler' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: activeTab === t.id ? '500' : '400', border: 'none', borderBottom: activeTab === t.id ? '2px solid #1a1a1a' : '2px solid transparent', background: 'none', cursor: 'pointer', color: activeTab === t.id ? '#1a1a1a' : '#888', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'fiyat' && <FiyatListesi />}
      {activeTab === 'rapor' && <AnaRapor />}
      {activeTab !== 'fiyat' && (
        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '2rem' }}>
          Bu sekme geliştiriliyor.
        </div>
      )}
    </div>
  )
}

function SatisciEkrani({ profile }) {
  return (
    <div>
      <h2 style={{fontSize:'16px',fontWeight:'500',marginBottom:'1rem'}}>Merhaba, {profile.full_name}</h2>
      <div style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:'10px',padding:'14px',color:'#888',fontSize:'13px',textAlign:'center'}}>
        Satışçı ekranı geliştiriliyor.
      </div>
    </div>
  )
}

function TahsilatciEkrani({ profile }) {
  return (
    <div>
      <h2 style={{fontSize:'16px',fontWeight:'500',marginBottom:'1rem'}}>Merhaba, {profile.full_name}</h2>
      <div style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:'10px',padding:'14px',color:'#888',fontSize:'13px',textAlign:'center'}}>
        Tahsilatçı ekranı geliştiriliyor.
      </div>
    </div>
  )
}