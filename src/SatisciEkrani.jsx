import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const fmt = n => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })

export default function SatisciEkrani({ profile }) {
  const [metrics, setMetrics] = useState({ todaySales: 0, todaySaleCount: 0, todayExpected: 0, todayCollected: 0, todayRemaining: 0, monthSales: 0, monthExpected: 0, monthCollected: 0, monthTarget: 0, commission: 0, commissionRate: 0 })
  const [patientRows, setPatientRows] = useState([])
  const [recentSales, setRecentSales] = useState([])
  const [overdueInsts, setOverdueInsts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const currentPeriod = today.slice(0, 7)

    // Kullanıcı prim oranı
    const { data: userData } = await supabase
      .from('users')
      .select('commission_rate')
      .eq('id', profile.id)
      .single()

    const commissionRate = Number(userData?.commission_rate || 0)

    // Bu kullanıcının satışları
    const { data: salesData } = await supabase
  .from('sales')
  .select('id, sale_code, sale_price_eur, sale_date, created_at, status, patient_id, patients(id, patient_code, first_name, last_name)')
  .eq('user_id', profile.id)
  .order('created_at', { ascending: false })

    // Taksitler
    const saleIds = (salesData || []).map(s => s.id)
    let instData = []
    if (saleIds.length > 0) {
      const { data } = await supabase
        .from('installments')
        .select('id, sale_id, expected_amount_eur, due_date, collection_channel')
        .in('sale_id', saleIds)
      instData = data || []
    }

    // Tahsilatlar
    let colData = []
    if (instData.length > 0) {
      const instIds = instData.map(i => i.id)
      const { data } = await supabase
        .from('collections')
        .select('installment_id, amount_eur')
        .in('installment_id', instIds)
        .neq('status', 'rejected')
      colData = data || []
    }

    // Tahsilat map
    const colMap = {}
    colData.forEach(c => {
      colMap[c.installment_id] = (colMap[c.installment_id] || 0) + Number(c.amount_eur)
    })

    // Satış hedefi
    const { data: targetData } = await supabase
      .from('sales_targets')
      .select('target_eur')
      .eq('period', currentPeriod)
      .eq('user_id', profile.id)
      .single()

    const monthTarget = Number(targetData?.target_eur || 0)

    // Bugün metrikleri
    const todaySales = (salesData || []).filter(s => (s.sale_date || s.created_at?.slice(0, 10)) === today)
    const todaySalesAmt = todaySales.reduce((s, x) => s + Number(x.sale_price_eur || 0), 0)
    const todayInsts = instData.filter(i => i.due_date === today)
    const todayExpected = todayInsts.reduce((s, i) => s + Number(i.expected_amount_eur), 0)
    const todayCollected = todayInsts.reduce((s, i) => s + (colMap[i.id] || 0), 0)

    // Bu ay metrikleri
    const monthSales = (salesData || []).filter(s => (s.sale_date || s.created_at?.slice(0, 10)) >= monthStart)
    const monthSalesAmt = monthSales.reduce((s, x) => s + Number(x.sale_price_eur || 0), 0)
    const monthInsts = instData.filter(i => i.due_date >= monthStart && i.due_date <= today.slice(0, 7) + '-31')
    const monthExpected = monthInsts.reduce((s, i) => s + Number(i.expected_amount_eur), 0)
    const monthCollected = monthInsts.reduce((s, i) => s + (colMap[i.id] || 0), 0)

    // Prim (ek hizmet düşülmüş tahsilat bazlı — basit hesap)
    const commission = monthCollected * commissionRate

    // Vadesi geçmiş
    const overdue = instData.filter(i => i.due_date < today && (colMap[i.id] || 0) < Number(i.expected_amount_eur))

    // Hasta bazlı tahsilat tablosu (bu ay)
    const patientMap = {}
    ;(salesData || []).forEach(sale => {
      const p = sale.patients
      if (!p) return
      const key = p.id
      if (!patientMap[key]) patientMap[key] = { name: p.first_name + ' ' + p.last_name, code: p.patient_code, expected: 0, collected: 0 }
      const saleInsts = instData.filter(i => i.sale_id === sale.id && i.due_date >= monthStart && i.due_date <= today.slice(0, 7) + '-31')
      saleInsts.forEach(i => {
        patientMap[key].expected += Number(i.expected_amount_eur)
        patientMap[key].collected += colMap[i.id] || 0
      })
    })
    const patientRows = Object.values(patientMap).filter(r => r.expected > 0)

    setMetrics({ todaySales: todaySalesAmt, todaySaleCount: todaySales.length, todayExpected, todayCollected, todayRemaining: todayExpected - todayCollected, monthSales: monthSalesAmt, monthExpected, monthCollected, monthTarget, commission, commissionRate })
    setPatientRows(patientRows)
    setRecentSales((salesData || []).slice(0, 5))
    setOverdueInsts(overdue)
    setLoading(false)
  }

  const monthSalesPct = metrics.monthTarget > 0 ? Math.min(100, Math.round(metrics.monthSales / metrics.monthTarget * 100)) : 0
  const monthColPct = metrics.monthExpected > 0 ? Math.min(100, Math.round(metrics.monthCollected / metrics.monthExpected * 100)) : 0

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div>
      {/* BUGÜN */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Bugün — {new Date().toLocaleDateString('tr-TR')}
        </div>
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { label: 'Bugünkü satış', val: fmt(metrics.todaySales) + ' EUR', sub: metrics.todaySaleCount + ' satış' },
              { label: 'Beklenen tahsilat', val: fmt(metrics.todayExpected) + ' EUR' },
              { label: 'Gerçekleşen tahsilat', val: fmt(metrics.todayCollected) + ' EUR', ok: true },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>{m.label}</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: m.ok ? '#2e7d32' : '#1a1a1a' }}>{m.val}</div>
                {m.sub && <div style={{ fontSize: '11px', color: '#888' }}>{m.sub}</div>}
              </div>
            ))}
          </div>
          {metrics.todayRemaining > 0 && (
            <div style={{ background: '#fff8e1', borderRadius: '8px', padding: '7px 10px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#f57f17' }}>Bugün kalan tahsilat</span>
              <span style={{ color: '#f57f17', fontWeight: '500' }}>{fmt(metrics.todayRemaining)} EUR</span>
            </div>
          )}
        </div>
      </div>

      {/* VADESİ GEÇMİŞ */}
      {overdueInsts.length > 0 && (
        <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '10px', padding: '12px 14px', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#c62828', marginBottom: '4px' }}>
            {overdueInsts.length} vadesi geçmiş taksit
          </div>
          <div style={{ fontSize: '12px', color: '#c62828' }}>
            Toplam {fmt(overdueInsts.reduce((s, i) => s + Number(i.expected_amount_eur), 0))} EUR — tahsilat yapılmadı veya revize edilmedi
          </div>
        </div>
      )}

      {/* AYLIK HEDEFLER */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} — Hedefler
        </div>
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px' }}>
          {/* Satış hedefi */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#888' }}>Aylık satış hedefi</span>
              <span style={{ fontWeight: '500' }}>{fmt(metrics.monthSales)} / {fmt(metrics.monthTarget)} EUR</span>
            </div>
            <div style={{ height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: monthSalesPct + '%', background: '#1a1a1a', borderRadius: '3px' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>%{monthSalesPct} tamamlandı</div>
          </div>
          {/* Tahsilat hedefi */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#888' }}>Aylık tahsilat hedefi</span>
              <span style={{ fontWeight: '500' }}>{fmt(metrics.monthCollected)} / {fmt(metrics.monthExpected)} EUR</span>
            </div>
            <div style={{ height: '5px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: monthColPct + '%', background: '#2e7d32', borderRadius: '3px' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>Aylık tahsilat hedefinin %{monthColPct}'ı tamamlandı · Hedef = bu aya adresli taksit toplamı</div>
          </div>
          {/* Prim */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Tahmini prim</span>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#2e7d32' }}>{fmt(metrics.commission)} EUR</span>
          </div>
        </div>
      </div>

      {/* HASTA BAZLI TAHSİLAT */}
      {patientRows.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Bu ay — hasta bazlı tahsilat
          </div>
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Hasta</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Beklenen</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Gerçekleşen</th>
                </tr>
              </thead>
              <tbody>
                {patientRows.map((r, i) => (
                  <tr key={r.code} style={{ borderBottom: i < patientRows.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: '500' }}>{r.name}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{r.code}</div>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(r.expected)} EUR</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: r.collected >= r.expected ? '#2e7d32' : r.collected > 0 ? '#f57f17' : '#888', fontWeight: '500' }}>
                      {fmt(r.collected)} EUR
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid #eee', background: '#f9f9f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: '500', fontSize: '12px' }}>Toplam</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500' }}>{fmt(patientRows.reduce((s, r) => s + r.expected, 0))} EUR</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500', color: '#2e7d32' }}>{fmt(patientRows.reduce((s, r) => s + r.collected, 0))} EUR</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SON SATIŞLAR */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Son satışlar
        </div>
        {recentSales.length === 0 && (
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: '#888', fontSize: '13px' }}>
            Henüz satış yok
          </div>
        )}
        {recentSales.map(sale => {
          const p = sale.patients
          const statusColors = { onaylandi: { bg: '#e8f5e9', color: '#2e7d32', label: 'Onaylı' }, bekliyor: { bg: '#fff3e0', color: '#e65100', label: 'Onay Bekliyor' }, taslak: { bg: '#f5f5f5', color: '#888', label: 'Taslak' } }
          const sc = statusColors[sale.status] || statusColors.taslak
          return (
            <div key={sale.id} style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500', color: '#555', flexShrink: 0 }}>
                  {p?.first_name?.[0]}{p?.last_name?.[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{p?.first_name} {p?.last_name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{sale.sale_code} · {sale.sale_date || sale.created_at?.slice(0, 10)}</div>
                </div>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: sc.bg, color: sc.color, fontWeight: '500', flexShrink: 0 }}>
                  {sc.label}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: '500' }}>
                {fmt(sale.sale_price_eur)} EUR
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}