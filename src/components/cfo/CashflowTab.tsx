'use client'

import dynamic from 'next/dynamic'
import {
  type Tier, type Extra, type CostItem, type Budget,
  calcRevenue, calcOpex, calcBreakeven, calcCapexRoi,
  calcScenarios, calcCashflowProjection, fmt, fmtShort,
} from './calcEngine'
import ProgressBar from './ProgressBar'

const CashflowChart = dynamic(() => import('./CashflowChart'), { ssr: false })
const DoughnutChart = dynamic(() => import('./DoughnutChart'), { ssr: false })

interface CashflowTabProps {
  tiers: Tier[]
  extras: Extra[]
  fixedCosts: CostItem[]
  variablePct: number
  budget: Budget
  rampMonths: number
  projectionMonths: number
  onRampMonthsChange?: (v: number) => void
  onProjectionMonthsChange?: (v: number) => void
}

export default function CashflowTab({ tiers, extras, fixedCosts, variablePct, budget, rampMonths, projectionMonths, onRampMonthsChange, onProjectionMonthsChange }: CashflowTabProps) {
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const ebitda = rev.total - opex.total
  const be = calcBreakeven(tiers, fixedCosts, variablePct)
  const roi = calcCapexRoi(budget.capex_budget, ebitda)
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  const bePct = be.members < 999 ? Math.min(100, Math.round(totalMembers / be.members * 100)) : 0

  const projection = calcCashflowProjection(tiers, extras, fixedCosts, variablePct, budget, projectionMonths, rampMonths)
  const scenarios = calcScenarios(tiers, extras, fixedCosts, variablePct, [5, 10, 15, 20, 30, 40, 50])

  // Revenue mix for doughnut
  const revMix = [
    ...rev.tierBreakdown.filter(t => t.revenue > 0).map(t => ({ label: `${t.name} (${t.members}×)`, amount: t.revenue })),
    ...rev.extraBreakdown.filter(e => e.revenue > 0).map(e => ({ label: e.name, amount: e.revenue })),
  ]

  return (
    <div className="space-y-6">
      {/* KPI metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Měsíční příjem</div>
          <div className="font-serif text-xl font-light text-rose leading-none">{fmtShort(rev.total)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">{totalMembers} členů</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">EBITDA / měsíc</div>
          <div className={`font-serif text-xl font-light leading-none ${ebitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {ebitda >= 0 ? '+' : ''}{fmtShort(ebitda)}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">{ebitda >= 0 ? 'zisk' : 'ztráta'}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Break-even</div>
          <div className="font-serif text-xl font-light text-ink leading-none">{be.members < 999 ? `${be.members} členů` : '—'}</div>
          <div className="text-[0.68rem] mt-1 text-mid">při avg {Math.round(be.avgPrice).toLocaleString('cs-CZ')} Kč</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Návratnost CAPEX</div>
          <div className="font-serif text-xl font-light text-ink leading-none">
            {roi < 999 ? `${roi} měs` : '—'}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">{roi > 36 ? '> 3 roky' : roi < 999 ? '< 3 roky' : 'nejdříve dosáhni zisku'}</div>
        </div>
      </div>

      {/* Break-even progress */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-1">Obsazenost vůči break-even</h3>
        <div className="font-serif text-2xl text-ink font-light mt-2 mb-3">
          {totalMembers} / {be.members < 999 ? be.members : '?'} členů
        </div>
        <ProgressBar value={totalMembers} max={be.members < 999 ? be.members : 100} showPercent />
        <div className="text-[0.68rem] text-mid mt-2">{bePct} % break-even</div>
      </div>

      {/* Cashflow projection chart */}
      {/* Ramp & projection settings */}
      {(onRampMonthsChange || onProjectionMonthsChange) && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-3">Nastavení projekce</h3>
          <div className="flex gap-6">
            <div>
              <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid block mb-1">Ramp-up (měsíce)</label>
              <input
                type="number"
                value={rampMonths}
                min={1}
                max={36}
                onChange={e => onRampMonthsChange?.(Math.max(1, Math.min(36, +e.target.value || 1)))}
                className="w-24 bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose text-right transition-colors"
              />
            </div>
            <div>
              <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid block mb-1">Projekce (měsíce)</label>
              <input
                type="number"
                value={projectionMonths}
                min={6}
                max={60}
                onChange={e => onProjectionMonthsChange?.(Math.max(6, Math.min(60, +e.target.value || 6)))}
                className="w-24 bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose text-right transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {projection.length > 0 && (
        <CashflowChart months={projection} title={`Cashflow — ${projectionMonths} měsíční projekce`} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scenario table */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Scénáře</h3>
          <table className="w-full text-[0.8rem]">
            <thead>
              <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                <th className="text-left pb-2 font-medium">Scénář</th>
                <th className="text-right pb-2 font-medium">EBITDA/měs</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr key={i} className={`border-t border-black/[0.04] ${s.members === totalMembers ? 'bg-sand-pale' : ''}`}>
                  <td className="py-2 text-ink font-medium">
                    {s.members === totalMembers ? '► ' : ''}{s.members} členů
                  </td>
                  <td className={`py-2 text-right font-medium ${s.ebitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                    {s.ebitda >= 0 ? '+' : ''}{fmt(s.ebitda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Revenue mix */}
        {revMix.length > 0 && (
          <DoughnutChart items={revMix} title="Složení příjmů" />
        )}
      </div>

      {/* Monthly breakdown table */}
      {projection.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06] overflow-x-auto">
          <h3 className="font-serif text-base text-ink mb-4">Měsíční projekce</h3>
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                <th className="text-left pb-2 font-medium">Měsíc</th>
                <th className="text-right pb-2 font-medium">Příjmy</th>
                <th className="text-right pb-2 font-medium">Náklady</th>
                <th className="text-right pb-2 font-medium">EBITDA</th>
                <th className="text-right pb-2 font-medium">Kumulativní</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((m, i) => (
                <tr key={i} className="border-t border-black/[0.04]">
                  <td className="py-2 text-ink font-medium">{m.label}</td>
                  <td className="py-2 text-right text-mid">{m.revenue.toLocaleString('cs-CZ')} Kč</td>
                  <td className="py-2 text-right text-mid">{m.costs.toLocaleString('cs-CZ')} Kč</td>
                  <td className={`py-2 text-right font-medium ${m.ebitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                    {m.ebitda.toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className={`py-2 text-right font-medium ${m.cumulative >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                    {m.cumulative.toLocaleString('cs-CZ')} Kč
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
