import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function SatisFormu({ profile, onClose }) {
  const [step, setStep] = useState(1)
  const [cats, setCats] = useState([])
  const [treatments, setTreatments] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [patient, setPatient] = useState({ first_name: '', last_name: '', phone: '', nationality: '', passport_no: '', address: '', referral_source_id: null })
  const [dupCheck, setDupCheck] = useState(null) // null | 'new' | existing patient
  const [selectedCats, setSelectedCats] = useState([])
  const [selectedTreats, setSelectedTreats] = useState({}) // {tid: qty}
  const [planDate, setPlanDate] = useState('')
  const [planMonth, setPlanMonth] = useState('')
  const [svc, setSvc] = useState({ acc: 'yok', nights: 1, apt: 0, ct: false })
  const [salePrice, setSalePrice] = useState('')
  const [saleCurrency, setSaleCurrency] = useState('EUR')
  const [insts, setInsts] = useState([{ channel: 'elitenova', date: '', amount: '', currency: 'EUR' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const FX = { EUR: 1, USD: 0.92, CHF: 1.04, GBP: 1.17, TRY: 0.028 }
  const fmt = n => Number(n || 0).toLocaleString('tr-TR')

  useEffect(() => { loadMasterData() }, [])

  async function loadMasterData() {
    const [{ data: c }, { data: t }, { data: s }] = await Promise.all([
      supabase.from('treatment_categories').select('*').order('display_order'),
      supabase.from('treatments').select('*').order('display_order'),
      supabase.from('services').select('*').order('display_order'),
    ])
    setCats(c || [])
    setTreatments(t || [])
    setServices(s || [])
    setLoading(false)
  }

  // Fiyat hesapları
  const selTreats = Object.entries(selectedTreats)
  const listTotal = selTreats.reduce((s, [tid, qty]) => {
    const t = treatments.find(x => x.id === +tid)
    return s + (t ? t.list_price_eur * qty : 0)
  }, 0)
  const minTotal = selTreats.reduce((s, [tid, qty]) => {
    const t = treatments.find(x => x.id === +tid)
    return s + (t ? t.min_price_eur * qty : 0)
  }, 0)
  const svcAcc = services.find(s => s.name.toLowerCase().includes(svc.acc === 'standart' ? 'standart' : svc.acc === '3yildiz' ? '3 yıldız' : svc.acc === '5yildiz' ? '5 yıldız' : 'xxx'))
  const svcTotal = (svc.acc !== 'yok' ? (svcAcc?.price_eur || 0) * svc.nights : 0) +
    (svc.apt === 1 ? 40 : svc.apt === 2 ? 80 : 0) +
    (svc.acc === '5yildiz' && svc.ct ? 20 * 2 * svc.nights : 0)
  const grandList = listTotal + svcTotal
  const grandMin = minTotal + svcTotal
  const salePriceEur = (parseFloat(salePrice) || 0) * (FX[saleCurrency] || 1)
  const instTotal = insts.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (FX[i.currency] || 1), 0)

  // Violations
  const violations = []
  if (salePrice && salePriceEur < grandMin) violations.push('K-1: Fiyat minimumun altında')
  if (insts.length === 2) {
    const d1 = new Date(insts[0].date), d2 = new Date(insts[1].date)
    if (!isNaN(d1) && !isNaN(d2) && (d2 - d1) / (1000 * 60 * 60 * 24 * 30) > 6) violations.push('K-3: Taksitler arası 6 aydan fazla')
  }
  if (insts.length > 2) violations.push('K-4: İkiden fazla taksit')

  const STEPS = ['Hasta', 'Kategoriler', 'Tedaviler', 'Ek Hizmetler', 'Fiyat', 'Ödeme', 'Özet']

  async function checkDup() {
    if (!patient.first_name || !patient.last_name) return
    const { data } = await supabase
      .from('patients')
      .select('id, patient_code, first_name, last_name, phone')
      .ilike('first_name', patient.first_name)
      .ilike('last_name', patient.last_name)
    setDupCheck(data?.length > 0 ? data : 'none')
  }

  async function saveSale() {
    setSaving(true)
    setError('')
    try {
      // Hasta kaydı
      let patientId
      if (dupCheck && dupCheck !== 'none' && typeof dupCheck === 'object') {
        patientId = dupCheck[0].id
      } else {
        const { data: newPat, error: patErr } = await supabase
          .from('patients')
          .insert({ ...patient })
          .select('id')
          .single()
        if (patErr) throw patErr
        patientId = newPat.id
      }

      // Satış kaydı
      const status = violations.length > 0 ? 'bekliyor' : 'onaylandi'
      const { data: newSale, error: saleErr } = await supabase
        .from('sales')
        .insert({
          patient_id: patientId,
          user_id: profile.id,
          agency_id: profile.agency_id,
          sale_price: parseFloat(salePrice),
          sale_price_eur: salePriceEur,
          total_list_price_eur: grandList,
          total_min_price_eur: grandMin,
          currency: saleCurrency,
          status,
          violations: violations.length > 0 ? violations : null,
        })
        .select('id')
        .single()
      if (saleErr) throw saleErr

      // Tedavi kalemleri
      const saleItems = selTreats.map(([tid, qty]) => {
        const t = treatments.find(x => x.id === +tid)
        return {
          sale_id: newSale.id,
          treatment_id: +tid,
          quantity: qty,
          unit_list_price_eur: t?.list_price_eur,
          unit_min_price_eur: t?.min_price_eur,
          total_list_price_eur: t ? t.list_price_eur * qty : 0,
          total_min_price_eur: t ? t.min_price_eur * qty : 0,
          planned_date: planDate || null,
          planned_month: planMonth || null,
        }
      })
      await supabase.from('sale_items').insert(saleItems)

      // Ek hizmetler
      await supabase.from('sale_services').insert({
        sale_id: newSale.id,
        accommodation_type: svc.acc,
        nights: svc.acc !== 'yok' ? svc.nights : 0,
        airport_transfer: svc.apt,
        clinic_hotel_transfer: svc.ct,
        accommodation_price_eur: svc.acc !== 'yok' ? (svcAcc?.price_eur || 0) * svc.nights : 0,
        airport_transfer_price_eur: svc.apt === 1 ? 40 : svc.apt === 2 ? 80 : 0,
        clinic_transfer_price_eur: svc.ct ? 20 * 2 * svc.nights : 0,
        total_services_eur: svcTotal,
      })

      // Taksitler
      const instRows = insts.map((ins, i) => ({
        sale_id: newSale.id,
        sequence_no: i + 1,
        due_date: ins.date,
        amount: parseFloat(ins.amount),
        currency: ins.currency,
        amount_eur: parseFloat(ins.amount) * (FX[ins.currency] || 1),
        collection_channel: ins.channel,
        expected_amount_eur: parseFloat(ins.amount) * (FX[ins.currency] || 1),
        original_amount_eur: parseFloat(ins.amount) * (FX[ins.currency] || 1),
      }))
      await supabase.from('installments').insert(instRows)

      // Onay kuyruğu (violations varsa)
      if (violations.length > 0) {
        await supabase.from('approval_queue').insert({
          type: 'onaysiz_satis',
          reference_id: newSale.id,
          reference_type: 'sale',
          submitted_by: profile.id,
          changes_summary: violations.map(v => ({ field: 'İhlal', old: '', new: v })),
        })
      }

      onClose(true)
    } catch (e) {
      setError(e.message || 'Bir hata oluştu.')
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '1rem 0' }}>
      {/* PROGRESS */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '1.25rem' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i + 1 < step ? '#2e7d32' : i + 1 === step ? '#1a1a1a' : '#eee' }} />
        ))}
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '1.5rem' }}>
        Adım {step}/7 — <strong style={{ color: '#1a1a1a' }}>{STEPS[step - 1]}</strong>
      </div>

      {/* ADIM 1: HASTA */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>Hasta bilgileri</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.25rem' }}>Ad ve soyad girilince mükerrer kontrol yapılır</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Ad *</label>
              <input value={patient.first_name} onChange={e => { setPatient(p => ({ ...p, first_name: e.target.value })); setDupCheck(null) }}
                onBlur={checkDup} placeholder="Ad"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Soyad *</label>
              <input value={patient.last_name} onChange={e => { setPatient(p => ({ ...p, last_name: e.target.value })); setDupCheck(null) }}
                onBlur={checkDup} placeholder="Soyad"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
            </div>
          </div>

          {dupCheck && dupCheck !== 'none' && Array.isArray(dupCheck) && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#f57f17', marginBottom: '8px' }}>Bu isimde mevcut hasta var</div>
              {dupCheck.map(p => (
                <div key={p.id} style={{ background: 'white', border: '1px solid #eee', borderRadius: '6px', padding: '8px 10px', marginBottom: '6px', fontSize: '13px' }}>
                  <strong>{p.first_name} {p.last_name}</strong> — {p.patient_code} · {p.phone}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setDupCheck('none')}
                  style={{ flex: 1, padding: '8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>
                  Yeni hasta olarak kaydet
                </button>
                <button onClick={() => setDupCheck(dupCheck)}
                  style={{ flex: 1, padding: '8px', fontSize: '12px', border: 'none', borderRadius: '6px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>
                  Mevcut hastaya ekle
                </button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Telefon *</label>
            <input value={patient.phone} onChange={e => setPatient(p => ({ ...p, phone: e.target.value }))} placeholder="+49 000 000 00 00"
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Uyruk</label>
              <input value={patient.nationality} onChange={e => setPatient(p => ({ ...p, nationality: e.target.value }))} placeholder="Almanya"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Pasaport / TC No</label>
              <input value={patient.passport_no} onChange={e => setPatient(p => ({ ...p, passport_no: e.target.value }))} placeholder="Daha sonra eklenebilir"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '4px' }}>Adres</label>
            <textarea value={patient.address} onChange={e => setPatient(p => ({ ...p, address: e.target.value }))} placeholder="Sokak, mahalle, şehir, ülke" rows={2}
              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', resize: 'none' }} />
          </div>
          <button onClick={() => setStep(2)} disabled={!patient.first_name || !patient.last_name || !patient.phone}
            style={{ width: '100%', padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: (!patient.first_name || !patient.last_name || !patient.phone) ? 0.4 : 1 }}>
            Devam et
          </button>
        </div>
      )}

      {/* ADIM 2: KATEGORİLER */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>Tedavi kategorileri</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.25rem' }}>Birden fazla seçebilirsiniz</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.5rem' }}>
            {cats.map(c => (
              <button key={c.id} onClick={() => setSelectedCats(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                style={{ padding: '16px 14px', border: selectedCats.includes(c.id) ? '2px solid #1a1a1a' : '1px solid #ddd', borderRadius: '10px', background: selectedCats.includes(c.id) ? '#f0f0f0' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{treatments.filter(t => t.category_id === c.id).length} seçenek</div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
            <button onClick={() => setStep(3)} disabled={selectedCats.length === 0}
              style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: selectedCats.length === 0 ? 0.4 : 1 }}>
              Devam et
            </button>
          </div>
        </div>
      )}

      {/* ADIM 3: TEDAVİLER */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>Tedavi seçimi</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.25rem' }}>Tedavileri seçin ve adet girin</div>
          {cats.filter(c => selectedCats.includes(c.id)).map(c => (
            <div key={c.id} style={{ marginBottom: '1rem' }}>
              <div style={{ background: '#e3f2fd', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: '#1565c0' }}>{c.name}</div>
              {treatments.filter(t => t.category_id === c.id).map(t => {
                const sel = !!selectedTreats[t.id]
                const qty = selectedTreats[t.id] || t.min_qty
                return (
                  <div key={t.id} onClick={() => setSelectedTreats(prev => {
                    const n = { ...prev }
                    if (n[t.id]) delete n[t.id]; else n[t.id] = t.min_qty
                    return n
                  })} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: sel ? '1px solid #4caf50' : '1px solid #eee', borderRadius: '8px', marginBottom: '6px', background: sel ? '#f1f8e9' : 'white', cursor: 'pointer' }}>
                    <div style={{ width: '18px', height: '18px', border: sel ? 'none' : '1.5px solid #ddd', borderRadius: '4px', background: sel ? '#4caf50' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>Liste: {fmt(t.list_price_eur)} EUR · Min: {fmt(t.min_price_eur)} EUR</div>
                    </div>
                    {sel && !t.qty_fixed && (
                      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => setSelectedTreats(p => ({ ...p, [t.id]: Math.max(t.min_qty, qty - 1) }))}
                          style={{ width: '26px', height: '26px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>−</button>
                        <span style={{ fontSize: '13px', fontWeight: '500', minWidth: '22px', textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => setSelectedTreats(p => ({ ...p, [t.id]: Math.min(t.max_qty, qty + 1) }))}
                          style={{ width: '26px', height: '26px', border: '1px solid #ddd', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>+</button>
                      </div>
                    )}
                    {sel && t.qty_fixed && <span style={{ fontSize: '11px', color: '#888' }}>1 adet</span>}
                  </div>
                )
              })}
            </div>
          ))}
          {Object.keys(selectedTreats).length > 0 && (
            <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '8px' }}>Tedavi başlangıç tarihi</div>
              <input type="date" value={planDate} onChange={e => { setPlanDate(e.target.value); setPlanMonth('') }}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '6px' }} />
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', textAlign: 'center' }}>— veya tahmini ay —</div>
              <input type="month" value={planMonth} onChange={e => { setPlanMonth(e.target.value); setPlanDate('') }}
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
            <button onClick={() => setStep(4)} disabled={Object.keys(selectedTreats).length === 0 || (!planDate && !planMonth)}
              style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: (Object.keys(selectedTreats).length === 0 || (!planDate && !planMonth)) ? 0.4 : 1 }}>
              Devam et
            </button>
          </div>
        </div>
      )}

      {/* ADIM 4: EK HİZMETLER */}
      {step === 4 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '1.25rem' }}>Ek hizmetler</div>
          {/* Konaklama */}
          <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>Konaklama</div>
          {[{ val: 'yok', label: 'Konaklama dahil değil', price: '' }, { val: 'standart', label: 'Standart otel', price: '50 EUR / gece' }, { val: '3yildiz', label: '3 Yıldızlı otel', price: '80 EUR / gece' }, { val: '5yildiz', label: '5 Yıldızlı otel', price: '120 EUR / gece' }].map(o => (
            <div key={o.val} onClick={() => setSvc(s => ({ ...s, acc: o.val, ct: o.val !== '5yildiz' ? false : s.ct }))}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: svc.acc === o.val ? '1px solid #1a1a1a' : '1px solid #eee', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', background: svc.acc === o.val ? '#f5f5f5' : 'white' }}>
              <div style={{ width: '16px', height: '16px', border: svc.acc === o.val ? 'none' : '1.5px solid #ddd', borderRadius: '50%', background: svc.acc === o.val ? '#1a1a1a' : 'white', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '13px' }}>{o.label}</div>
              {o.price && <div style={{ fontSize: '11px', color: '#888' }}>{o.price}</div>}
            </div>
          ))}
          {svc.acc !== 'yok' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#888', flex: 1 }}>Kaç gece?</span>
              <input type="number" min="1" value={svc.nights} onChange={e => setSvc(s => ({ ...s, nights: +e.target.value || 1 }))}
                style={{ width: '60px', padding: '5px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', textAlign: 'center' }} />
            </div>
          )}
          {/* Havalimanı transferi */}
          <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px', marginTop: '10px' }}>Havalimanı transferi</div>
          {[{ val: 0, label: 'Transfer dahil değil' }, { val: 1, label: 'Tek yön', price: '40 EUR' }, { val: 2, label: 'Gidiş-dönüş', price: '80 EUR' }].map(o => (
            <div key={o.val} onClick={() => setSvc(s => ({ ...s, apt: o.val }))}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: svc.apt === o.val ? '1px solid #1a1a1a' : '1px solid #eee', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', background: svc.apt === o.val ? '#f5f5f5' : 'white' }}>
              <div style={{ width: '16px', height: '16px', border: svc.apt === o.val ? 'none' : '1.5px solid #ddd', borderRadius: '50%', background: svc.apt === o.val ? '#1a1a1a' : 'white', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '13px' }}>{o.label}</div>
              {o.price && <div style={{ fontSize: '11px', color: '#888' }}>{o.price}</div>}
            </div>
          ))}
          {/* Klinik-otel transferi (sadece 5 yıldız) */}
          {svc.acc === '5yildiz' && (
            <>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '6px', marginTop: '10px' }}>Klinik – otel arası transfer</div>
              {[{ val: false, label: 'Hayır' }, { val: true, label: 'Evet', price: '20 EUR / yön · her gece 2 yön' }].map(o => (
                <div key={String(o.val)} onClick={() => setSvc(s => ({ ...s, ct: o.val }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: svc.ct === o.val ? '1px solid #1a1a1a' : '1px solid #eee', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', background: svc.ct === o.val ? '#f5f5f5' : 'white' }}>
                  <div style={{ width: '16px', height: '16px', border: svc.ct === o.val ? 'none' : '1.5px solid #ddd', borderRadius: '50%', background: svc.ct === o.val ? '#1a1a1a' : 'white', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '13px' }}>{o.label}</div>
                  {o.price && <div style={{ fontSize: '11px', color: '#888' }}>{o.price}</div>}
                </div>
              ))}
            </>
          )}
          <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', marginTop: '6px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '13px', color: '#888' }}>Ek hizmetler toplamı</span>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>{fmt(svcTotal)} EUR</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(3)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
            <button onClick={() => setStep(5)} style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer' }}>Devam et</button>
          </div>
        </div>
      )}

      {/* ADIM 5: FİYAT */}
      {step === 5 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '1.25rem' }}>Fiyatlandırma</div>
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Kalem</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Liste</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Min</th>
                </tr>
              </thead>
              <tbody>
                {selTreats.map(([tid, qty]) => {
                  const t = treatments.find(x => x.id === +tid)
                  if (!t) return null
                  return (
                    <tr key={tid}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5' }}>{t.name} × {qty}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f5f5f5' }}>{fmt(t.list_price_eur * qty)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f5f5f5', color: '#e65100' }}>{fmt(t.min_price_eur * qty)}</td>
                    </tr>
                  )
                })}
                {svcTotal > 0 && (
                  <tr>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f5f5f5', color: '#888', fontSize: '12px' }}>Ek hizmetler</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f5f5f5', fontSize: '12px' }}>{fmt(svcTotal)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f5f5f5', fontSize: '12px' }}>{fmt(svcTotal)}</td>
                  </tr>
                )}
                <tr style={{ background: '#f9f9f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: '500' }}>Toplam</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500' }}>{fmt(grandList)} EUR</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#e65100' }}>{fmt(grandMin)} EUR</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '12px', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Satış fiyatı</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '8px' }}>
              <input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0.00"
                style={{ padding: '8px 10px', fontSize: '14px', fontWeight: '500', border: '1px solid #ddd', borderRadius: '8px' }} />
              <select value={saleCurrency} onChange={e => setSaleCurrency(e.target.value)}
                style={{ padding: '8px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px' }}>
                {['EUR', 'USD', 'CHF', 'GBP', 'TRY'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {saleCurrency !== 'EUR' && salePrice && (
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>≈ {fmt(salePriceEur)} EUR</div>
            )}
          </div>
          {salePrice && salePriceEur < grandMin && (
            <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#f57f17', marginBottom: '6px' }}>
              Fiyat minimumun altında — bu satış onay bekleyecek.
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
            <button onClick={() => setStep(4)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
            <button onClick={() => setStep(6)} disabled={!salePrice}
              style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: !salePrice ? 0.4 : 1 }}>
              Devam et
            </button>
          </div>
        </div>
      )}

      {/* ADIM 6: ÖDEME PLANI */}
      {step === 6 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>Ödeme planı</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.25rem' }}>Maks. 12 taksit</div>
          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 100px 80px 90px', gap: '6px', marginBottom: '4px' }}>
            {['', 'Kanal', 'Tarih', 'Tutar', 'Birim'].map((h, i) => (
              <div key={i} style={{ fontSize: '11px', color: '#888' }}>{h}</div>
            ))}
          </div>
          {insts.map((ins, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 100px 80px 90px', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>{i + 1}</div>
              <select value={ins.channel} onChange={e => setInsts(prev => prev.map((x, j) => j === i ? { ...x, channel: e.target.value } : x))}
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
                <option value="elitenova">Elitenova</option>
                <option value="swissmed">Swissmed</option>
              </select>
              <input type="date" value={ins.date} onChange={e => setInsts(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
              <input type="number" value={ins.amount} onChange={e => setInsts(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} placeholder="0"
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }} />
              <select value={ins.currency} onChange={e => setInsts(prev => prev.map((x, j) => j === i ? { ...x, currency: e.target.value } : x))}
                style={{ padding: '6px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
                {['EUR', 'USD', 'CHF', 'GBP', 'TRY'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderTop: '1px solid #eee', marginBottom: '6px' }}>
            <span style={{ color: '#888' }}>Taksit toplamı</span>
            <span style={{ fontWeight: '500' }}>{fmt(instTotal)} EUR</span>
          </div>
          {Math.abs(instTotal - salePriceEur) > 10 && instTotal > 0 && (
            <div style={{ fontSize: '12px', color: '#e53935', marginBottom: '8px' }}>
              Taksit toplamı ile satış fiyatı arasında {fmt(Math.abs(instTotal - salePriceEur))} EUR fark var.
            </div>
          )}
          {insts.length < 12 && (
            <button onClick={() => setInsts(prev => [...prev, { channel: 'elitenova', date: '', amount: '', currency: 'EUR' }])}
              style={{ width: '100%', padding: '8px', fontSize: '12px', border: '1px dashed #ddd', borderRadius: '8px', background: 'none', cursor: 'pointer', color: '#888', marginBottom: '1rem' }}>
              + Taksit ekle
            </button>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(5)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
            <button onClick={() => setStep(7)} disabled={!insts.every(i => i.date && i.amount) || Math.abs(instTotal - salePriceEur) > 10}
              style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: (!insts.every(i => i.date && i.amount) || Math.abs(instTotal - salePriceEur) > 10) ? 0.4 : 1 }}>
              Devam et
            </button>
          </div>
        </div>
      )}

      {/* ADIM 7: ÖZET */}
      {step === 7 && (
        <div>
          <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '1.25rem' }}>Özet ve onay</div>

          {violations.length > 0 && (
            <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '10px 12px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#c62828', marginBottom: '4px' }}>Onay gerektirecek durumlar</div>
              {violations.map(v => <div key={v} style={{ fontSize: '12px', color: '#c62828' }}>• {v}</div>)}
            </div>
          )}

          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Hasta</div>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>{patient.first_name} {patient.last_name}</div>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{patient.phone}</div>
          </div>

          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Tedaviler</div>
            {selTreats.map(([tid, qty]) => {
              const t = treatments.find(x => x.id === +tid)
              return <div key={tid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                <span>{t?.name} × {qty}</span>
                <span style={{ color: '#888' }}>{fmt(t ? t.list_price_eur * qty : 0)} EUR</span>
              </div>
            })}
          </div>

          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Fiyat</div>
            {[
              { label: 'Liste fiyatı', val: fmt(grandList) + ' EUR' },
              { label: 'Minimum fiyat', val: fmt(grandMin) + ' EUR' },
              { label: 'Satış fiyatı', val: fmt(salePrice) + ' ' + saleCurrency + (saleCurrency !== 'EUR' ? ` (≈ ${fmt(salePriceEur)} EUR)` : '') },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                <span style={{ color: '#888' }}>{r.label}</span><span style={{ fontWeight: '500' }}>{r.val}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px', marginBottom: '1rem' }}>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: '500', textTransform: 'uppercase', marginBottom: '8px' }}>Ödeme planı</div>
            {insts.map((ins, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                <span style={{ color: '#888' }}>{i + 1}. taksit · {ins.date} · {ins.channel}</span>
                <span style={{ fontWeight: '500' }}>{fmt(ins.amount)} {ins.currency}</span>
              </div>
            ))}
          </div>

          {error && <div style={{ background: '#ffebee', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#c62828', marginBottom: '8px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(6)} style={{ flex: 1, padding: '11px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white', cursor: 'pointer' }}>Geri</button>
            <button onClick={saveSale} disabled={saving}
              style={{ flex: 2, padding: '11px', fontSize: '14px', fontWeight: '500', border: 'none', borderRadius: '8px', background: violations.length > 0 ? '#f57f17' : '#1a1a1a', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Kaydediliyor...' : violations.length > 0 ? 'Onay bekleyerek kaydet' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}