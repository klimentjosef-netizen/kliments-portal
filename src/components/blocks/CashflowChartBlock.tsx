'use client'

import type { CashflowChartBlock as Props } from './types'

export default function CashflowChartBlock({ title, months, revenue, costs }: Props) {
  const allValues = [...revenue, ...costs.map(c => -c)]
  const maxAbs = Math.max(1, ...allValues.map(Math.abs))

  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5">
      {title && (
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-mid font-medium mb-4">
          {title}
        </p>
      )}

      <div className="flex items-end gap-1.5 sm:gap-3 h-[100px] sm:h-[140px] md:h-[180px]">
        {months.map((m, i) => {
          const rev = revenue[i] || 0
          const cost = costs[i] || 0
          const net = rev - cost
          const heightPct = (Math.abs(net) / maxAbs) * 100
          const positive = net >= 0
          return (
            <div key={m + i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`w-full rounded-t-[4px] transition-all ${positive ? 'bg-[#6b9d7a]' : 'bg-rose-deep'}`}
                style={{ height: `${heightPct}%`, minHeight: 4 }}
                title={`${m}: net ${net.toLocaleString('cs-CZ')} Kč`}
                role="img"
                aria-label={`${m}: čistý cashflow ${net.toLocaleString('cs-CZ')} Kč`}
              />
              <span className="text-[0.55rem] sm:text-[0.62rem] text-mid truncate w-full text-center">{m}</span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[0.7rem] text-mid">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#6b9d7a]" /> kladný cashflow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-deep" /> záporný
        </span>
      </div>
    </div>
  )
}
