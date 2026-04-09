import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const TYPE_LABELS = {
  onaysiz_satis: 'Onaysız Satış',
  satis_revizyonu: 'Satış Revizyonu',
  tahsilat_duzenle: 'Tahsilat Düzenleme',
}

const TYPE_COLORS = {
  onaysiz_satis: { bg: '#e3f2fd', color: '#1565c0' },
  satis_revizyonu: { bg: '#fff8e1', color: '#f57f17' },
  tahsilat_duzenle: { bg: '#e8f5e9', color: '#2e7d32' },
}

export default function OnayKuyrugu() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState({})
  const [filter, setFilter] = useState('bekliyor')

  useEffect(() => { loadData() }, [filter])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('approval_queue')
      .select('id, type, reference_id, reference_type, submitted_at, status, submitter_note, changes_summary, submitted_by')
      .eq('status', filter)
      .order('submitted_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function decide(id, approve) {
    setProcessing(p => ({ ...p, [id]: true }))
    await supabase
      .from('approval_queue')
      .update({ status: approve ? 'onaylandi' : 'reddedildi', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setProcessing(p => ({ ...p, [id]: false }))
    setItems(prev => prev.filter(x => x.id !== id))
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '500' }}>
          Onay Kuyruğu
          {filter === 'bekliyor' && items.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '12px', padding: '2px 8px', background: '#fff3e0', color: '#e65100', borderRadius: '20px' }}>
              {items.length}
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['bekliyor', 'onaylandi', 'reddedildi'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '500', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ddd', background: filter === f ? '#1a1a1a' : 'white', color: filter === f ? 'white' : '#555' }}>
              {f === 'bekliyor' ? 'Bekleyen' : f === 'onaylandi' ? 'Onaylanan' : 'Reddedilen'}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '3rem', textAlign: 'center', color: '#888', fontSize: '13px' }}>
          {filter === 'bekliyor' ? 'Bekleyen onay yok' : 'Kayıt bulunamadı'}
        </div>
      )}

      {items.map(item => {
        const typeColor = TYPE_COLORS[item.type] || { bg: '#f5f5f5', color: '#555' }
        const changes = item.changes_summary || []
        return (
          <div key={item.id} style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '500', background: typeColor.bg, color: typeColor.color, flexShrink: 0 }}>
                {TYPE_LABELS[item.type] || item.type}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '500', flex: 1 }}>#{item.reference_id}</span>
              <span style={{ fontSize: '11px', color: '#888', flexShrink: 0 }}>
                {new Date(item.submitted_at).toLocaleDateString('tr-TR')}
              </span>
            </div>

            {changes.length > 0 && (
              <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                {changes.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '3px 0', alignItems: 'center' }}>
                    <span style={{ color: '#888', minWidth: '120px' }}>{c.field}</span>
                    <span style={{ color: '#aaa', textDecoration: 'line-through' }}>{c.old}</span>
                    <span style={{ color: '#888' }}>→</span>
                    <span style={{ color: '#f57f17', fontWeight: '500' }}>{c.new}</span>
                  </div>
                ))}
              </div>
            )}

            {item.submitter_note && (
              <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: '#f57f17', fontWeight: '500', marginBottom: '3px' }}>Satışçı notu:</div>
                <div style={{ fontSize: '12px', color: '#333' }}>{item.submitter_note}</div>
              </div>
            )}

            {filter === 'bekliyor' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => decide(item.id, true)} disabled={processing[item.id]}
                  style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: processing[item.id] ? 0.6 : 1 }}>
                  Onayla
                </button>
                <button onClick={() => decide(item.id, false)} disabled={processing[item.id]}
                  style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '500', border: '1px solid #ffcdd2', borderRadius: '8px', background: '#ffebee', color: '#c62828', cursor: 'pointer', opacity: processing[item.id] ? 0.6 : 1 }}>
                  Reddet
                </button>
              </div>
            )}

            {filter !== 'bekliyor' && (
              <div style={{ fontSize: '12px', color: filter === 'onaylandi' ? '#2e7d32' : '#c62828', fontWeight: '500' }}>
                {filter === 'onaylandi' ? '✓ Onaylandı' : '✕ Reddedildi'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}