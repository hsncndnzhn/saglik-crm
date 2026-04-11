import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const fmt = n => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })
const FX = { EUR: 1, USD: 0.92, CHF: 1.04, GBP: 1.17, TRY: 0.028 }

export default function SatisDuzenle({ profile, onClose }) {
  const [step, setStep] = useState(1) // 1: liste, 2: özet, 3: düzenle, 4: önizleme
  const [sales, setSales] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Düzenleme state
  const [editInsts, setEditInsts] = useState([])
  const [editPrice, setEditPrice] = useState('')
  const [editCurrency, setEditCurrency] = useState('EUR')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadSales() }, [])

  async function loadSales() {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select(`
        id, sale_code, sale_price, sale_price_eur, currency, status, created_at, sale_date,
        total_list_price_eur, total_min_price_eur,
        patients(id, patient_code, first_name, last_name),
        sale_items(id, quantity, unit_list_price_eur, unit_min_price_eur, total_list_price_eur, total_min_price_eur, planned_date, planned_month,
          treatments(name)),
        sale_services(accommodation_type, nights, airport_transfer, clinic_hotel_transfer, total_services_eur),
        installments(id, sequence_no, due_date, amount, currency, amount_eur, collection_channel, expected_amount_eur)
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setSales(data || [])
    setLoading(false)
  }

  function selectSale(sale) {
    setSelected(sale)
    setEditPrice(sale.sale_price)
    setEditCurrency(sale.currency)
    setEditInsts((sale.installments || []).map(i => ({ ...i })))
    setReason('')
    setStep(2)
  }

  const filtered = sales.filter(s => {
    if (!search) return true
    const q = search.toLocaleLowerCase('tr')
    const p = s.patients
    return (p?.first_name + ' ' + p?.last_name).toLocaleLowerCase('tr').includes(q) ||
      s.sale_code?.toLocaleLowerCase('tr').includes(q)
  })

  const editPriceEur = (parseFloat(editPrice) || 0) * (FX[editCurrency] || 1)
  const instTotal = editInsts.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (FX[i.currency] || 1), 0)

  // Değişiklikleri hesapla
  function buildDiffs() {
    if (!selected) return []
    const diffs = []
    if (parseFloat(editPrice) !== parseFloat(selected.sale_price) || editCurrency !== selected.currency) {
      diffs.push({ field: 'Satış fiyatı', old: `${fmt(selected.sale_price)} ${selected.currency}`, new: `${fmt(editPrice)} ${editCurrency}` })
    }
    const origInsts = selected.installments || []
    editInsts.forEach((inst, i) => {
      const orig = origInsts[i]
      if (!orig) return
      if (parseFloat(inst.amount) !== parseFloat(orig.amount) || inst.currency !== orig.currency) {
        diffs.push({ field: `${i + 1}. taksit tutarı`, old: `${fmt(orig.amount)} ${orig.currency}`, new: `${fmt(inst.amount)} ${inst.currency}` })
      }
      if (inst.due_date !== orig.due_date) {
        diffs.push({ field: `${i + 1}. taksit vadesi`, old: orig.due_date, new: inst.due_date })
      }
      if (inst.collection_channel !== orig.collection_channel) {
        diffs.push({ field: `${i + 1}. taksit kanalı`, old: orig.collection_channel, new: inst.collection_channel })
      }
    })
    return diffs
  }

  async function submitRevision() {
    setSaving(true)
    setError('')
    const diffs = buildDiffs()
    try {
      await supabase.from('approval_queue').insert({
        type: 'satis_revizyonu',
        reference_id: selected.id,
        reference_type: 'sale',
        submitted_by: profile.id,
        submitter_note: reason,
        changes_summary: diffs,
        status: 'bekliyor',
      })
      onClose(true)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const statusLabel = { onaylandi: 'Onaylı', bekliyor: 'Onay Bekliyor', taslak: 'Taslak' }
  const statusColor = { onaylandi: '#2e7d32', bekliyor: '#e65100', taslak: '#888' }
  const statusBg = { onaylandi: '#e8f5e9', bekliyor: '#fff3e0', taslak: '#f5f5f5' }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  // ADIM 1: SATIŞ LİSTESİ
  if (step === 1) return (
    <div>
      <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>Satış düzenle</div>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '1rem' }}>Düzenlemek istediğiniz satışı seçin</div>
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Hasta adı veya satış kodu..."
          style={{ width: '100%', padding: '9px 12px 9px 36px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
      </div>
      {filtered.map(sale => {
        const p = sale.patients
        return (
          <div key={sale.id} onClick={() => selectSale(sale)}
            style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '500', color: '#555', flexShrink: 0 }}>
                {p?.first_name?.[0]}{p?.last_name?.[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>{p?.first_name} {p?.last_name}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{sale.sale_code} · {sale.sale_date || sale.created_at?.slice(0, 10)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>{fmt(sale.sale_price)} {sale.currency}</div>
                <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: statusBg[sale.status], color: statusColor[sale.status], fontWeight: '500' }}>
                  {statusLabel[sale.status]}
                </span>
              </div>
            </div>
          </div>
        )
      })}
      {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '2rem' }}>Satış bulunamadı</div>}
    </div>
  )

  // ADIM 2: MEVCUT ÖZET
  if (step === 2 && selected) {
    const p = selected.patients
    const ss = selected.sale_services?.[0]
    return (
      <div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.25rem' }}>
          {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= 1 ? '#f57f17' : '#eee' }} />)}
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '1.25rem' }}>Adım 1/3 — <strong style={{ color: '#1a1a1a' }}>Mevcut satış özeti</strong></div>
        <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{p?.first_name} {p?.last_name} — {selected.sale_code}</div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '1rem' }}>{selected.sale_date || selected.created_at?.slice(0, 10)}</div>

        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Tedaviler</div>
          {(selected.sale_items || []).map((si, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span>{si.treatments?.name} × {si.quantity}</span>
              <span style={{ color: '#888' }}>{fmt(si.total_list_price_eur)} EUR</span>
            </div>
          ))}
        </div>

        {ss && (
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Ek hizmetler</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span style={{ color: '#888' }}>Konaklama</span><span>{ss.accommodation_type} · {ss.nights} gece</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span style={{ color: '#888' }}>Havalimanı transferi</span><span>{ss.airport_transfer === 0 ? 'Yok' : ss.airport_transfer === 1 ? 'Tek yön' : 'Gidiş-dönüş'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span style={{ color: '#888' }}>Toplam ek hizmet</span><span style={{ fontWeight: '500' }}>{fmt(ss.total_services_eur)} EUR</span>
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Fiyat & ödeme</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
            <span style={{ color: '#888' }}>Satış fiyatı</span><span style={{ fontWeight: '500' }}>{fmt(selected.sale_price)} {selected.currency}</span>
          </div>
          {(selected.installments || []).map((inst, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
              <span style={{ color: '#888' }}>{i + 1}. taksit · {inst.due_date}</span>
              <span>{fmt(inst.amount)} {inst.currency}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
          <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
          <button onClick={() => setStep(3)} style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#f57f17', color: 'white', cursor: 'pointer' }}>
            Düzenle
          </button>
        </div>
      </div>
    )
  }

  // ADIM 3: DÜZENLEME FORMU
  if (step === 3 && selected) return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.25rem' }}>
        {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= 2 ? '#f57f17' : '#eee' }} />)}
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '1.25rem' }}>Adım 2/3 — <strong style={{ color: '#1a1a1a' }}>Düzenleme</strong></div>

      {/* Satış fiyatı */}
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Satış fiyatı</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '8px' }}>
          <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
            style={{ padding: '8px 10px', fontSize: '14px', fontWeight: '500', border: '1px solid #ddd', borderRadius: '8px' }} />
          <select value={editCurrency} onChange={e => setEditCurrency(e.target.value)}
            style={{ padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }}>
            {['EUR', 'USD', 'CHF', 'GBP', 'TRY'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Taksitler */}
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Ödeme planı</div>
        <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 100px 80px 90px', gap: '6px', marginBottom: '4px' }}>
          {['', 'Kanal', 'Tarih', 'Tutar', 'Birim'].map((h, i) => <div key={i} style={{ fontSize: '11px', color: '#888' }}>{h}</div>)}
        </div>
        {editInsts.map((inst, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 100px 80px 90px', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>{i + 1}</div>
            <select value={inst.collection_channel} onChange={e => setEditInsts(prev => prev.map((x, j) => j === i ? { ...x, collection_channel: e.target.value } : x))}
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
              <option value="elitenova">Elitenova</option>
              <option value="swissmed">Swissmed</option>
            </select>
            <input type="date" value={inst.due_date} onChange={e => setEditInsts(prev => prev.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))}
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
            <input type="number" value={inst.amount} onChange={e => setEditInsts(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
            <select value={inst.currency} onChange={e => setEditInsts(prev => prev.map((x, j) => j === i ? { ...x, currency: e.target.value } : x))}
              style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
              {['EUR', 'USD', 'CHF', 'GBP', 'TRY'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888', borderTop: '1px solid #eee', paddingTop: '6px' }}>
          <span>Taksit toplamı</span>
          <span style={{ fontWeight: '500', color: Math.abs(instTotal - editPriceEur) > 10 ? '#e53935' : '#2e7d32' }}>{fmt(instTotal)} EUR</span>
        </div>
        {Math.abs(instTotal - editPriceEur) > 10 && (
          <div style={{ fontSize: '11px', color: '#e53935', marginTop: '4px' }}>Taksit toplamı satış fiyatıyla eşleşmiyor</div>
        )}
      </div>

      {/* Revize notu */}
      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
        <div style={{ fontSize: '12px', fontWeight: '500', color: '#f57f17', marginBottom: '6px' }}>Revize nedeni *</div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Değişikliğin nedenini açıklayın (zorunlu)"
          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ffe082', borderRadius: '6px', resize: 'none' }} />
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Bu not yöneticiye iletilecektir.</div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setStep(2)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
        <button onClick={() => setStep(4)} disabled={!reason.trim() || Math.abs(instTotal - editPriceEur) > 10}
          style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: (!reason.trim() || Math.abs(instTotal - editPriceEur) > 10) ? 0.4 : 1 }}>
          Değişiklikleri önizle
        </button>
      </div>
    </div>
  )

  // ADIM 4: ÖNİZLEME
  if (step === 4 && selected) {
    const diffs = buildDiffs()
    return (
      <div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.25rem' }}>
          {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: '#f57f17' }} />)}
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '1.25rem' }}>Adım 3/3 — <strong style={{ color: '#1a1a1a' }}>Değişiklikleri gözden geçir</strong></div>

        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#f57f17', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Değişiklikler ({diffs.length})</div>
          {diffs.length === 0 && <div style={{ fontSize: '13px', color: '#888' }}>Değişiklik yok</div>}
          {diffs.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '4px 0', borderBottom: i < diffs.length - 1 ? '1px solid #ffe082' : 'none' }}>
              <span style={{ flex: 1, color: '#555' }}>{d.field}</span>
              <span style={{ color: '#aaa', textDecoration: 'line-through' }}>{d.old}</span>
              <span style={{ color: '#888' }}>→</span>
              <span style={{ color: '#f57f17', fontWeight: '500' }}>{d.new}</span>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '6px' }}>Revize nedeni</div>
          <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.6' }}>{reason}</div>
        </div>

        {error && <div style={{ background: '#ffebee', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#c62828', marginBottom: '8px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setStep(3)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
          <button onClick={submitRevision} disabled={saving || diffs.length === 0}
            style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#f57f17', color: 'white', cursor: 'pointer', opacity: (saving || diffs.length === 0) ? 0.6 : 1 }}>
            {saving ? 'Gönderiliyor...' : 'Onaya gönder'}
          </button>
        </div>
      </div>
    )
  }

  return null
}