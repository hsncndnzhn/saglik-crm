import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const MONTHS = []
const now = new Date()
for (let i = -1; i <= 11; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const label = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  MONTHS.push({ val, label })
}

const fmt = n => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })

export default function HedefGirisi() {
  const [period, setPeriod] = useState(MONTHS[1].val)
  const [rows, setRows] = useState([])
  const [targets, setTargets] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [period])

  async function loadData() {
    setLoading(true)

    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, role, agencies(id, name, is_swissmed, countries(name))')
      .in('role', ['satis', 'acente'])
      .order('full_name')

    const { data: targetData } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('period', period)

    // Hedefleri map'e al
    const tmap = {}
    ;(targetData || []).forEach(t => {
      const key = t.user_id ? `u_${t.user_id}` : `a_${t.agency_id}`
      tmap[key] = { id: t.id, val: t.target_eur }
    })

    // Swissmed satışçıları → satışçı bazlı
    // Diğer acenteler → acente bazlı (tek satır)
    const swissmedUsers = (usersData || []).filter(u => u.agencies?.is_swissmed)
    const otherAgencies = {}
    ;(usersData || []).filter(u => !u.agencies?.is_swissmed).forEach(u => {
      const aid = u.agencies?.id
      if (!aid) return
      if (!otherAgencies[aid]) otherAgencies[aid] = { agency: u.agencies, users: [] }
      otherAgencies[aid].users.push(u)
    })

    const rowList = [
      ...swissmedUsers.map(u => ({
        key: `u_${u.id}`,
        label: u.full_name,
        sub: u.agencies?.name,
        country: u.agencies?.countries?.name,
        type: 'satisc',
        userId: u.id,
        agencyId: null,
      })),
      ...Object.values(otherAgencies).map(({ agency }) => ({
        key: `a_${agency.id}`,
        label: agency.name,
        sub: agency.countries?.name,
        country: agency.countries?.name,
        type: 'acente',
        userId: null,
        agencyId: agency.id,
      })),
    ]

    setRows(rowList)
    const initTargets = {}
    rowList.forEach(r => {
      initTargets[r.key] = tmap[r.key]?.val ?? ''
    })
    setTargets(initTargets)
    setLoading(false)
  }

  async function saveTarget(row) {
    setSaving(s => ({ ...s, [row.key]: true }))
    const val = parseFloat(targets[row.key])
    if (isNaN(val)) { setSaving(s => ({ ...s, [row.key]: false })); return }

    const payload = {
      period,
      target_eur: val,
      user_id: row.userId,
      agency_id: row.agencyId,
    }

    await supabase.from('sales_targets').upsert(payload, {
      onConflict: row.userId ? 'period,user_id' : 'period,agency_id'
    })

    setSaving(s => ({ ...s, [row.key]: false }))
    setToast(`${row.label} için hedef kaydedildi.`)
    setTimeout(() => setToast(''), 2500)
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888' }}>Yükleniyor...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '500' }}>Hedef Girişi</h2>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '8px', background: 'white' }}>
          {MONTHS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
        </select>
      </div>

      {toast && (
        <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#2e7d32', marginBottom: '1rem' }}>
          {toast}
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Satışçı / Acente</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Tip</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Ülke</th>
              <th style={{ padding: '9px 12px', textAlign: 'right', color: '#888', fontWeight: '500', fontSize: '11px', borderBottom: '1px solid #eee' }}>Aylık Satış Hedefi (EUR)</th>
              <th style={{ padding: '9px 12px', borderBottom: '1px solid #eee' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <td style={{ padding: '9px 12px', fontWeight: '500' }}>
                  {row.label}
                  <div style={{ fontSize: '11px', color: '#888', fontWeight: '400', marginTop: '1px' }}>{row.sub}</div>
                </td>
                <td style={{ padding: '9px 12px', color: '#888', fontSize: '12px' }}>
                  {row.type === 'satisc' ? 'Satışçı' : 'Acente'}
                </td>
                <td style={{ padding: '9px 12px', color: '#888', fontSize: '12px' }}>{row.country}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                  <input
                    type="number"
                    value={targets[row.key] ?? ''}
                    onChange={e => setTargets(t => ({ ...t, [row.key]: e.target.value }))}
                    placeholder="0"
                    style={{ width: '130px', padding: '6px 10px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '12px', color: '#888', marginLeft: '6px' }}>EUR</span>
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                  <button onClick={() => saveTarget(row)} disabled={saving[row.key]}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '500', border: 'none', borderRadius: '6px', background: '#1a1a1a', color: 'white', cursor: 'pointer', opacity: saving[row.key] ? 0.6 : 1 }}>
                    {saving[row.key] ? '...' : 'Kaydet'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}