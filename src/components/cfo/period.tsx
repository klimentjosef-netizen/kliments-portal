'use client'

// Jednotný časový kontext napříč portálem: jasné roky + co je živě.
//  · live     = letošní rok (rozpracovaný, plní se po měsících)
//  · actual   = uzavřený rok (hotová ověřená skutečnost, informativní)
//  · forecast = plán / simulace (ne data)
import { type Ledger } from './calcEngine'

export type PeriodKind = 'live' | 'actual' | 'forecast'

const META: Record<PeriodKind, { label: string; color: string; cls: string }> = {
  live: { label: 'Živě', color: '#7bbf8a', cls: 'bg-green/[0.08] text-green border-green/20' },
  actual: { label: 'Skutečnost', color: '#b0a89e', cls: 'bg-black/[0.04] text-mid border-black/10' },
  forecast: { label: 'Výhled', color: '#88aedd', cls: 'bg-[#88aedd]/10 text-[#5a7fb0] border-[#88aedd]/30' },
}

export function PeriodBadge({ kind, text }: { kind: PeriodKind; text?: string }) {
  const m = META[kind]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.7rem] font-medium border ${m.cls}`}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
      {text || m.label}
    </span>
  )
}

// Info o letech v ledgeru: kolik měsíců letošního roku je naplněno, které roky jsou uzavřené.
export function ledgerYearInfo(ledger: Ledger) {
  const currentYear = new Date().getFullYear()
  const counts: Record<string, number> = {}
  for (const m of ledger.months) if (m.items.length > 0) {
    const y = m.month.slice(0, 4)
    counts[y] = (counts[y] || 0) + 1
  }
  const years = Object.keys(counts).sort()
  const closedYears = years.filter((y) => Number(y) < currentYear)
  const liveMonths = counts[String(currentYear)] || 0
  return { currentYear, closedYears, liveMonths, counts }
}

// Pruh období — zobrazuje se nahoře na CFO stránce, aby bylo pořád jasné „kdy".
export function PeriodStrip({ ledger }: { ledger: Ledger }) {
  const { currentYear, closedYears, liveMonths } = ledgerYearInfo(ledger)
  const lastClosed = closedYears[closedYears.length - 1]
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl px-4 py-3 mb-6 border border-black/[0.06]">
      <span className="text-[0.6rem] tracking-[0.14em] uppercase text-mid font-medium">Období</span>
      <PeriodBadge kind="live" text={`Letošní rok ${currentYear}: ${liveMonths > 0 ? `${liveMonths}/12 měsíců` : 'zatím bez dat'}`} />
      {lastClosed && <PeriodBadge kind="actual" text={`Uzavřené roky: ${closedYears.join(', ')}`} />}
      {liveMonths === 0 && (
        <span className="text-[0.72rem] text-mid">
          Čísla v portálu jsou informativní za uzavřené roky. Letošek se rozjede, až doplníte první měsíc (záložka „Doplnit data“).
        </span>
      )}
    </div>
  )
}
