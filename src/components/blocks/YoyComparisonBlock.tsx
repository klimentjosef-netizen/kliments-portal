import type { YoyComparisonBlock as Props, YoyRow } from './types'

function fmtValue(v: number | null, format: YoyRow['format']): string {
  if (v === null || v === undefined || isNaN(v)) return '·'
  if (format === 'percent') return `${v.toFixed(1)} %`
  if (format === 'number') return v.toLocaleString('cs-CZ')
  // default: currency
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} mil. Kč`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)} tis. Kč`
  return `${Math.round(v)} Kč`
}

function changePct(prev: number | null, curr: number | null): number | null {
  if (prev === null || curr === null || isNaN(prev) || isNaN(curr) || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function trendBadge(prev: number | null, curr: number | null, higherIsBetter: boolean): {
  text: string; cls: string
} | null {
  const pct = changePct(prev, curr)
  if (pct === null) return null
  const absStr = `${Math.abs(pct).toFixed(1)} %`
  const isUp = pct > 0
  const good = higherIsBetter ? isUp : !isUp
  if (Math.abs(pct) < 0.5) return { text: '→ stabilní', cls: 'text-mid' }
  const arrow = isUp ? '↑' : '↓'
  const cls = good
    ? 'text-[#4f7a5e]'
    : 'text-rose-deep'
  return { text: `${arrow} ${absStr}`, cls }
}

export default function YoyComparisonBlock({ title, years, rows, note }: Props) {
  if (years.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-rose-pale bg-rose-blush/10 p-5 text-sm text-mid">
        {title && <p className="font-medium text-ink mb-1">{title}</p>}
        Pro YoY srovnání chybí data. Naimportujte transakce v záložce <code className="bg-sand px-1.5 py-0.5 rounded text-rose">Import dat</code>.
      </div>
    )
  }

  // Posledni rok je "vlevo nejvic vpravo" · aktualni stav
  const sortedYears = [...years].sort((a, b) => a - b)

  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5 overflow-x-auto">
      {title && (
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-mid font-medium mb-4">
          {title}
        </p>
      )}
      <table className="w-full min-w-[480px] text-left">
        <thead>
          <tr className="border-b border-black/[0.06]">
            <th className="py-2.5 pr-4 text-[0.62rem] uppercase tracking-[0.14em] text-mid font-medium">
              Ukazatel
            </th>
            {sortedYears.map(y => (
              <th key={y} scope="col" className="py-2.5 px-3 text-right text-[0.62rem] uppercase tracking-[0.14em] text-mid font-medium">
                {y}
              </th>
            ))}
            {sortedYears.length >= 2 && (
              <th scope="col" className="py-2.5 pl-3 text-right text-[0.62rem] uppercase tracking-[0.14em] text-mid font-medium">
                YoY (poslední vs. předchozí)
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const higherIsBetter = r.higherIsBetter !== false
            // Hodnoty seradit dle sortedYears (vstup je v poradi years, ale years nemusi byt setrideny)
            const valuesByYear = new Map<number, number | null>()
            r.values.forEach((v, idx) => {
              const y = years[idx]
              if (y !== undefined) valuesByYear.set(y, v ?? null)
            })
            const orderedValues = sortedYears.map(y => valuesByYear.get(y) ?? null)
            const last = orderedValues[orderedValues.length - 1] ?? null
            const prev = orderedValues[orderedValues.length - 2] ?? null
            const trend = sortedYears.length >= 2 ? trendBadge(prev, last, higherIsBetter) : null

            const rowCls = r.highlight
              ? 'bg-rose-blush/30 font-medium'
              : ''

            return (
              <tr key={i} className={`border-t border-black/[0.04] ${rowCls}`}>
                <td className={`py-2.5 pr-4 text-[0.85rem] ${r.highlight ? 'text-ink font-medium' : 'text-ink-soft'}`}>
                  {r.label}
                </td>
                {orderedValues.map((v, j) => (
                  <td key={j} className="py-2.5 px-3 text-[0.85rem] text-right font-mono tabular-nums text-ink">
                    {fmtValue(v, r.format)}
                  </td>
                ))}
                {sortedYears.length >= 2 && (
                  <td className="py-2.5 pl-3 text-right text-[0.78rem] font-medium tabular-nums">
                    {trend ? <span className={trend.cls}>{trend.text}</span> : <span className="text-mid">·</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {note && <p className="text-[0.72rem] text-mid mt-3">{note}</p>}
    </div>
  )
}
