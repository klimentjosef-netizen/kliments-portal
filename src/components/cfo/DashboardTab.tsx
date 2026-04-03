'use client'

import {
  type Ledger, type Tier, type Extra, type CostItem, type Budget,
  type ReceivablesData, type TaxData, type VatData,
  calcLedgerMonth, calcAlerts, calcCashPosition, calcBreakeven,
  calcRevenue, calcOpex, fmt, fmtShort,
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
  onTabChange: (tab: string) => void
}

export default function DashboardTab({
  ledger, tiers, extras, fixedCosts, variablePct, budget,
  receivables, taxes, vat, onTabChange,
}: DashboardTabProps) {
  const alerts = calcAlerts(ledger, tiers, fixedCosts, variablePct, budget, receivables, taxes, vat)
  const cashPos = calcCashPosition(ledger.bank_balance, ledger, 6)
  const be = calcBreakeven(tiers, fixedCosts, variablePct)
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const monthlyEbitda = rev.total - opex.total

  // Current month stats
  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentML = ledger.months.find(m => m.month === currentMonth)
  const currentStats = currentML ? calcLedgerMonth(currentML.items) : null

  // Prepare chart data from ledger months
  const CZ_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
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

  // Upcoming payments (next 5 expected outflows)
  const upcoming: Array<{ description: string; amount: number; date: string }> = []
  for (const m of ledger.months) {
    for (const item of m.items) {
      if (item.status === 'expected' && item.amount_expected < 0) {
        upcoming.push({ description: item.description, amount: item.amount_expected, date: item.date })
      }
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date))
  const next5 = upcoming.slice(0, 5)

  // Overdue invoices
  const overdue = receivables.invoices_issued.filter(i => i.status === 'overdue' || (i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()))
  const overdueTotal = overdue.reduce((s, i) => s + i.total, 0)

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id}
              onClick={() => alert.tab && onTabChange(alert.tab)}
              className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                alert.severity === 'critical' ? 'bg-[#fdf0f0] border-rose/20 hover:border-rose/40' :
                alert.severity === 'warning' ? 'bg-[#fff8f0] border-amber/20 hover:border-amber/40' :
                'bg-[#eef6f1] border-green/20 hover:border-green/40'
              }`}>
              <div className="flex items-start gap-3">
                <span className={`text-[0.58rem] tracking-[0.1em] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                  alert.severity === 'critical' ? 'bg-rose/20 text-rose-deep' :
                  alert.severity === 'warning' ? 'bg-amber/20 text-amber' :
                  'bg-green/20 text-green'
                }`}>
                  {alert.severity === 'critical' ? 'KRITICKÉ' : alert.severity === 'warning' ? 'UPOZORNĚNÍ' : 'INFO'}
                </span>
                <div>
                  <div className="text-[0.82rem] font-medium text-ink">{alert.message}</div>
                  {alert.detail && <div className="text-[0.72rem] text-mid mt-0.5">{alert.detail}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Stav účtu</div>
          <div className="font-serif text-xl font-light text-ink leading-none">{fmtShort(ledger.bank_balance)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">aktuální zůstatek</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">CF tento měsíc</div>
          <div className={`font-serif text-xl font-light leading-none ${(currentStats?.actual_net ?? 0) >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {currentStats ? fmtShort(currentStats.actual_net) : '···'}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">
            {currentStats ? `${currentStats.variance_pct >= 0 ? '+' : ''}${currentStats.variance_pct}% vs plán` : 'žádná data'}
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Break-even</div>
          <div className="font-serif text-xl font-light text-ink leading-none">
            {totalMembers} / {be.members < 999 ? be.members : '?'}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">
            {be.members < 999 ? `${Math.round(totalMembers / be.members * 100)}% cíle` : '···'}
          </div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Plánovaná EBITDA</div>
          <div className={`font-serif text-xl font-light leading-none ${monthlyEbitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {fmtShort(monthlyEbitda)}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">/měsíc</div>
        </div>
      </div>

      {/* Actual vs Plan chart */}
      {chartMonths.length > 0 && (
        <ActualVsPlanChart months={chartMonths} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming payments */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Nadcházející platby</h3>
          {next5.length === 0 ? (
            <p className="text-[0.8rem] text-mid">Žádné nadcházející platby.</p>
          ) : (
            <div className="space-y-2">
              {next5.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-black/[0.04] last:border-0">
                  <div>
                    <div className="text-[0.8rem] text-ink">{p.description}</div>
                    <div className="text-[0.65rem] text-mid">{new Date(p.date).toLocaleDateString('cs-CZ')}</div>
                  </div>
                  <div className="text-[0.82rem] font-medium text-rose-deep">{fmt(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Přehled</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[0.8rem] text-mid">Pohledávky po splatnosti</span>
              <span className={`text-[0.82rem] font-medium ${overdueTotal > 0 ? 'text-rose-deep' : 'text-green'}`}>
                {overdueTotal > 0 ? `${overdue.length}× ${fmt(overdueTotal)}` : 'Žádné'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[0.8rem] text-mid">Projekce za 3 měsíce</span>
              <span className={`text-[0.82rem] font-medium ${(cashPos[2]?.closing ?? 0) >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                {cashPos[2] ? fmtShort(cashPos[2].closing) : '···'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[0.8rem] text-mid">Plánovaný měsíční příjem</span>
              <span className="text-[0.82rem] font-medium text-ink">{fmtShort(rev.total)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[0.8rem] text-mid">Plánované měsíční náklady</span>
              <span className="text-[0.82rem] font-medium text-ink">{fmtShort(opex.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cash position forecast */}
      {cashPos.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Projekce cash pozice (6 měsíců)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.75rem]">
              <thead>
                <tr className="text-[0.6rem] tracking-[0.1em] uppercase text-mid">
                  <th className="text-left pb-2 font-medium">Měsíc</th>
                  <th className="text-right pb-2 font-medium">Počáteční</th>
                  <th className="text-right pb-2 font-medium">Příjmy</th>
                  <th className="text-right pb-2 font-medium">Výdaje</th>
                  <th className="text-right pb-2 font-medium">Konečný</th>
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
