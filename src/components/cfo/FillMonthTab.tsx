'use client'

import { useState, useEffect } from 'react'
import { type Ledger, fmt } from './calcEngine'
import { type WhatIfBase, TECHCARS_BASE } from './calcWhatIfAuto'
import { PeriodBadge } from './period'

interface FillMonthTabProps {
  ledger: Ledger
  whatifBase?: Partial<WhatIfBase>
  onLedgerChange: (l: Ledger) => void
  eshop?: boolean
}

const CZ = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
function val(it: { status: string; amount_actual: number; amount_expected: number }) {
  return it.status === 'paid' || it.status === 'confirmed' ? it.amount_actual : it.amount_expected
}
let _id = 0
type ItemExtra = { kind?: 'provozni' | 'osobni' | 'investice' | 'mimoradne'; manualCash?: boolean }
const item = (date: string, description: string, category: 'revenue' | 'cost', amount: number, extra: ItemExtra = {}) => {
  const signed = Math.round(category === 'revenue' ? Math.abs(amount) : -Math.abs(amount))
  return {
    id: `fill-${Date.now()}-${++_id}`, date, description, category,
    source: (category === 'revenue' ? 'invoice' : 'bill') as 'invoice' | 'bill',
    amount_expected: signed, amount_actual: signed, status: 'paid' as const, ...extra,
  }
}

export default function FillMonthTab({ ledger, whatifBase, onLedgerChange, eshop }: FillMonthTabProps) {
  const year = new Date().getFullYear()
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const cogsLabel = eshop ? 'Nákup zboží' : 'Materiál a díly'
  const [month, setMonth] = useState(months[0])
  const [trzby, setTrzby] = useState('')
  const [material, setMaterial] = useState('')
  const [marketing, setMarketing] = useState('')
  const [rezie, setRezie] = useState('')
  const [osobni, setOsobni] = useState('')
  const [kes, setKes] = useState('')
  const [saved, setSaved] = useState(false)

  const base: WhatIfBase = { ...TECHCARS_BASE, ...whatifBase }
  const planMonthEbitda = Math.round(((base.annual_revenue + base.other_income) - base.annual_revenue * base.material_pct / 100 - base.fixed_annual) / 12)

  // předvyplnit z existujícího měsíce
  useEffect(() => {
    const ex = ledger.months.find((m) => m.month === month && m.items.length > 0)
    if (ex) {
      const rev = ex.items.filter((i) => i.category === 'revenue' && !i.manualCash).reduce((s, i) => s + val(i), 0)
      const mat = Math.abs(ex.items.filter((i) => /zboží|zbozi|materiál|material|díly|dily/i.test(i.description)).reduce((s, i) => s + val(i), 0))
      const mkt = Math.abs(ex.items.filter((i) => /marketing|reklam/i.test(i.description)).reduce((s, i) => s + val(i), 0))
      const rez = Math.abs(ex.items.filter((i) => i.category !== 'revenue' && i.kind !== 'osobni' && !i.manualCash && !/zboží|zbozi|materiál|material|díly|dily|marketing|reklam/i.test(i.description)).reduce((s, i) => s + val(i), 0))
      const oso = Math.abs(ex.items.filter((i) => i.kind === 'osobni').reduce((s, i) => s + val(i), 0))
      const ke = ex.items.filter((i) => i.manualCash).reduce((s, i) => s + val(i), 0)
      setTrzby(rev ? String(rev) : ''); setMaterial(mat ? String(mat) : ''); setMarketing(mkt ? String(mkt) : ''); setRezie(rez ? String(rez) : '')
      setOsobni(oso ? String(oso) : ''); setKes(ke ? String(ke) : '')
    } else { setTrzby(''); setMaterial(''); setMarketing(''); setRezie(''); setOsobni(''); setKes('') }
    setSaved(false)
  }, [month, ledger])

  const t = parseFloat(trzby) || 0, m = parseFloat(material) || 0, mk = parseFloat(marketing) || 0, r = parseFloat(rezie) || 0
  const o = parseFloat(osobni) || 0, k = parseFloat(kes) || 0
  const ebitdaUcetni = t - m - mk - r - o          // jak to vidí účetní (osobní je náklad)
  const ebitdaReal = (t + Math.max(0, k)) - m - mk - r + Math.min(0, k)  // provoz bez osobní + keš mimo banku
  const variance = ebitdaReal - planMonthEbitda

  function save() {
    const items = [
      item(`${month}-15`, 'Tržby', 'revenue', t),
      item(`${month}-15`, cogsLabel, 'cost', m),
      item(`${month}-15`, 'Mzdy a režie', 'cost', r, { kind: 'provozni' }),
    ]
    if (eshop && mk > 0) items.push(item(`${month}-15`, 'Marketing', 'cost', mk))
    if (o > 0) items.push(item(`${month}-15`, 'Osobní spotřeba majitele', 'cost', o, { kind: 'osobni' }))
    if (k !== 0) items.push(item(`${month}-15`, 'Ruční keš (mimo účetnictví)', k >= 0 ? 'revenue' : 'cost', Math.abs(k), { manualCash: true }))
    const rest = ledger.months.filter((mm) => mm.month !== month)
    const newMonths = [...rest, { month, items, locked: false }].sort((a, b) => a.month.localeCompare(b.month))
    onLedgerChange({ ...ledger, months: newMonths })
    setSaved(true)
  }

  const filled = months.filter((mk) => ledger.months.find((mm) => mm.month === mk && mm.items.length > 0))
  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  const inputCls = 'w-full bg-sand-pale rounded-lg px-3 py-2 text-base text-ink outline-none focus:ring-1 focus:ring-rose'

  return (
    <div className="space-y-6">
      <div className="bg-ink rounded-[20px] p-6 text-sand">
        <div className="mb-2"><PeriodBadge kind="live" text={`Letošní rok ${year}: ${filled.length}/12 měsíců`} /></div>
        <h3 className="font-serif text-xl font-light mb-1">Doplnit měsíc · živá data {year}</h3>
        <p className="text-[0.82rem] text-white/55 leading-relaxed">
          Po uzávěrce měsíce sem zadejte pár čísel. Portál měsíc rozsvítí naživo, doplní letošní rok
          a porovná ho s plánem. Naskenované doklady patří do záložky Dokumenty.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Formulář */}
        <div className={card}>
          <h4 className="font-serif text-base text-ink mb-4">Zadat / upravit měsíc</h4>
          <label className="block mb-3">
            <span className="text-[0.62rem] tracking-[0.1em] uppercase text-mid block mb-1">Měsíc</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
              {months.map((mk, i) => (
                <option key={mk} value={mk}>{CZ[i]} {year}{ledger.months.find((mm) => mm.month === mk && mm.items.length > 0) ? ' ✓' : ''}</option>
              ))}
            </select>
          </label>
          {([
            ['Tržby (Kč)', trzby, setTrzby],
            [`${cogsLabel} (Kč)`, material, setMaterial],
            ...(eshop ? [['Marketing (Kč)', marketing, setMarketing]] as [string, string, (v: string) => void][] : []),
            ['Mzdy a režie · provozní (Kč)', rezie, setRezie],
          ] as [string, string, (v: string) => void][]).map(([label, v, set]) => (
            <label key={label} className="block mb-3">
              <span className="text-[0.62rem] tracking-[0.1em] uppercase text-mid block mb-1">{label}</span>
              <input type="number" value={v} onChange={(e) => { set(e.target.value); setSaved(false) }} placeholder="0" className={inputCls} />
            </label>
          ))}
          <div className="mt-4 mb-2 text-[0.6rem] tracking-[0.1em] uppercase text-rose-deep">Reálná vrstva · nevidí účetní/FÚ</div>
          <label className="block mb-1">
            <span className="text-[0.62rem] tracking-[0.1em] uppercase text-mid block mb-1">Osobní spotřeba majitele (Kč)</span>
            <input type="number" value={osobni} onChange={(e) => { setOsobni(e.target.value); setSaved(false) }} placeholder="0" className={inputCls} />
          </label>
          <p className="text-[0.66rem] text-mid mb-3 px-1">Vlastní výběry vedené přes firmu · v reálném zisku se nepočítají jako provozní náklad.</p>
          <label className="block mb-1">
            <span className="text-[0.62rem] tracking-[0.1em] uppercase text-mid block mb-1">Ruční keš mimo banku (Kč, +/−)</span>
            <input type="number" value={kes} onChange={(e) => { setKes(e.target.value); setSaved(false) }} placeholder="0" className={inputCls} />
          </label>
          <p className="text-[0.66rem] text-mid mb-3 px-1">Daněné toky evidované zvlášť (na papíře). Kladně příjem, záporně výdaj · vstupují do reálné hotovosti.</p>
          <button onClick={save} disabled={t === 0 && m === 0 && mk === 0 && r === 0 && o === 0 && k === 0}
            className="w-full mt-2 bg-rose text-white rounded-full py-2.5 text-[0.82rem] font-medium hover:bg-rose-deep transition-colors disabled:opacity-40">
            {saved ? '✓ Uloženo' : 'Uložit měsíc'}
          </button>
        </div>

        {/* Náhled */}
        <div className={card}>
          <h4 className="font-serif text-base text-ink mb-4">Výsledek měsíce</h4>
          <div className="space-y-2 text-[0.85rem]">
            <Row label="Tržby" value={t} />
            <Row label={`− ${cogsLabel}`} value={-m} />
            {eshop && mk > 0 && <Row label="− Marketing" value={-mk} />}
            <Row label="− Mzdy a režie (provozní)" value={-r} />
            {o > 0 && <Row label="− Osobní spotřeba majitele" value={-o} />}
            <div className="border-t border-black/10 pt-2 flex justify-between text-mid">
              <span>Účetní zisk</span>
              <span className={ebitdaUcetni >= 0 ? 'text-green' : 'text-rose-deep'}>{fmt(Math.round(ebitdaUcetni))}</span>
            </div>
            {o > 0 && <Row label="+ Osobní zpět (není provoz)" value={o} />}
            {k !== 0 && <Row label={`${k >= 0 ? '+' : '−'} Ruční keš mimo banku`} value={k} />}
            <div className="border-t-2 border-black/10 pt-2 flex justify-between font-semibold">
              <span>Reálný provozní zisk</span>
              <span className={ebitdaReal >= 0 ? 'text-green' : 'text-rose-deep'}>{fmt(Math.round(ebitdaReal))}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-black/[0.06] text-[0.78rem]">
            <div className="flex justify-between text-mid"><span>Plán (měsíc)</span><span>{fmt(planMonthEbitda)}</span></div>
            <div className="flex justify-between font-medium mt-1">
              <span>Odchylka od plánu (reálný)</span>
              <span className={variance >= 0 ? 'text-green' : 'text-rose-deep'}>{variance >= 0 ? '+' : ''}{fmt(Math.round(variance))}</span>
            </div>
          </div>
        </div>
      </div>

      {filled.length > 0 && (
        <div className={`${card} overflow-x-auto`}>
          <h4 className="font-serif text-base text-ink mb-3">Doplněné měsíce {year}</h4>
          <div className="flex flex-wrap gap-2">
            {months.map((mk, i) => {
              const has = filled.includes(mk)
              return (
                <button key={mk} onClick={() => setMonth(mk)}
                  className={`px-3 py-1.5 rounded-full text-[0.72rem] font-medium border transition-colors ${
                    has ? 'bg-green/10 text-green border-green/20' : 'bg-white text-mid border-black/[0.08] hover:border-rose-pale'
                  }`}>
                  {CZ[i].slice(0, 3)} {has ? '✓' : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-mid">
      <span>{label}</span>
      <span>{fmt(Math.round(value))}</span>
    </div>
  )
}
