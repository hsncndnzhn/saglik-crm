import TahsilatciEkrani from './TahsilatciEkrani'
import SatisFormu from './SatisFormu'
import SatisciEkrani from './SatisciEkrani'
import EksikBilgiler from './EksikBilgiler'
import OnayKuyrugu from './OnayKuyrugu'
import HedefGirisi from './HedefGirisi'
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
      {profile.role === 'satis' && <SatisciWrapper profile={profile} />}
      {profile.role === 'tahsilat' && <TahsilatciEkrani profile={profile} />}
    </div>
  )
}
function SatisciWrapper({ profile }) {
  const [showForm, setShowForm] = useState(false)
  if (showForm) return (
    <div>
      <button onClick={() => setShowForm(false)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#888', border: 'none', background: 'none', cursor: 'pointer', marginBottom: '1rem', padding: '0' }}>
        ← Geri
      </button>
      <SatisFormu profile={profile} onClose={(saved) => { setShowForm(false) }} />
    </div>
  )
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '9px 18px', fontSize: '13px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>
          + Yeni satış
        </button>
      </div>
      <SatisciEkrani profile={profile} />
    </div>
  )
}
function YoneticiEkrani({ profile }) {
  const [activeTab, setActiveTab] = useState('rapor')

  const tabs = [
  { id: 'rapor', label: 'Ana Rapor' },
  { id: 'onay', label: 'Onay Kuyruğu' },
  { id: 'hedef', label: 'Hedef Girişi' },
  { id: 'fiyat', label: 'Fiyat Listesi' },
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
      {activeTab === 'hedef' && <HedefGirisi />}
      {activeTab === 'onay' && <OnayKuyrugu />}
      {activeTab === 'eksik' && <EksikBilgiler />}
      {activeTab !== 'fiyat' && (
        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center', padding: '2rem' }}>
          Bu sekme geliştiriliyor.
        </div>
      )}
    </div>
  )
}

