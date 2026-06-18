'use client'

import { useState } from 'react'
import { type Ledger, fmt } from './calcEngine'
import { PeriodBadge } from './period'

interface PnlTabProps {
  ledger: Ledger
  view?: string
  onViewChange?: (v: string) => void
}

const CZ_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

function val(it: { status: string; amount_actual: number; amount_expected: number }) {
  return it.status === 'paid' || it.status === 'confirmed' ? it.amount_actual : it.amount_expected
}
type Agg = { trzby: number; material: number; rezie: number; zisk: number }
const ZERO: Agg = { trzby: 0, material: 0, rezie: 0, zisk: 0 }

function aggItems(items: { category: string; description: string; status: string; amount_actual: number; amount_expected: number }[]): Agg {
  const trzby = items.filter(it => it.category === 'revenue').reduce((s, it) => s + val(it), 0)
  const material = Math.abs(items.filter(it => /materiál/i.test(it.description)).reduce((s, it) => s + val(it), 0))
  const rezie = Math.abs(items.filter(it => /mzd|režie/i.test(it.description)).reduce((s, it) => s + val(it), 0))
  return { trzby, material, rezie, zisk: trzby - material - rezie }
}
const addAgg = (a: Agg, b: Agg): Agg => ({ trzby: a.trzby + b.trzby, material: a.material + b.material, rezie: a.rezie + b.rezie, zisk: a.zisk + b.zisk })

export default function PnlTab({ ledger, view: viewProp, onViewChange }: PnlTabProps) {
  const years = Array.from(new Set(
    ledger.months.filter(m => m.items.length > 0).map(m => m.month.slice(0, 4))
  )).sort()
  const [viewInternal, setViewInternal] = useState<string>('souhrn')
  const view = viewProp ?? viewInternal
  const setView = onViewChange ?? setViewInternal

  if (years.length === 0) {
    return <div className="bg-white rounded-[20px] p-8 border border-black/[0.06] text-center text-mid">Zatím tu nejsou žádná data hospodaření.</div>
  }

  // agregát za každý rok + celkem
  const perYear = years.map(y => ({
    year: y,
    agg: ledger.months.filter(m => m.month.startsWith(y)).reduce((a, m) => addAgg(a, aggItems(m.items)), { ...ZERO }),
  }))
  const total = perYear.reduce((a, p) => addAgg(a, p.agg), { ...ZERO })
  const pct = (part: number, whole: number) => whole > 0 ? Math.round(part / whole * 100) : 0

  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  const tabBtn = (id: string, label: string) => (
    <button key={id} onClick={() => setView(id)}
      className={`px-4 py-1.5 rounded-full text-[0.8rem] font-medium transition-colors ${
        view === id ? 'bg-rose text-white' : 'bg-white border border-black/[0.08] text-mid hover:border-rose-pale'
      }`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      {/* Přepínač: Souhrn + jednotlivé roky */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-ink font-light">Hospodaření</h3>
          <p className="text-[0.78rem] text-mid mb-2">Kolik firma vydělala · tržby, náklady, zisk.</p>
          {(() => {
            const cy = new Date().getFullYear()
            if (view === 'souhrn') return <PeriodBadge kind="actual" text="Skutečnost · uzavřené roky" />
            const live = Number(view) >= cy
            return <PeriodBadge kind={live ? 'live' : 'actual'} text={live ? `Živě · ${view}` : `Skutečnost · ${view} (uzavřený rok)`} />
          })()}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tabBtn('souhrn', 'Souhrn všech let')}
          {years.map(y => tabBtn(y, y))}
        </div>
      </div>

      {view === 'souhrn' ? (
        <>
          {/* Kumulativní souhrn: roky vedle sebe + celkem */}
          <div className={`${card} overflow-x-auto`}>
            <h4 className="font-serif text-base text-ink mb-4">Roky vedle sebe</h4>
            <table className="w-full text-[0.82rem]">
              <thead>
                <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                  <th className="text-left pb-2 font-medium">Položka</th>
                  {perYear.map(p => <th key={p.year} className="text-right pb-2 font-medium">{p.year}</th>)}
                  <th className="text-right pb-2 font-medium text-ink">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Tržby', 'trzby'], ['Materiál a díly', 'material'], ['Mzdy + režie', 'rezie'], ['Provozní zisk (EBITDA)', 'zisk'],
                ] as [string, keyof Agg][]).map(([label, key]) => (
                  <tr key={key} className={`border-t border-black/[0.04] ${key === 'zisk' ? 'font-semibold' : ''}`}>
                    <td className="py-2 text-ink">{label}</td>
                    {perYear.map(p => (
                      <td key={p.year} className={`py-2 text-right ${key === 'zisk' ? (p.agg.zisk >= 0 ? 'text-green' : 'text-rose-deep') : 'text-mid'}`}>
                        {fmt(Math.round(p.agg[key]))}
                      </td>
                    ))}
                    <td className={`py-2 text-right font-medium ${key === 'zisk' ? (total.zisk >= 0 ? 'text-green' : 'text-rose-deep') : 'text-ink'}`}>
                      {fmt(Math.round(total[key]))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-black/[0.04]">
                  <td className="py-2 text-mid text-[0.76rem]">Materiálová náročnost</td>
                  {perYear.map(p => <td key={p.year} className="py-2 text-right text-mid text-[0.76rem]">{pct(p.agg.material, p.agg.trzby)} %</td>)}
                  <td className="py-2 text-right text-ink text-[0.76rem]">{pct(total.material, total.trzby)} %</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kumulativní karty */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SumCard label={`Tržby celkem (${years[0]}/${years[years.length - 1]})`} value={total.trzby} />
            <SumCard label="Materiál celkem" value={total.material} negative sub={`${pct(total.material, total.trzby)} % z tržeb`} />
            <SumCard label="Mzdy + režie celkem" value={total.rezie} negative />
            <SumCard label="Provozní zisk celkem" value={total.zisk} profit />
          </div>
          <p className="text-[0.72rem] text-mid px-1">Tip: klikni na konkrétní rok nahoře pro měsíční rozpad.</p>
        </>
      ) : (
        <YearDetail ledger={ledger} year={view} agg={perYear.find(p => p.year === view)?.agg || ZERO} />
      )}
    </div>
  )
}

function SumCard({ label, value, negative, profit, sub }: { label: string; value: number; negative?: boolean; profit?: boolean; sub?: string }) {
  const color = profit ? (value >= 0 ? 'text-green' : 'text-rose-deep') : negative ? 'text-rose-deep' : 'text-ink'
  return (
    <div className={`bg-white rounded-[20px] p-6 border border-black/[0.06] ${profit ? (value >= 0 ? 'bg-green/[0.05]' : 'bg-rose/[0.05]') : ''}`}>
      <div className="text-[0.6rem] tracking-[0.08em] uppercase text-mid mb-1">{label}</div>
      <div className={`font-serif text-2xl font-light ${color}`}>{fmt(Math.round(value))}</div>
      {sub && <div className="text-[0.68rem] text-mid mt-1">{sub}</div>}
    </div>
  )
}

function YearDetail({ ledger, year, agg }: { ledger: Ledger; year: string; agg: Agg }) {
  const months = ledger.months.filter(m => m.month.startsWith(year) && m.items.length > 0)
  const rows = months.map(m => {
    const a = aggItems(m.items)
    const mi = parseInt(m.month.slice(5), 10)
    return { label: CZ_SHORT[mi - 1], ...a }
  })
  const matPct = agg.trzby > 0 ? Math.round(agg.material / agg.trzby * 100) : 0
  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SumCard label={`Tržby ${year}`} value={agg.trzby} />
        <SumCard label="Materiál a díly" value={agg.material} negative sub={`${matPct} % z tržeb`} />
        <SumCard label="Mzdy + režie" value={agg.rezie} negative />
        <SumCard label="Provozní zisk (EBITDA)" value={agg.zisk} profit />
      </div>
      <div className={`${card} overflow-x-auto`}>
        <h4 className="font-serif text-base text-ink mb-4">Po měsících · {year}</h4>
        <table className="w-full text-[0.8rem]">
          <thead>
            <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
              <th className="text-left pb-2 font-medium">Měsíc</th>
              <th className="text-right pb-2 font-medium">Tržby</th>
              <th className="text-right pb-2 font-medium">Materiál</th>
              <th className="text-right pb-2 font-medium">Mzdy + režie</th>
              <th className="text-right pb-2 font-medium">Zisk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-black/[0.04]">
                <td className="py-2 text-ink font-medium">{r.label}</td>
                <td className="py-2 text-right text-mid">{fmt(Math.round(r.trzby))}</td>
                <td className="py-2 text-right text-mid">{fmt(Math.round(r.material))}</td>
                <td className="py-2 text-right text-mid">{fmt(Math.round(r.rezie))}</td>
                <td className={`py-2 text-right font-medium ${r.zisk >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(r.zisk))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black/10 font-semibold">
              <td className="py-2 text-ink">Celkem {year}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(agg.trzby))}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(agg.material))}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(agg.rezie))}</td>
              <td className={`py-2 text-right ${agg.zisk >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(agg.zisk))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
