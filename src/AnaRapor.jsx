import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const fmt = n => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })

export default function AnaRapor() {
  const [period, setPeriod] = useState('aylik')
  const [data, setData] = useState([])
  const [metrics, setMetrics] = useState({ sales: 0, expected: 0, collected: 0, overdue: 0, overdueCount: 0 })
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => { loadData() }, [period])

  async function loadData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'

    // Tüm kullanıcıları çek (satış olmasa da göster)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, role, agencies(id, name, countries(id, name))')
      .in('role', ['satis', 'acente'])

    // Satışlar
    const { data: salesData } = await supabase
      .from('sales')
      .select('id, total_price_eur, sale_date, created_at, user_id')
      .eq('status', 'onaylandi')

    // Taksitler
    const { data: instData } = await supabase
      .from('installments')
      .select('id, expected_amount_eur, due_date, sale_id')

    // Tahsilatlar
    const { data: colData } = await supabase
      .from('collections')
      .select('installment_id, amount_eur')
      .neq('status', 'rejected')

    // Tahsilat map
    const colMap = {}
    ;(colData || []).forEach(c => {
      colMap[c.installment_id] = (colMap[c.installment_id] || 0) + Number(c.amount_eur)
    })

    // Satış > taksit map
    const saleInstMap = {}
    ;(instData || []).forEach(i => {
      if (!saleInstMap[i.sale_id]) saleInstMap[i.sale_id] = []
      saleInstMap[i.sale_id].push(i)
    })

    // Vadesi geçmiş toplam
    const overdue = (instData || []).filter(i => i.due_date < today && (colMap[i.id] || 0) < Number(i.expected_amount_eur))
    const overdueAmt = overdue.reduce((s, i) => s + Number(i.expected_amount_eur) - (colMap[i.id] || 0), 0)

    // Bugün metrikleri
    const todayInst = (instData || []).filter(i => i.due_date === today)
    const todayExpected = todayInst.reduce((s, i) => s + Number(i.expected_amount_eur), 0)
    const todayCollected = todayInst.reduce((s, i) => s + (colMap[i.id] || 0), 0)

    // Dönem satış
    const filtered = (salesData || []).filter(s => {
      const d = s.sale_date || s.created_at?.slice(0, 10)
      return period === 'gunluk' ? d === today : d >= monthStart
    })
    const salesAmt = filtered.reduce((s, x) => s + Number(x.total_price_eur || 0), 0)

    setMetrics({ sales: salesAmt, expected: todayExpected, collected: todayCollected, overdue: overdueAmt, overdueCount: overdue.length })

    // Grupla: ülke > acente > satışçı (tüm kullanıcılar dahil)
    const grouped = {}
    ;(usersData || []).forEach(u => {
      const a = u.agencies
      const c = a?.countries
      const cName = c?.name || 'Bilinmiyor'
      const aName = a?.name || 'Bilinmiyor'
      const uName = u.full_name || 'Bilinmiyor'

      if (!grouped[cName]) grouped[cName] = {}
      if (!grouped[cName][aName]) grouped[cName][aName] = {}
      grouped[cName][aName][uName] = { sales: 0, saleCount: 0, expected: 0, collected: 0, overdue: 0 }
    })

    // Satış verilerini yerleştir
    ;(salesData || []).forEach(sale => {
      const u = (usersData || []).find(x => x.id === sale.user_id)
      if (!u) return
      const cName = u.agencies?.countries?.name || 'Bilinmiyor'
      const aName = u.agencies?.name || 'Bilinmiyor'
      const uName = u.full_name

      if (!grouped[cName]?.[aName]?.[uName]) return

      const d = sale.sale_date || sale.created_at?.slice(0, 10)
      const inPeriod = period === 'gunluk' ? d === today : d >= monthStart
      if (inPeriod) {
        grouped[cName][aName][uName].sales += Number(sale.total_price_eur || 0)
        grouped[cName][aName][uName].saleCount += 1
      }

      // Taksit/tahsilat
      const insts = saleInstMap[sale.id] || []
      insts.forEach(i => {
        const col = colMap[i.id] || 0
        const exp = Number(i.expected_amount_eur || 0)
        grouped[cName][aName][uName].expected += exp
        grouped[cName][aName][uName].collected += col
        if (i.due_date < today && col < exp) grouped[cName][aName][uName].overdue += (exp - col)
      })
    })

    setData(grouped)
    setLoading(false)
  }

  function toggle(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }))
  }

  const thStyle = { padding: '9px 12px', textAlign: 'right', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 12px', textAlign: 'right', fontSize: '13px', borderBottom: '1px solid #f5f5f5' }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '500' }}>Ana Rapor</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['gunluk', 'aylik'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '500', borderRadius: '8px', cursor: 'pointer', border: '1px solid #ddd', background: period === p ? '#1a1a1a' : 'white', color: period === p ? 'white' : '#555' }}>
              {p === 'gunluk' ? 'Günlük' : 'Aylık'}
            </button>
          ))}
        </div>
      </div>

      {/* METRİKLER */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '1.5rem' }}>
        {[
          { label: period === 'gunluk' ? 'Bugün satış' : 'Bu ay satış', val: fmt(metrics.sales) + ' EUR' },
          { label: 'Bugün beklenen tahsilat', val: fmt(metrics.expected) + ' EUR' },
          { label: 'Bugün gerçekleşen tahsilat', val: fmt(metrics.collected) + ' EUR', ok: true },
          { label: 'Vadesi geçmiş açık', val: fmt(metrics.overdue) + ' EUR', sub: metrics.overdueCount + ' taksit', err: metrics.overdue > 0 },
        ].map(m => (
          <div key={m.label} style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '18px', fontWeight: '500', color: m.err ? '#c62828' : m.ok ? '#2e7d32' : '#1a1a1a' }}>{m.val}</div>
            {m.sub && <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* TABLO */}
      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Ülke / Acente / Satışçı</th>
              <th style={thStyle}>Satış (EUR)</th>
              <th style={thStyle}>Beklenen Tahsilat</th>
              <th style={thStyle}>Gerçekleşen Tahsilat</th>
              <th style={thStyle}>Vadesi Geçmiş</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([ulke, acenteler]) => {
              const uk = Object.values(acenteler).flatMap(Object.values).reduce((s, x) => ({
                sales: s.sales + x.sales, expected: s.expected + x.expected,
                collected: s.collected + x.collected, overdue: s.overdue + x.overdue
              }), { sales: 0, expected: 0, collected: 0, overdue: 0 })
              const uKey = 'u_' + ulke
              return [
                <tr key={uKey} onClick={() => toggle(uKey)} style={{ cursor: 'pointer', background: '#f5f7fa' }}>
                  <td style={{ padding: '9px 12px', fontWeight: '500', borderBottom: '1px solid #eee' }}>{collapsed[uKey] ? '▶' : '▼'} {ulke}</td>
                  <td style={tdStyle}>{fmt(uk.sales)}</td>
                  <td style={tdStyle}>{fmt(uk.expected)}</td>
                  <td style={{ ...tdStyle, color: '#2e7d32' }}>{fmt(uk.collected)}</td>
                  <td style={{ ...tdStyle, color: uk.overdue > 0 ? '#c62828' : '#888' }}>{fmt(uk.overdue)}</td>
                </tr>,
                ...(!collapsed[uKey] ? Object.entries(acenteler).map(([acente, satiscilar]) => {
                  const ak = Object.values(satiscilar).reduce((s, x) => ({
                    sales: s.sales + x.sales, expected: s.expected + x.expected,
                    collected: s.collected + x.collected, overdue: s.overdue + x.overdue
                  }), { sales: 0, expected: 0, collected: 0, overdue: 0 })
                  const aKey = 'a_' + ulke + acente
                  return [
                    <tr key={aKey} onClick={() => toggle(aKey)} style={{ cursor: 'pointer', background: '#fafafa' }}>
                      <td style={{ padding: '9px 12px 9px 24px', fontWeight: '500', borderBottom: '1px solid #f0f0f0', fontSize: '12px', color: '#444' }}>{collapsed[aKey] ? '▶' : '▼'} {acente}</td>
                      <td style={{ ...tdStyle, fontSize: '12px' }}>{fmt(ak.sales)}</td>
                      <td style={{ ...tdStyle, fontSize: '12px' }}>{fmt(ak.expected)}</td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: '#2e7d32' }}>{fmt(ak.collected)}</td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: ak.overdue > 0 ? '#c62828' : '#888' }}>{fmt(ak.overdue)}</td>
                    </tr>,
                    ...(!collapsed[aKey] ? Object.entries(satiscilar).map(([satisc, vals]) => (
                      <tr key={satisc}>
                        <td style={{ padding: '8px 12px 8px 40px', borderBottom: '1px solid #f5f5f5', color: '#555', fontSize: '12px' }}>{satisc}</td>
                        <td style={{ ...tdStyle, fontSize: '12px' }}>{fmt(vals.sales)}</td>
                        <td style={{ ...tdStyle, fontSize: '12px' }}>{fmt(vals.expected)}</td>
                        <td style={{ ...tdStyle, fontSize: '12px', color: '#2e7d32' }}>{fmt(vals.collected)}</td>
                        <td style={{ ...tdStyle, fontSize: '12px', color: vals.overdue > 0 ? '#c62828' : '#888' }}>{fmt(vals.overdue)}</td>
                      </tr>
                    )) : [])
                  ]
                }) : [])
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}