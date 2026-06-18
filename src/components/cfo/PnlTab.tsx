'use client'

import { useState } from 'react'
import { type Ledger, fmt } from './calcEngine'

interface PnlTabProps {
  ledger: Ledger
}

const CZ_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

function val(it: { status: string; amount_actual: number; amount_expected: number }) {
  return it.status === 'paid' || it.status === 'confirmed' ? it.amount_actual : it.amount_expected
}

export default function PnlTab({ ledger }: PnlTabProps) {
  // roky, které mají v ledgeru data
  const years = Array.from(new Set(
    ledger.months.filter(m => m.items.length > 0).map(m => m.month.slice(0, 4))
  )).sort()
  const [year, setYear] = useState(years[years.length - 1] || '')

  if (years.length === 0) {
    return <div className="bg-white rounded-[20px] p-8 border border-black/[0.06] text-center text-mid">Zatím tu nejsou žádná data hospodaření.</div>
  }

  const months = ledger.months.filter(m => m.month.startsWith(year) && m.items.length > 0)
  // měsíční rozpad
  const rows = months.map(m => {
    const trzby = m.items.filter(it => it.category === 'revenue').reduce((s, it) => s + val(it), 0)
    const material = Math.abs(m.items.filter(it => /materiál/i.test(it.description)).reduce((s, it) => s + val(it), 0))
    const rezie = Math.abs(m.items.filter(it => /mzd|režie/i.test(it.description)).reduce((s, it) => s + val(it), 0))
    const mi = parseInt(m.month.slice(5), 10)
    return { label: CZ_SHORT[mi - 1], trzby, material, rezie, zisk: trzby - material - rezie }
  })
  const sum = rows.reduce((a, r) => ({
    trzby: a.trzby + r.trzby, material: a.material + r.material, rezie: a.rezie + r.rezie, zisk: a.zisk + r.zisk,
  }), { trzby: 0, material: 0, rezie: 0, zisk: 0 })
  const matPct = sum.trzby > 0 ? Math.round(sum.material / sum.trzby * 100) : 0

  const card = 'bg-white rounded-[20px] p-6 border border-black/[0.06]'

  return (
    <div className="space-y-6">
      {/* Intro + přepínač roku */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-ink font-light">Hospodaření {year}</h3>
          <p className="text-[0.78rem] text-mid">Kolik firma vydělala — tržby, náklady, zisk. Uzavřený rok (skutečnost).</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.62rem] tracking-[0.12em] uppercase text-mid mr-1">Rok</span>
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`px-4 py-1.5 rounded-full text-[0.78rem] font-medium transition-colors ${
                year === y ? 'bg-rose text-white' : 'bg-white border border-black/[0.08] text-mid hover:border-rose-pale'
              }`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Roční souhrn */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={card}>
          <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">Tržby</div>
          <div className="font-serif text-2xl font-light text-ink">{fmt(Math.round(sum.trzby))}</div>
        </div>
        <div className={card}>
          <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">Materiál a díly</div>
          <div className="font-serif text-2xl font-light text-rose-deep">{fmt(Math.round(sum.material))}</div>
          <div className="text-[0.68rem] text-mid mt-1">{matPct} % z tržeb</div>
        </div>
        <div className={card}>
          <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">Mzdy + režie</div>
          <div className="font-serif text-2xl font-light text-rose-deep">{fmt(Math.round(sum.rezie))}</div>
        </div>
        <div className={`${card} ${sum.zisk >= 0 ? 'bg-green/[0.05]' : 'bg-rose/[0.05]'}`}>
          <div className="text-[0.62rem] tracking-[0.08em] uppercase text-mid mb-1">Provozní zisk (EBITDA)</div>
          <div className={`font-serif text-2xl font-light ${sum.zisk >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(sum.zisk))}</div>
        </div>
      </div>

      {/* Měsíční tabulka */}
      <div className={`${card} overflow-x-auto`}>
        <h4 className="font-serif text-base text-ink mb-4">Po měsících</h4>
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
              <td className="py-2 text-ink">Celkem</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(sum.trzby))}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(sum.material))}</td>
              <td className="py-2 text-right text-ink">{fmt(Math.round(sum.rezie))}</td>
              <td className={`py-2 text-right ${sum.zisk >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(Math.round(sum.zisk))}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[0.72rem] text-mid mt-3">Měsíční rozpad z knih faktur (datum uskutečnění), úrovně sedí na účetní závěrku. „Provozní zisk (EBITDA)“ = tržby − materiál − mzdy a režie (před odpisy a úroky).</p>
      </div>
    </div>
  )
}
