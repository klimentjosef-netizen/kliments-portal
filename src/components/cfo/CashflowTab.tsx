'use client'

import { useState } from 'react'
import {
  type Tier, type Extra, type CostItem, type Budget, type Ledger,
  calcRevenue, calcOpex, calcBreakeven, calcCapexRoi,
  calcScenarios, calcHybridCashflow, calcWhatIf, fmt, fmtShort,
} from './calcEngine'
import ProgressBar from './ProgressBar'
import CashflowChart from './CashflowChart'
import DoughnutChart from './DoughnutChart'

interface CashflowTabProps {
  tiers: Tier[]
  extras: Extra[]
  fixedCosts: CostItem[]
  variablePct: number
  budget: Budget
  rampMonths: number
  projectionMonths: number
  startOffset: number
  businessStartMonth: string
  ledger: Ledger
  complexity: 'simple' | 'detailed'
  bankBalance: number
  onRampMonthsChange?: (v: number) => void
  onProjectionMonthsChange?: (v: number) => void
  onBusinessStartMonthChange?: (v: string) => void
}

export default function CashflowTab({ tiers, extras, fixedCosts, variablePct, budget, rampMonths, projectionMonths, startOffset, businessStartMonth, ledger, complexity, bankBalance, onRampMonthsChange, onProjectionMonthsChange, onBusinessStartMonthChange }: CashflowTabProps) {
  const [wiMembers, setWiMembers] = useState(0)
  const [wiPrice, setWiPrice] = useState(0)
  const [wiCost, setWiCost] = useState(0)
  const [wiLose, setWiLose] = useState(0)
  const isSimple = complexity === 'simple'
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const ebitda = rev.total - opex.total
  const be = calcBreakeven(tiers, fixedCosts, variablePct)
  const roi = calcCapexRoi(budget.capex_budget, ebitda)
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  const bePct = be.members < 999 ? Math.min(100, Math.round(totalMembers / be.members * 100)) : 0

  const projection = calcHybridCashflow(ledger, tiers, extras, fixedCosts, variablePct, budget, projectionMonths, rampMonths, startOffset)
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
          <div className="font-serif text-xl font-light text-ink leading-none">{be.members < 999 ? `${be.members} členů` : '···'}</div>
          <div className="text-[0.68rem] mt-1 text-mid">při avg {Math.round(be.avgPrice).toLocaleString('cs-CZ')} Kč</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Návratnost CAPEX</div>
          <div className="font-serif text-xl font-light text-ink leading-none">
            {roi < 999 ? `${roi} měs` : '···'}
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

      {/* Ramp & projection settings */}
      {(onRampMonthsChange || onProjectionMonthsChange || onBusinessStartMonthChange) && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-3">Nastavení projekce</h3>
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid block mb-1">Zahájení podnikání</label>
              <input
                type="month"
                value={businessStartMonth}
                onChange={e => onBusinessStartMonthChange?.(e.target.value)}
                className="w-40 bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors"
              />
              {!businessStartMonth && (
                <div className="text-[0.6rem] text-mid/60 mt-1">Nenastaveno. Ramp se nepočítá.</div>
              )}
            </div>
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
        <CashflowChart months={projection} title={`Cashflow: ${projectionMonths}M projekce`} />
      )}

      {/* WHAT-IF SIMULATOR */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-1">{isSimple ? 'Co kdyz...?' : 'Simulator scenaru'}</h3>
        <p className="text-[0.72rem] text-mid mb-4">Pohybujte hodnotami a sledujte dopad na {isSimple ? 'zisk' : 'EBITDA'}.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-green block mb-1">Pridat clenu</label>
            <input type="range" min={0} max={30} value={wiMembers} onChange={e => setWiMembers(+e.target.value)}
              className="w-full accent-green" />
            <div className="text-right text-[0.75rem] text-green font-medium">+{wiMembers}</div>
          </div>
          <div>
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-rose-deep block mb-1">Ztratit clenu</label>
            <input type="range" min={0} max={Math.min(totalMembers, 20)} value={wiLose} onChange={e => setWiLose(+e.target.value)}
              className="w-full accent-rose" />
            <div className="text-right text-[0.75rem] text-rose-deep font-medium">-{wiLose}</div>
          </div>
          <div>
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid block mb-1">Zmena cen (%)</label>
            <input type="range" min={-20} max={20} value={wiPrice} onChange={e => setWiPrice(+e.target.value)}
              className="w-full" />
            <div className="text-right text-[0.75rem] text-ink font-medium">{wiPrice > 0 ? '+' : ''}{wiPrice}%</div>
          </div>
          <div>
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid block mb-1">Snizeni nakladu (Kc)</label>
            <input type="range" min={0} max={Math.round(fixedCosts.reduce((s, c) => s + c.amount, 0) * 0.5)} step={1000} value={wiCost} onChange={e => setWiCost(+e.target.value)}
              className="w-full" />
            <div className="text-right text-[0.75rem] text-ink font-medium">{wiCost > 0 ? `-${fmtShort(wiCost)}` : '0'}</div>
          </div>
        </div>

        {(() => {
          const hasChange = wiMembers > 0 || wiLose > 0 || wiPrice !== 0 || wiCost > 0
          if (!hasChange) return null
          const result = calcWhatIf(tiers, extras, fixedCosts, variablePct, budget, bankBalance, {
            addMembers: wiMembers, loseMembers: wiLose, priceChangePct: wiPrice, costReduction: wiCost,
          })
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-black/[0.06]">
              <div className="bg-sand-pale rounded-xl p-3">
                <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">{isSimple ? 'Nyni' : 'Aktualni EBITDA'}</div>
                <div className={`font-serif text-lg font-light ${result.currentEbitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                  {fmtShort(result.currentEbitda)}
                </div>
              </div>
              <div className="bg-sand-pale rounded-xl p-3">
                <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">{isSimple ? 'Po zmene' : 'Nova EBITDA'}</div>
                <div className={`font-serif text-lg font-light ${result.newEbitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                  {fmtShort(result.newEbitda)}
                </div>
              </div>
              <div className={`rounded-xl p-3 ${result.ebitdaDelta >= 0 ? 'bg-green/10' : 'bg-rose/10'}`}>
                <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">Rozdil</div>
                <div className={`font-serif text-lg font-light ${result.ebitdaDelta >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                  {result.ebitdaDelta >= 0 ? '+' : ''}{fmtShort(result.ebitdaDelta)}
                </div>
              </div>
              <div className="bg-sand-pale rounded-xl p-3">
                <div className="text-[0.58rem] tracking-[0.1em] uppercase text-mid mb-1">Break-even</div>
                <div className="font-serif text-lg font-light text-ink">
                  {result.breakEvenAfter.members < 999 ? `${result.breakEvenAfter.members} clenu` : '...'}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scenario table - detailed only */}
        {!isSimple && (
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
            <h3 className="font-serif text-base text-ink mb-4">Scenare</h3>
            <table className="w-full text-[0.8rem]">
              <thead>
                <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                  <th className="text-left pb-2 font-medium">Scenar</th>
                  <th className="text-right pb-2 font-medium">EBITDA/mes</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => (
                  <tr key={i} className={`border-t border-black/[0.04] ${s.members === totalMembers ? 'bg-sand-pale' : ''}`}>
                    <td className="py-2 text-ink font-medium">
                      {s.members === totalMembers ? '> ' : ''}{s.members} clenu
                    </td>
                    <td className={`py-2 text-right font-medium ${s.ebitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                      {s.ebitda >= 0 ? '+' : ''}{fmt(s.ebitda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Revenue mix */}
        {revMix.length > 0 && (
          <DoughnutChart items={revMix} title={isSimple ? 'Odkud prijmy jdou' : 'Slozeni prijmu'} />
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
                <tr key={i} className={`border-t border-black/[0.04] ${m.isActual ? 'bg-green/[0.04]' : ''}`}>
                  <td className="py-2 text-ink font-medium">
                    {m.label}{m.isActual ? ' \u25cf' : ''}
                  </td>
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
