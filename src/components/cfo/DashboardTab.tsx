'use client'

import { useState } from 'react'
import {
  type Ledger, type Tier, type Extra, type CostItem, type Budget,
  type ReceivablesData, type TaxData, type VatData,
  type BusinessProfile, type Recommendation, type TimelineItem,
  calcLedgerMonth, calcCashPosition, calcBreakeven,
  calcRevenue, calcOpex, calcWhatIf, fmt, fmtShort,
} from './calcEngine'
import ActualVsPlanChart from './ActualVsPlanChart'

interface DashboardTabProps {
  ledger: Ledger
  tiers: Tier[]
  extras: Extra[]
  fixedCosts: CostItem[]
  variablePct: number
  budget: Budget
  receivables: ReceivablesData
  taxes: TaxData
  vat: VatData
  profile: BusinessProfile
  recommendations: Recommendation[]
  timeline: TimelineItem[]
  onTabChange: (tab: string) => void
  onProfileChange: (profile: BusinessProfile) => void
}

const CZ_SHORT = ['Led', 'Uno', 'Bre', 'Dub', 'Kve', 'Cvn', 'Cvc', 'Srp', 'Zar', 'Rij', 'Lis', 'Pro']
const CZ_MONTHS = ['ledna', 'unora', 'brezna', 'dubna', 'kvetna', 'cervna', 'cervence', 'srpna', 'zari', 'rijna', 'listopadu', 'prosince']

export default function DashboardTab({
  ledger, tiers, extras, fixedCosts, variablePct, budget,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  receivables, taxes, vat, profile, recommendations, timeline,
  onTabChange, onProfileChange,
}: DashboardTabProps) {
  const [whatIfAmount, setWhatIfAmount] = useState(0)
  const isSimple = profile.complexity === 'simple'

  const cashPos = calcCashPosition(ledger.bank_balance, ledger, 6)
  const be = calcBreakeven(tiers, fixedCosts, variablePct)
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const monthlyEbitda = rev.total - opex.total

  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentML = ledger.months.find(m => m.month === currentMonth)
  const currentStats = currentML ? calcLedgerMonth(currentML.items) : null

  // What-if calculation
  const whatIfResult = whatIfAmount > 0 ? calcWhatIf(
    tiers, extras, fixedCosts, variablePct, budget, ledger.bank_balance,
    { oneTimeExpense: whatIfAmount }
  ) : null

  // Chart data
  const chartMonths = ledger.months.slice(-6).map(m => {
    const stats = calcLedgerMonth(m.items)
    const [y, mo] = m.month.split('-').map(Number)
    return {
      month: `${CZ_SHORT[mo - 1]} ${String(y).slice(-2)}`,
      expected_income: stats.expected_income,
      actual_income: stats.actual_income,
      expected_expense: stats.expected_expense,
      actual_expense: stats.actual_expense,
    }
  })

  // Today
  const today = new Date()
  const todayStr = `${today.getDate()}. ${CZ_MONTHS[today.getMonth()]} ${today.getFullYear()}`

  // Next deadline from timeline
  const nextDeadline = timeline.find(t => t.isDeadline && t.amount < 0)

  // Priority colors
  const priorityStyles = {
    urgent: 'bg-rose/8 border-rose/20 text-rose-deep',
    important: 'bg-amber/8 border-amber/20 text-amber',
    tip: 'bg-green/8 border-green/20 text-green',
  }
  const priorityLabels = { urgent: 'Dulezite', important: 'Doporuceni', tip: 'Tip' }

  return (
    <div className="space-y-6">
      {/* Complexity toggle */}
      <div className="flex justify-end">
        <div className="flex bg-white rounded-full border border-black/[0.06] p-0.5">
          <button
            onClick={() => onProfileChange({ ...profile, complexity: 'simple' })}
            className={`px-4 py-1.5 rounded-full text-[0.68rem] transition-colors ${isSimple ? 'bg-ink text-white' : 'text-mid hover:text-ink'}`}>
            Jednoduche
          </button>
          <button
            onClick={() => onProfileChange({ ...profile, complexity: 'detailed' })}
            className={`px-4 py-1.5 rounded-full text-[0.68rem] transition-colors ${!isSimple ? 'bg-ink text-white' : 'text-mid hover:text-ink'}`}>
            Detailni
          </button>
        </div>
      </div>

      {/* TODAY STATUS */}
      <div className="bg-ink rounded-[20px] p-7 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
        <div className="text-[0.62rem] tracking-[0.12em] uppercase text-white/40 mb-2">{todayStr}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">
              {isSimple ? 'Na uctu' : 'Stav uctu'}
            </div>
            <div className="font-serif text-2xl text-sand font-light">{fmtShort(ledger.bank_balance)}</div>
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">
              {isSimple ? 'Tento mesic' : 'CF tento mesic'}
            </div>
            <div className={`font-serif text-2xl font-light ${(currentStats?.expected_net ?? 0) >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {currentStats ? `${currentStats.expected_net >= 0 ? '+' : ''}${fmtShort(currentStats.expected_net)}` : '...'}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">
              {isSimple ? 'Co zbude' : 'EBITDA/mesic'}
            </div>
            <div className={`font-serif text-2xl font-light ${monthlyEbitda >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {monthlyEbitda >= 0 ? '+' : ''}{fmtShort(monthlyEbitda)}
            </div>
          </div>
          {nextDeadline && (
            <div>
              <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Dalsi platba</div>
              <div className="font-serif text-2xl text-rose-pale font-light">{fmtShort(Math.abs(nextDeadline.amount))}</div>
              <div className="text-[0.62rem] text-white/40 mt-0.5">
                {nextDeadline.daysUntil === 0 ? 'dnes!' : nextDeadline.daysUntil === 1 ? 'zitra' : `za ${nextDeadline.daysUntil} dni`}
                {' '}. {nextDeadline.label}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RECOMMENDATIONS */}
      {recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-mid font-medium">Doporuceni</h3>
          {recommendations.slice(0, 5).map(rec => (
            <div key={rec.id}
              onClick={() => rec.actionTab && onTabChange(rec.actionTab)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm ${priorityStyles[rec.priority]}`}>
              <div className="flex items-start gap-3">
                <span className={`text-[0.55rem] tracking-[0.08em] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                  rec.priority === 'urgent' ? 'bg-rose/20 text-rose-deep' :
                  rec.priority === 'important' ? 'bg-amber/20 text-amber' :
                  'bg-green/20 text-green'
                }`}>
                  {priorityLabels[rec.priority]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.82rem] font-medium text-ink">{rec.title}</div>
                  <div className="text-[0.72rem] text-mid mt-0.5">{rec.detail}</div>
                </div>
                <div className="text-[0.78rem] font-medium flex-shrink-0">{rec.impact}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIMELINE: Upcoming deadlines & payments */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Blizici se terminy</h3>
          <div className="space-y-1.5">
            {timeline.slice(0, 10).map((item, i) => {
              const isUrgent = item.daysUntil <= 3
              const isThisWeek = item.daysUntil <= 7
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isUrgent ? 'bg-rose/[0.06]' : isThisWeek ? 'bg-amber/[0.04]' : 'bg-sand-pale'
                }`}>
                  <div className="w-16 flex-shrink-0">
                    <div className={`text-[0.72rem] font-medium ${isUrgent ? 'text-rose-deep' : 'text-ink'}`}>
                      {item.date.split('-')[2]}.{item.date.split('-')[1]}.
                    </div>
                    <div className="text-[0.58rem] text-mid">
                      {item.daysUntil === 0 ? 'dnes' : item.daysUntil === 1 ? 'zitra' : `za ${item.daysUntil}d`}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8rem] text-ink truncate">{item.label}</div>
                  </div>
                  <div className={`text-[0.82rem] font-medium flex-shrink-0 ${item.amount >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                    {item.amount !== 0 ? fmt(item.amount) : ''}
                  </div>
                  {item.isDeadline && (
                    <span className="text-[0.5rem] tracking-[0.08em] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber/15 text-amber flex-shrink-0">Termin</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* WHAT-IF CALCULATOR */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-1">{isSimple ? 'Muzu si dovolit...?' : 'Simulace investice'}</h3>
        <p className="text-[0.72rem] text-mid mb-4">{isSimple ? 'Zadejte castku a uvidite, co se stane.' : 'Jednora zovy vydaj a jeho dopad na cashflow.'}</p>
        <div className="flex items-center gap-4 mb-4">
          <input
            type="number"
            value={whatIfAmount || ''}
            onChange={e => setWhatIfAmount(Math.max(0, +e.target.value || 0))}
            placeholder="Kolik chcete utratit?"
            className="flex-1 bg-transparent border-b-2 border-black/10 py-2 text-lg font-serif outline-none focus:border-rose transition-colors"
          />
          <span className="text-mid text-sm">Kc</span>
        </div>

        {whatIfResult && whatIfAmount > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-sand-pale rounded-xl p-3">
              <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">{isSimple ? 'Na uctu potom' : 'Zustatek po'}</div>
              <div className={`font-serif text-lg font-light ${whatIfResult.cashAfter >= 0 ? 'text-ink' : 'text-rose-deep'}`}>
                {fmtShort(whatIfResult.cashAfter)}
              </div>
            </div>
            <div className="bg-sand-pale rounded-xl p-3">
              <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">{isSimple ? 'Mesicni zisk' : 'EBITDA/mes'}</div>
              <div className={`font-serif text-lg font-light ${whatIfResult.newEbitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                {whatIfResult.newEbitda >= 0 ? '+' : ''}{fmtShort(whatIfResult.newEbitda)}
              </div>
            </div>
            <div className="bg-sand-pale rounded-xl p-3">
              <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">Runway</div>
              <div className="font-serif text-lg font-light text-ink">
                {whatIfResult.newRunway !== null ? `${whatIfResult.newRunway} mes` : 'ok'}
              </div>
            </div>
            <div className={`rounded-xl p-3 ${whatIfResult.canAfford ? 'bg-green/10' : 'bg-rose/10'}`}>
              <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">Vysledek</div>
              <div className={`font-serif text-lg font-light ${whatIfResult.canAfford ? 'text-green' : 'text-rose-deep'}`}>
                {whatIfResult.canAfford ? 'Muzete' : 'Riziko'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI CARDS - detailed only */}
      {!isSimple && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Break-even</div>
            <div className="font-serif text-xl font-light text-ink leading-none">
              {totalMembers} / {be.members < 999 ? be.members : '?'}
            </div>
            <div className="text-[0.68rem] mt-1 text-mid">
              {be.members < 999 && totalMembers > 0 ? `${Math.round(totalMembers / be.members * 100)}% cile` : ''}
            </div>
          </div>
          <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Mesicni prijem</div>
            <div className="font-serif text-xl font-light text-green leading-none">{fmtShort(rev.total)}</div>
          </div>
          <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Mesicni naklady</div>
            <div className="font-serif text-xl font-light text-rose-deep leading-none">{fmtShort(opex.total)}</div>
          </div>
          <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Projekce 3 mes</div>
            <div className={`font-serif text-xl font-light leading-none ${(cashPos[2]?.closing ?? 0) >= 0 ? 'text-green' : 'text-rose-deep'}`}>
              {cashPos[2] ? fmtShort(cashPos[2].closing) : '...'}
            </div>
          </div>
        </div>
      )}

      {/* CHART */}
      {chartMonths.length > 0 && !isSimple && (
        <ActualVsPlanChart months={chartMonths} />
      )}

      {/* CASH POSITION TABLE - detailed only */}
      {!isSimple && cashPos.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Projekce cash pozice (6 mesicu)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.75rem]">
              <thead>
                <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                  <th className="text-left pb-2 font-medium">Mesic</th>
                  <th className="text-right pb-2 font-medium">Pocatecni</th>
                  <th className="text-right pb-2 font-medium">Prijmy</th>
                  <th className="text-right pb-2 font-medium">Vydaje</th>
                  <th className="text-right pb-2 font-medium">Konecny</th>
                </tr>
              </thead>
              <tbody>
                {cashPos.map((m, i) => {
                  const [y, mo] = m.month.split('-').map(Number)
                  return (
                    <tr key={i} className="border-t border-black/[0.04]">
                      <td className="py-2 text-ink font-medium">{CZ_SHORT[mo - 1]} {String(y).slice(-2)}</td>
                      <td className="py-2 text-right text-mid">{fmt(m.opening)}</td>
                      <td className="py-2 text-right text-green">{fmt(m.expected_in)}</td>
                      <td className="py-2 text-right text-rose-deep">{fmt(m.expected_out)}</td>
                      <td className={`py-2 text-right font-medium ${m.closing >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                        {fmt(m.closing)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
