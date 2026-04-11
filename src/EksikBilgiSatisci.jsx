import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function EksikBilgiSatisci({ profile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('patients_missing_info')
      .select('*')
      .eq('salesperson_id', profile.id)
      .order('last_name')
    setRows(data || [])
    setLoading(false)
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const s = search.toLocaleLowerCase('tr')
    return (r.first_name + ' ' + r.last_name).toLocaleLowerCase('tr').includes(s) ||
      r.patient_code?.toLocaleLowerCase('tr').includes(s)
  })

  function startEdit(r) {
    setEditing(r.id + '_' + r.sale_id)
    setForm({ passport_no: r.passport_no || '', address: r.address || '' })
  }

  async function saveEdit(r) {
    setSaving(true)
    await supabase.from('patients')
      .update({ passport_no: form.passport_no, address: form.address })
      .eq('id', r.id)
    setSaving(false)
    setEditing(null)
    setToast('Bilgiler güncellendi.')
    setTimeout(() => setToast(''), 2500)
    loadData()
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontSize: '15px', fontWeight: '500' }}>
          Eksik Bilgiler & Revize
          {rows.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '12px', padding: '2px 8px', background: '#fff3e0', color: '#e65100', borderRadius: '20px' }}>
              {rows.length}
            </span>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#2e7d32', marginBottom: '1rem' }}>
          {toast}
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <input type="text" placeholder="Ad, soyad veya hasta kodu..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: '#888', fontSize: '13px' }}>
          {rows.length === 0 ? 'Eksik bilgisi olan hastanız yok.' : 'Sonuç bulunamadı.'}
        </div>
      )}

      {filtered.map(r => {
        const editKey = r.id + '_' + r.sale_id
        return (
          <div key={editKey} style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '14px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{r.first_name} {r.last_name}</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{r.patient_code} · {r.phone}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {r.missing_passport && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#fff3e0', color: '#e65100', fontWeight: '500' }}>
                      Pasaport / TC eksik
                    </span>
                  )}
                  {r.missing_address && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#fff3e0', color: '#e65100', fontWeight: '500' }}>
                      Adres eksik
                    </span>
                  )}
                  {r.missing_treatment_date && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#e3f2fd', color: '#1565c0', fontWeight: '500' }}>
                      Tedavi tarihi netleştirilmeli
                    </span>
                  )}
                </div>
              </div>
              {editing !== editKey && (
                <button onClick={() => startEdit(r)}
                  style={{ padding: '6px 14px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#555', flexShrink: 0 }}>
                  Düzenle
                </button>
              )}
            </div>

            {editing === editKey && (
              <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Pasaport / TC No</label>
                  <input type="text" value={form.passport_no}
                    onChange={e => setForm(f => ({ ...f, passport_no: e.target.value }))}
                    placeholder="Pasaport veya kimlik numarası"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }} />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Adres</label>
                  <textarea value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Sokak, mahalle, şehir, ülke" rows={2}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', resize: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setEditing(null)}
                    style={{ flex: 1, padding: '8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                    İptal
                  </button>
                  <button onClick={() => saveEdit(r)} disabled={saving}
                    style={{ flex: 2, padding: '8px', fontSize: '13px', fontWeight: '500', border: 'none', borderRadius: '6px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}