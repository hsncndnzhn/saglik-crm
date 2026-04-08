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
  return (
    <div>
      <h2 style={{fontSize:'16px',fontWeight:'500',marginBottom:'1rem'}}>Yönetici Paneli</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'1.5rem'}}>
        {[
          {label:'Bugün satış',val:'—'},
          {label:'Beklenen tahsilat',val:'—'},
          {label:'Gerçekleşen tahsilat',val:'—'},
          {label:'Vadesi geçmiş',val:'—'},
        ].map(m=>(
          <div key={m.label} style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:'10px',padding:'12px 14px'}}>
            <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>{m.label}</div>
            <div style={{fontSize:'20px',fontWeight:'500'}}>{m.val}</div>
          </div>
        ))}
      </div>
      <div style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:'10px',padding:'14px',color:'#888',fontSize:'13px',textAlign:'center'}}>
        Ekranlar geliştiriliyor — veriler bağlandıkça burada görünecek.
      </div>
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