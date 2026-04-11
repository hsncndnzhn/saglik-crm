import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const fmt = n => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })
const FX = { EUR: 1, USD: 0.92, CHF: 1.04, GBP: 1.17, TRY: 0.028 }
const METHODS = { nakit: 'Nakit', havale: 'Havale', kredi_karti: 'Kredi kartı', diger: 'Diğer' }

export default function TahsilatciEkrani({ profile }) {
  const [metrics, setMetrics] = useState({ todayExp: 0, todayCol: 0, monthExp: 0, monthCol: 0 })
  const [overdueList, setOverdueList] = useState([])
  const [todayList, setTodayList] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [openCards, setOpenCards] = useState({})
  const [openForms, setOpenForms] = useState({})
  const [formData, setFormData] = useState({})
  const [collections, setCollections] = useState({})
  const [saving, setSaving] = useState({})
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    const { data: instData } = await supabase
      .from('installments')
      .select(`
        id, sale_id, sequence_no, due_date, expected_amount_eur, amount, currency, collection_channel,
        sales(id, sale_code, user_id, patients(id, patient_code, first_name, last_name),
          users(full_name, agencies(name)))
      `)

    const { data: colData } = await supabase
      .from('collections')
      .select('installment_id, amount_eur, amount, currency, method, collection_date, entry_date, locked')

    // Tahsilat map
    const colMap = {}
    ;(colData || []).forEach(c => {
      if (!colMap[c.installment_id]) colMap[c.installment_id] = []
      colMap[c.installment_id].push(c)
    })
    setCollections(colMap)

    const totalCollected = (instId) => (colMap[instId] || []).reduce((s, c) => s + Number(c.amount_eur), 0)
    const isPaid = (inst) => totalCollected(inst.id) >= Number(inst.expected_amount_eur) - 0.01

    // Metrikler
    const todayInsts = (instData || []).filter(i => i.due_date === today)
    const monthInsts = (instData || []).filter(i => i.due_date >= monthStart && i.due_date <= today)
    setMetrics({
      todayExp: todayInsts.reduce((s, i) => s + Number(i.expected_amount_eur), 0),
      todayCol: todayInsts.reduce((s, i) => s + totalCollected(i.id), 0),
      monthExp: monthInsts.reduce((s, i) => s + Number(i.expected_amount_eur), 0),
      monthCol: monthInsts.reduce((s, i) => s + totalCollected(i.id), 0),
    })

    // Vadesi geçmiş
    setOverdueList((instData || []).filter(i => i.due_date < today && !isPaid(i)))

    // Bugün vadeli
    setTodayList(todayInsts.filter(i => !isPaid(i)))

    setLoading(false)
  }

  async function doSearch(val) {
    if (val.length < 2) { setSearchResults(null); return }
    const { data } = await supabase
      .from('patients')
      .select(`id, patient_code, first_name, last_name, phone,
        sales(id, sale_code, user_id,
          installments(id, sequence_no, due_date, expected_amount_eur, currency, collection_channel),
          users(full_name, agencies(name)))`)
      .or(`first_name.ilike.%${val}%,last_name.ilike.%${val}%,patient_code.ilike.%${val}%`)
    setSearchResults(data || [])
  }

  function toggleCard(key) {
    setOpenCards(p => ({ ...p, [key]: !p[key] }))
  }

  function toggleForm(key, inst, patient) {
    setOpenForms(p => ({ ...p, [key]: !p[key] }))
    if (!formData[key]) {
      setFormData(p => ({ ...p, [key]: { channel: inst.collection_channel || 'elitenova', method: '', amount: inst.expected_amount_eur, currency: 'EUR', date: new Date().toISOString().split('T')[0], note: '' } }))
    }
  }

  async function saveCollection(key, instId, patientId) {
    const fd = formData[key]
    if (!fd?.method) { alert('Ödeme yöntemi seçiniz.'); return }
    setSaving(p => ({ ...p, [key]: true }))
    const amtEur = (parseFloat(fd.amount) || 0) * (FX[fd.currency] || 1)
    await supabase.from('collections').insert({
      installment_id: instId,
      sale_id: null,
      patient_id: patientId,
      collected_by: profile.id,
      amount: parseFloat(fd.amount),
      currency: fd.currency,
      amount_eur: amtEur,
      channel: fd.channel,
      method: fd.method,
      collection_date: fd.date,
      notes: fd.note,
      entry_date: new Date().toISOString().split('T')[0],
      status: 'approved',
    })
    setSaving(p => ({ ...p, [key]: false }))
    setOpenForms(p => ({ ...p, [key]: false }))
    setToast('Tahsilat kaydedildi.')
    setTimeout(() => setToast(''), 2500)
    loadData()
  }

  function CollectForm({ fkey, inst, patientId }) {
    const fd = formData[fkey] || {}
    return (
      <div style={{ background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: '8px', padding: '12px', marginTop: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '10px' }}>Tahsilat girişi</div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Tahsilat kanalı</label>
          <select value={fd.channel || 'elitenova'} onChange={e => setFormData(p => ({ ...p, [fkey]: { ...p[fkey], channel: e.target.value } }))}
            style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }}>
            <option value="elitenova">Elitenova GmbH</option>
            <option value="swissmed">Swissmed</option>
          </select>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Ödeme yöntemi *</label>
          <select value={fd.method || ''} onChange={e => setFormData(p => ({ ...p, [fkey]: { ...p[fkey], method: e.target.value } }))}
            style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }}>
            <option value="">Seçin...</option>
            <option value="nakit">Nakit</option>
            <option value="havale">Havale</option>
            <option value="kredi_karti">Kredi kartı</option>
            <option value="diger">Diğer</option>
          </select>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Tutar & para birimi</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '6px' }}>
            <input type="number" value={fd.amount || ''} onChange={e => setFormData(p => ({ ...p, [fkey]: { ...p[fkey], amount: e.target.value } }))}
              style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }} />
            <select value={fd.currency || 'EUR'} onChange={e => setFormData(p => ({ ...p, [fkey]: { ...p[fkey], currency: e.target.value } }))}
              style={{ padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }}>
              {['EUR', 'USD', 'CHF', 'GBP', 'TRY'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Tarih</label>
          <input type="date" value={fd.date || ''} onChange={e => setFormData(p => ({ ...p, [fkey]: { ...p[fkey], date: e.target.value } }))}
            style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Not (opsiyonel)</label>
          <input type="text" value={fd.note || ''} onChange={e => setFormData(p => ({ ...p, [fkey]: { ...p[fkey], note: e.target.value } }))}
            style={{ width: '100%', padding: '7px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setOpenForms(p => ({ ...p, [fkey]: false }))}
            style={{ flex: 1, padding: '8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>İptal</button>
          <button onClick={() => saveCollection(fkey, inst.id, patientId)} disabled={saving[fkey]}
            style={{ flex: 2, padding: '8px', fontSize: '13px', fontWeight: '500', border: 'none', borderRadius: '6px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: saving[fkey] ? 0.6 : 1 }}>
            {saving[fkey] ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    )
  }

  function InstCard({ inst, patientId, ctx }) {
    const cols = collections[inst.id] || []
    const totalCol = cols.reduce((s, c) => s + Number(c.amount_eur), 0)
    const expected = Number(inst.expected_amount_eur)
    const isPaid = totalCol >= expected - 0.01
    const isOverdue = inst.due_date < new Date().toISOString().split('T')[0]
    const fkey = `${ctx}_${inst.id}`
    const sale = inst.sales || {}
    const salesperson = sale.users?.full_name || '—'
    const agency = sale.users?.agencies?.name || '—'

    return (
      <div style={{ border: isOverdue && !isPaid ? '1px solid #ffcdd2' : '1px solid #eee', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', background: isOverdue && !isPaid ? '#fff8f8' : 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>{inst.sequence_no}. taksit · {inst.collection_channel === 'elitenova' ? 'Elitenova' : 'Swissmed'}</span>
          <span style={{ fontSize: '14px', fontWeight: '500', color: isPaid ? '#2e7d32' : isOverdue ? '#c62828' : '#1a1a1a' }}>
            {fmt(expected)} EUR
          </span>
        </div>
        <div style={{ fontSize: '11px', color: isOverdue && !isPaid ? '#c62828' : '#888', marginBottom: '6px', fontWeight: isOverdue && !isPaid ? '500' : '400' }}>
          Vade: {inst.due_date}{isOverdue && !isPaid ? ' — VADESİ GEÇTİ' : ''}
        </div>
        {/* Satışçı bilgisi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: '#f5f5f5', borderRadius: '6px', marginBottom: '6px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#e3f2fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '500', color: '#1565c0', flexShrink: 0 }}>
            {salesperson.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <span style={{ fontSize: '11px', color: '#888' }}>Satışçı: <strong style={{ color: '#333' }}>{salesperson}</strong> · {agency}</span>
        </div>
        {/* Ödeme geçmişi */}
        {cols.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <div style={{ height: '4px', background: '#eee', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
              <div style={{ height: '100%', width: Math.min(100, totalCol / expected * 100) + '%', background: isPaid ? '#4caf50' : '#ff9800', borderRadius: '2px' }} />
            </div>
            {cols.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', padding: '1px 0' }}>
                <span>{METHODS[c.method]} · {c.collection_date}</span>
                <span>{fmt(c.amount)} {c.currency}</span>
              </div>
            ))}
          </div>
        )}
        {isPaid ? (
          <div style={{ fontSize: '11px', color: '#2e7d32', fontWeight: '500' }}>✓ Tahsil edildi</div>
        ) : (
          <>
            <button onClick={() => toggleForm(fkey, inst, patientId)}
              style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '500', border: 'none', borderRadius: '6px', background: '#1a1a1a', color: 'white', cursor: 'pointer', marginTop: '4px' }}>
              {openForms[fkey] ? 'İptal' : '+ Ödeme ekle'}
            </button>
            {openForms[fkey] && <CollectForm fkey={fkey} inst={inst} patientId={patientId} />}
          </>
        )}
      </div>
    )
  }

  function PatientCard({ patient, insts, ctx }) {
    const key = `${ctx}_${patient.id}`
    const pendingCount = insts.filter(i => {
      const total = (collections[i.id] || []).reduce((s, c) => s + Number(c.amount_eur), 0)
      return total < Number(i.expected_amount_eur) - 0.01
    }).length
    return (
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 13px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => toggleCard(key)}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', color: '#555', flexShrink: 0 }}>
            {patient.first_name?.[0]}{patient.last_name?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>{patient.first_name} {patient.last_name}</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>{patient.patient_code} · {patient.phone}</div>
          </div>
          {pendingCount > 0 && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: '#fff3e0', color: '#e65100', fontWeight: '500' }}>{pendingCount} bekleyen</span>}
          <span style={{ color: '#888', fontSize: '12px' }}>{openCards[key] ? '▲' : '▼'}</span>
        </div>
        {openCards[key] && (
          <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
            {insts.map(inst => <InstCard key={inst.id} inst={inst} patientId={patient.id} ctx={ctx} />)}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      {toast && <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#2e7d32', marginBottom: '1rem' }}>{toast}</div>}

      {/* METRİKLER */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Bugün — {new Date().toLocaleDateString('tr-TR')}</div>
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: metrics.todayExp - metrics.todayCol > 0 ? '10px' : '0' }}>
            {[
              { label: 'Beklenen tahsilat', val: fmt(metrics.todayExp) + ' EUR' },
              { label: 'Gerçekleşen tahsilat', val: fmt(metrics.todayCol) + ' EUR', ok: true },
              { label: 'Kalan tahsilat', val: fmt(metrics.todayExp - metrics.todayCol) + ' EUR', warn: true },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>{m.label}</div>
                <div style={{ fontSize: '15px', fontWeight: '500', color: m.ok ? '#2e7d32' : m.warn && metrics.todayExp - metrics.todayCol > 0 ? '#f57f17' : '#1a1a1a' }}>{m.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>{new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</div>
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>Bu ay beklenen tahsilat</div><div style={{ fontSize: '15px', fontWeight: '500' }}>{fmt(metrics.monthExp)} EUR</div></div>
            <div><div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>Bu ay gerçekleşen tahsilat</div><div style={{ fontSize: '15px', fontWeight: '500', color: '#2e7d32' }}>{fmt(metrics.monthCol)} EUR</div></div>
          </div>
        </div>
      </div>

      {/* VADESİ GEÇMİŞ */}
      {overdueList.length > 0 && (
        <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '10px', padding: '10px 14px', marginBottom: '1rem', cursor: 'pointer' }}
          onClick={() => toggleCard('overdue_section')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#c62828' }}>{overdueList.length} vadesi geçmiş taksit</div>
              <div style={{ fontSize: '11px', color: '#c62828', marginTop: '2px' }}>Toplam {fmt(overdueList.reduce((s, i) => s + Number(i.expected_amount_eur), 0))} EUR</div>
            </div>
            <span style={{ color: '#c62828' }}>{openCards['overdue_section'] ? '▲' : '▼'}</span>
          </div>
        </div>
      )}

      {openCards['overdue_section'] && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Vadesi geçmiş taksitler</div>
          {overdueList.map(inst => {
            const sale = inst.sales || {}
            const patient = sale.patients || {}
            return <PatientCard key={inst.id} patient={patient} insts={[inst]} ctx="overdue" />
          })}
        </div>
      )}

      {/* BUGÜN VADESİ GELENLER */}
      {todayList.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Bugün vadesi gelen taksitler</div>
          {todayList.map(inst => {
            const sale = inst.sales || {}
            const patient = sale.patients || {}
            return <PatientCard key={inst.id} patient={patient} insts={[inst]} ctx="today" />
          })}
        </div>
      )}

      {/* HASTA ARA */}
      <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Hasta ara & tahsilat gir</div>
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); doSearch(e.target.value) }}
          placeholder="Hasta adı veya kodu..."
          style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
      </div>

      {search.length >= 2 && searchResults === null && <div style={{ color: '#888', fontSize: '13px' }}>Aranıyor...</div>}
      {searchResults && searchResults.length === 0 && <div style={{ color: '#888', fontSize: '13px' }}>Sonuç bulunamadı</div>}
      {searchResults && searchResults.map(patient => {
        const allInsts = (patient.sales || []).flatMap(s => (s.installments || []).map(i => ({ ...i, sales: s })))
        return <PatientCard key={patient.id} patient={patient} insts={allInsts} ctx="search" />
      })}
    </div>
  )
}