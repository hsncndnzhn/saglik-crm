import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const CATS = ['Diş Tedavisi', 'Saç Ekimi', 'Burun Cerrahisi', 'Gastroenteroloji', 'Ek Hizmetler']

export default function FiyatListesi() {
  const [activeCat, setActiveCat] = useState('Diş Tedavisi')
  const [treatments, setTreatments] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState({})
  const [pending, setPending] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('treatments').select('id,name,list_price_eur,min_price_eur,min_qty,max_qty,treatment_categories(name)').order('display_order'),
      supabase.from('services').select('id,name,price_eur,unit').order('display_order')
    ])
    setTreatments(t || [])
    setServices(s || [])
    setLoading(false)
  }

  function getItems() {
    if (activeCat === 'Ek Hizmetler') return services
    return treatments.filter(t => t.treatment_categories?.name === activeCat)
  }

  function startEdit(id, field, val) {
    setEditing(e => ({ ...e, [`${id}_${field}`]: String(val) }))
  }

  function cancelEdit(id, field) {
    const key = `${id}_${field}`
    setEditing(e => { const n = { ...e }; delete n[key]; return n })
  }

  function savePending(id, field, oldVal, name, isService) {
    const key = `${id}_${field}`
    const newVal = parseFloat(editing[key])
    if (isNaN(newVal) || newVal === oldVal) { cancelEdit(id, field); return }
    if (field === 'min_price_eur') {
      const item = treatments.find(t => t.id === id)
      const listVal = pending[`${id}_list_price_eur`]?.new ?? item?.list_price_eur
      if (newVal > listVal) { alert('Minimum fiyat liste fiyatından büyük olamaz.'); return }
    }
    setPending(p => ({ ...p, [key]: { old: oldVal, new: newVal, name, field, id, isService } }))
    cancelEdit(id, field)
  }

  async function commitAll() {
    setSaving(true)
    const entries = Object.values(pending)
    for (const e of entries) {
      const table = e.isService ? 'services' : 'treatments'
      const col = e.isService ? 'price_eur' : e.field
      await supabase.from(table).update({ [col]: e.new }).eq('id', e.id)
    }
    setPending({})
    await loadData()
    setSaving(false)
    setToast(`${entries.length} değişiklik kaydedildi.`)
    setTimeout(() => setToast(''), 3000)
  }

  const pendingCount = Object.keys(pending).length
  const fmt = n => Number(n).toLocaleString('tr-TR')

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '500' }}>Fiyat Listesi</h2>
        {pendingCount > 0 && (
          <button onClick={commitAll} disabled={saving}
            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>
            {saving ? 'Kaydediliyor...' : `${pendingCount} değişikliği kaydet & yayınla`}
          </button>
        )}
      </div>

      {toast && (
        <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#2e7d32', marginBottom: '1rem' }}>
          {toast}
        </div>
      )}

      {pendingCount > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px 14px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', color: '#f57f17', marginBottom: '8px' }}>{pendingCount} bekleyen değişiklik</div>
          {Object.values(pending).map(p => (
            <div key={`${p.id}_${p.field}`} style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '3px 0', alignItems: 'center' }}>
              <span style={{ flex: 1, color: '#333' }}>{p.name}</span>
              <span style={{ color: '#888', textDecoration: 'line-through' }}>{fmt(p.old)} EUR</span>
              <span style={{ color: '#f57f17' }}>→</span>
              <span style={{ color: '#f57f17', fontWeight: '500' }}>{fmt(p.new)} EUR</span>
              <button onClick={() => setPending(prev => { const n = { ...prev }; delete n[`${p.id}_${p.field}`]; return n })}
                style={{ fontSize: '11px', padding: '1px 6px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer', color: '#888' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* KATEGORİ TABLARI */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setActiveCat(c)}
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '500', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ddd', background: activeCat === c ? '#1a1a1a' : 'white', color: activeCat === c ? 'white' : '#555' }}>
            {c}
          </button>
        ))}
      </div>

      {/* TABLO */}
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Tedavi / Hizmet</th>
              {activeCat !== 'Ek Hizmetler' && <>
                <th style={{ padding: '9px 12px', textAlign: 'center', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Min Adet</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Max Adet</th>
                <th style={{ padding: '9px 12px', textAlign: 'right', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Liste Fiyatı EUR</th>
                <th style={{ padding: '9px 12px', textAlign: 'right', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Min Fiyat EUR</th>
              </>}
              {activeCat === 'Ek Hizmetler' && <>
                <th style={{ padding: '9px 12px', textAlign: 'center', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Birim</th>
                <th style={{ padding: '9px 12px', textAlign: 'right', color: '#888', fontWeight: '500', borderBottom: '1px solid #eee' }}>Fiyat EUR</th>
              </>}
              <th style={{ padding: '9px 12px', borderBottom: '1px solid #eee' }}></th>
            </tr>
          </thead>
          <tbody>
            {getItems().map((item, i) => {
              const isService = activeCat === 'Ek Hizmetler'
              const listKey = `${item.id}_list_price_eur`
              const minKey = `${item.id}_min_price_eur`
              const svcKey = `${item.id}_price_eur`
              const listVal = pending[listKey]?.new ?? item.list_price_eur
              const minVal = pending[minKey]?.new ?? item.min_price_eur
              const svcVal = pending[svcKey]?.new ?? item.price_eur
              const listChanged = !!pending[listKey]
              const minChanged = !!pending[minKey]
              const svcChanged = !!pending[svcKey]

              return (
                <tr key={item.id} style={{ borderBottom: i < getItems().length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <td style={{ padding: '9px 12px', fontWeight: '500' }}>{item.name}</td>
                  {!isService && <>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#888' }}>{item.min_qty}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#888' }}>{item.max_qty}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {editing[listKey] !== undefined ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <input type="number" value={editing[listKey]} onChange={e => setEditing(ed => ({ ...ed, [listKey]: e.target.value }))}
                            style={{ width: '80px', padding: '4px 8px', fontSize: '13px', border: '1px solid #4a9eff', borderRadius: '6px', textAlign: 'right' }} autoFocus />
                          <button onClick={() => savePending(item.id, 'list_price_eur', item.list_price_eur, item.name, false)}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '500', border: 'none', borderRadius: '4px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>✓</button>
                          <button onClick={() => cancelEdit(item.id, 'list_price_eur')}
                            style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ color: listChanged ? '#f57f17' : '#1a1a1a', fontWeight: listChanged ? '500' : '400' }}>{fmt(listVal)} EUR</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {editing[minKey] !== undefined ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <input type="number" value={editing[minKey]} onChange={e => setEditing(ed => ({ ...ed, [minKey]: e.target.value }))}
                            style={{ width: '80px', padding: '4px 8px', fontSize: '13px', border: '1px solid #4a9eff', borderRadius: '6px', textAlign: 'right' }} autoFocus />
                          <button onClick={() => savePending(item.id, 'min_price_eur', item.min_price_eur, item.name, false)}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '500', border: 'none', borderRadius: '4px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>✓</button>
                          <button onClick={() => cancelEdit(item.id, 'min_price_eur')}
                            style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ color: minChanged ? '#f57f17' : '#e65100', fontWeight: minChanged ? '500' : '400' }}>{fmt(minVal)} EUR</span>
                      )}
                    </td>
                  </>}
                  {isService && <>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#888' }}>{item.unit}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      {editing[svcKey] !== undefined ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <input type="number" value={editing[svcKey]} onChange={e => setEditing(ed => ({ ...ed, [svcKey]: e.target.value }))}
                            style={{ width: '80px', padding: '4px 8px', fontSize: '13px', border: '1px solid #4a9eff', borderRadius: '6px', textAlign: 'right' }} autoFocus />
                          <button onClick={() => savePending(item.id, 'price_eur', item.price_eur, item.name, true)}
                            style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '500', border: 'none', borderRadius: '4px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>✓</button>
                          <button onClick={() => cancelEdit(item.id, 'price_eur')}
                            style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ color: svcChanged ? '#f57f17' : '#1a1a1a', fontWeight: svcChanged ? '500' : '400' }}>{fmt(svcVal)} EUR</span>
                      )}
                    </td>
                  </>}
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                    {!isService && editing[listKey] === undefined && (
                      <button onClick={() => startEdit(item.id, 'list_price_eur', item.list_price_eur)}
                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer', color: '#888', marginRight: '4px' }}>
                        Liste ✎
                      </button>
                    )}
                    {!isService && editing[minKey] === undefined && (
                      <button onClick={() => startEdit(item.id, 'min_price_eur', item.min_price_eur)}
                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer', color: '#888' }}>
                        Min ✎
                      </button>
                    )}
                    {isService && editing[svcKey] === undefined && (
                      <button onClick={() => startEdit(item.id, 'price_eur', item.price_eur)}
                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', background: 'none', cursor: 'pointer', color: '#888' }}>
                        ✎
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}