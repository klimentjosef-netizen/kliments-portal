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

type Mode = 'ucetni' | 'real'
type LItem = { category: string; description: string; status: string; amount_actual: number; amount_expected: number; kind?: string; manualCash?: boolean }

function val(it: { status: string; amount_actual: number; amount_expected: number }) {
  return it.status === 'paid' || it.status === 'confirmed' ? it.amount_actual : it.amount_expected
}
type Agg = { trzby: number; material: number; marketing: number; logistika: number; rezie: number; osobni: number; kesRev: number; kesCost: number }
const ZERO: Agg = { trzby: 0, material: 0, marketing: 0, logistika: 0, rezie: 0, osobni: 0, kesRev: 0, kesCost: 0 }

// Náklad → kbelík. Funguje pro autoservis (materiál/mzdy) i e-shop (zboží/marketing/logistika).
function costBucket(desc: string): 'material' | 'marketing' | 'logistika' | 'rezie' {
  if (/marketing|reklam/i.test(desc)) return 'marketing'
  if (/logistik|balné|balne|doprav|přeprav|preprav|brán|brany/i.test(desc)) return 'logistika'
  if (/zboží|zbozi|materiál|material|díly|dily/i.test(desc)) return 'material'
  return 'rezie'
}

function aggItems(items: LItem[]): Agg {
  const a: Agg = { ...ZERO }
  for (const it of items) {
    const v = val(it)
    if (it.manualCash) { if (it.category === 'revenue') a.kesRev += v; else a.kesCost += Math.abs(v); continue }
    if (it.category === 'revenue') { a.trzby += v; continue }
    if (it.kind === 'osobni') { a.osobni += Math.abs(v); continue }
    a[costBucket(it.description)] += Math.abs(v)
  }
  return a
}
const addAgg = (a: Agg, b: Agg): Agg => ({
  trzby: a.trzby + b.trzby, material: a.material + b.material, marketing: a.marketing + b.marketing,
  logistika: a.logistika + b.logistika, rezie: a.rezie + b.rezie,
  osobni: a.osobni + b.osobni, kesRev: a.kesRev + b.kesRev, kesCost: a.kesCost + b.kesCost,
})
const opCost = (a: Agg) => a.material + a.marketing + a.logistika + a.rezie
// Reálný provozní zisk vyčistí osobní spotřebu a přidá keš mimo banku;
// účetní zisk = jak to vidí účetní/FÚ (osobní je náklad, keš tam není).
const ziskOf = (a: Agg, mode: Mode) => mode === 'real'
  ? (a.trzby + a.kesRev) - opCost(a) - a.kesCost
  : a.trzby - opCost(a) - a.osobni
const hasReal = (a: Agg) => a.osobni !== 0 || a.kesRev !== 0 || a.kesCost !== 0
const isEshop = (a: Agg) => a.marketing !== 0 || a.logistika !== 0
const cogsLabel = (a: Agg) => isEshop(a) ? 'Nákup zboží' : 'Materiál a díly'

export default function PnlTab({ ledger, view: viewProp, onViewChange }: PnlTabProps) {
  const years = Array.from(new Set(
    ledger.months.filter(m => m.items.length > 0).map(m => m.month.slice(0, 4))
  )).sort()
  const [viewInternal, setViewInternal] = useState<string>('souhrn')
  const [mode, setMode] = useState<Mode>('real')
  const view = viewProp ?? viewInternal
  const setView = onViewChange ?? setViewInternal

  if (years.length === 0) {
    return <div className="bg-white rounded-[20px] p-8 border border-black/[0.06] text-center text-mid">Zatím tu nejsou žádná data hospodaření.</div>
  }

  const perYear = years.map(y => ({
    year: y,
    agg: ledger.months.filter(m => m.month.startsWith(y)).reduce((a, m) => addAgg(a, aggItems(m.items as LItem[])), { ...ZERO }),
  }))
  const total = perYear.reduce((a, p) => addAgg(a, p.agg), { ...ZERO })
  const pct = (part: number, whole: number) => whole > 0 ? Math.round(part / whole * 100) : 0
  const anyReal = perYear.some(p => hasReal(p.agg))
  const eshop = isEshop(total)
  const lines: [string, keyof Agg][] = [
    ['Tržby', 'trzby'], [cogsLabel(total), 'material'],
    ...(eshop ? ([['Marketing', 'marketing'], ['Logistika a balné', 'logistika']] as [string, keyof Agg][]) : []),
    ['Mzdy + režie', 'rezie'],
  ]

  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  const tabBtn = (id: string, label: string) => (
    <button key={id} onClick={() => setView(id)}
      className={`px-4 py-1.5 rounded-full text-[0.8rem] font-medium transition-colors ${
        view === id ? 'bg-rose text-white' : 'bg-white border border-black/[0.08] text-mid hover:border-rose-pale'
      }`}>
      {label}
    </button>
  )
  const modeBtn = (id: Mode, label: string) => (
    <button key={id} onClick={() => setMode(id)}
      className={`px-3 py-1 rounded-full text-[0.72rem] font-medium transition-colors ${
        mode === id ? 'bg-ink text-sand' : 'bg-white border border-black/[0.08] text-mid hover:border-ink/30'
      }`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
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

      {/* Přepínač pohledu Účetní / Reálný provozní */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">Pohled</span>
        {modeBtn('real', 'Reálný provozní')}
        {modeBtn('ucetni', 'Účetní')}
        <span className="text-[0.68rem] text-mid">
          {mode === 'real'
            ? 'Bez osobní spotřeby majitele, včetně keše mimo banku · skutečný provoz.'
            : 'Jak to vidí účetní a finanční úřad · daňový základ.'}
        </span>
      </div>

      {view === 'souhrn' ? (
        <>
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
                {lines.map(([label, key]) => (
                  <tr key={key} className="border-t border-black/[0.04]">
                    <td className="py-2 text-ink">{label}</td>
                    {perYear.map(p => <td key={p.year} className="py-2 text-right text-mid">{fmt(Math.round(p.agg[key]))}</td>)}
                    <td className="py-2 text-right font-medium text-ink">{fmt(Math.round(total[key]))}</td>
                  </tr>
                ))}
                {anyReal && mode === 'ucetni' && (
                  <tr className="border-t border-black/[0.04]">
                    <td className="py-2 text-mid">Osobní spotřeba majitele</td>
                    {perYear.map(p => <td key={p.year} className="py-2 text-right text-mid">{fmt(Math.round(p.agg.osobni))}</td>)}
                    <td className="py-2 text-right text-ink">{fmt(Math.round(total.osobni))}</td>
                  </tr>
                )}
                {anyReal && mode === 'real' && (
                  <tr className="border-t border-black/[0.04]">
                    <td className="py-2 text-mid text-[0.76rem]">Keš mimo banku (čistý)</td>
                    {perYear.map(p => <td key={p.year} className="py-2 text-right text-mid text-[0.76rem]">{fmt(Math.round(p.agg.kesRev - p.agg.kesCost))}</td>)}
                    <td className="py-2 text-right text-ink text-[0.76rem]">{fmt(Math.round(total.kesRev - total.kesCost))}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-black/10 font-semibold">
                  <td className="py-2 text-ink">{mode === 'real' ? 'Reálný provozní zisk' : 'Účetní zisk'}</td>
                  {perYear.map(p => { const z = ziskOf(p.agg, mode); return <td key={p.year} className={`py-2 text-right ${z >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(z))}</td> })}
                  {(() => { const z = ziskOf(total, mode); return <td className={`py-2 text-right ${z >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(z))}</td> })()}
                </tr>
                <tr className="border-t border-black/[0.04]">
                  <td className="py-2 text-mid text-[0.76rem]">{eshop ? 'Hrubá marže (po zboží)' : 'Materiálová náročnost'}</td>
                  {perYear.map(p => <td key={p.year} className="py-2 text-right text-mid text-[0.76rem]">{eshop ? 100 - pct(p.agg.material, p.agg.trzby) : pct(p.agg.material, p.agg.trzby)} %</td>)}
                  <td className="py-2 text-right text-ink text-[0.76rem]">{eshop ? 100 - pct(total.material, total.trzby) : pct(total.material, total.trzby)} %</td>
                </tr>
                {eshop && (
                  <tr className="border-t border-black/[0.04]">
                    <td className="py-2 text-mid text-[0.76rem]">PNO · marketing/obrat</td>
                    {perYear.map(p => <td key={p.year} className="py-2 text-right text-mid text-[0.76rem]">{pct(p.agg.marketing, p.agg.trzby)} %</td>)}
                    <td className="py-2 text-right text-ink text-[0.76rem]">{pct(total.marketing, total.trzby)} %</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SumCard label={`Tržby celkem (${years[0]}/${years[years.length - 1]})`} value={total.trzby} />
            <SumCard label={`${cogsLabel(total)} celkem`} value={total.material} negative sub={`${pct(total.material, total.trzby)} % z tržeb`} />
            {eshop
              ? <SumCard label="Marketing celkem" value={total.marketing} negative sub={`PNO ${pct(total.marketing, total.trzby)} %`} />
              : <SumCard label="Mzdy + režie celkem" value={total.rezie} negative />}
            <SumCard label={mode === 'real' ? 'Reálný provozní zisk' : 'Účetní zisk'} value={ziskOf(total, mode)} profit />
          </div>
          {anyReal && (
            <p className="text-[0.72rem] text-mid px-1">
              {mode === 'real'
                ? `Reálný pohled · osobní spotřeba majitele (${fmt(Math.round(total.osobni))}) vyčištěna z provozu, keš mimo banku zahrnut.`
                : 'Účetní pohled · osobní spotřeba je v nákladech, keš mimo banku není zahrnut.'}
            </p>
          )}
          <p className="text-[0.72rem] text-mid px-1">Tip: klikni na konkrétní rok nahoře pro měsíční rozpad.</p>
        </>
      ) : (
        <YearDetail ledger={ledger} year={view} agg={perYear.find(p => p.year === view)?.agg || ZERO} mode={mode} />
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

function YearDetail({ ledger, year, agg, mode }: { ledger: Ledger; year: string; agg: Agg; mode: Mode }) {
  const months = ledger.months.filter(m => m.month.startsWith(year) && m.items.length > 0)
  const rows = months.map(m => {
    const a = aggItems(m.items as LItem[])
    const mi = parseInt(m.month.slice(5), 10)
    return { label: CZ_SHORT[mi - 1], agg: a }
  })
  const matPct = agg.trzby > 0 ? Math.round(agg.material / agg.trzby * 100) : 0
  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'
  const yearZisk = ziskOf(agg, mode)
  const eshop = isEshop(agg)
  // 3. sloupec: e-shop = Marketing, jinak Mzdy + režie
  const col3 = (a: Agg) => eshop ? a.marketing : a.rezie
  const col3label = eshop ? 'Marketing' : 'Mzdy + režie'
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SumCard label={`Tržby ${year}`} value={agg.trzby} />
        <SumCard label={cogsLabel(agg)} value={agg.material} negative sub={`${matPct} % z tržeb`} />
        <SumCard label={col3label} value={col3(agg)} negative sub={eshop ? `PNO ${matPct ? Math.round(agg.marketing / agg.trzby * 100) : 0} %` : undefined} />
        <SumCard label={mode === 'real' ? 'Reálný provozní zisk' : 'Účetní zisk'} value={yearZisk} profit />
      </div>
      <div className={`${card} overflow-x-auto`}>
        <h4 className="font-serif text-base text-ink mb-4">Po měsících · {year}</h4>
        <table className="w-full text-[0.8rem]">
          <thead>
            <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
              <th className="text-left pb-2 font-medium">Měsíc</th>
              <th className="text-right pb-2 font-medium">Tržby</th>
              <th className="text-right pb-2 font-medium">{cogsLabel(agg)}</th>
              <th className="text-right pb-2 font-medium">{col3label}</th>
              <th className="text-right pb-2 font-medium">{mode === 'real' ? 'Reálný zisk' : 'Účetní zisk'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => { const z = ziskOf(r.agg, mode); return (
              <tr key={i} className="border-t border-black/[0.04]">
                <td className="py-2 text-ink font-medium">{r.label}</td>
                <td className="py-2 text-right text-mid">{fmt(Math.round(r.agg.trzby))}</td>
                <td className="py-2 text-right text-mid">{fmt(Math.round(r.agg.material))}</td>
                <td className="py-2 text-right text-mid">{fmt(Math.round(col3(r.agg)))}</td>
                <td className={`py-2 text-right font-medium ${z >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(z))}</td>
              </tr>
            ) })}
            <tr className="border-t-2 border-black/10 font-semibold">
              <td className="py-2 text-ink">Celkem {year}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(agg.trzby))}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(agg.material))}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(col3(agg)))}</td>
              <td className={`py-2 text-right ${yearZisk >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(yearZisk))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}
