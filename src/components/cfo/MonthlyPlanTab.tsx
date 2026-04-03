'use client'

import { useState } from 'react'
import {
  type Ledger, type MonthLedger, type LedgerItem, type ItemStatus, type ExpectedSource,
  calcLedgerMonth, genId, fmt, fmtShort,
} from './calcEngine'

interface MonthlyPlanTabProps {
  ledger: Ledger
  onLedgerChange: (ledger: Ledger) => void
}

const SOURCE_LABELS: Record<ExpectedSource, string> = {
  tier_revenue: 'Z ceníku',
  extra_revenue: 'Doplňkový příjem',
  fixed_cost: 'Fixní náklad',
  tax_advance: 'Daňová záloha',
  social: 'Sociální',
  health: 'Zdravotní',
  vat_payment: 'DPH',
  invoice: 'Faktura',
  bill: 'Přijatá faktura',
  manual: 'Manuální',
}

const SOURCE_COLORS: Record<ExpectedSource, string> = {
  tier_revenue: 'bg-green/10 text-green',
  extra_revenue: 'bg-green/10 text-green',
  fixed_cost: 'bg-rose/10 text-rose-deep',
  tax_advance: 'bg-amber/10 text-amber',
  social: 'bg-[#d4e8f5] text-[#2a6496]',
  health: 'bg-[#d4f5e0] text-[#2a7d4a]',
  vat_payment: 'bg-[#e0d4f5] text-[#6b3fa0]',
  invoice: 'bg-green/10 text-green',
  bill: 'bg-rose/10 text-rose-deep',
  manual: 'bg-black/5 text-mid',
}

// Status labels available for future use
// expected = Očekáváno, confirmed = Potvrzeno, paid = Zaplaceno, skipped = Přeskočeno

function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string): string {
  const CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
  const [y, mo] = m.split('-').map(Number)
  return `${CZ[mo - 1]} ${y}`
}

function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyPlanTab({ ledger, onLedgerChange }: MonthlyPlanTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const currentML = ledger.months.find(m => m.month === selectedMonth)
  const items = currentML?.items || []
  const isLocked = currentML?.locked ?? false
  const stats = calcLedgerMonth(items)

  const expectedItems = items.filter(i => i.source !== 'manual')
  const manualItems = items.filter(i => i.source === 'manual')

  function getOrCreateMonth(month: string): MonthLedger {
    return ledger.months.find(m => m.month === month) || { month, items: [], locked: false }
  }

  function updateMonthItems(month: string, newItems: LedgerItem[], locked?: boolean) {
    const months = ledger.months.filter(m => m.month !== month)
    months.push({ month, items: newItems, locked: locked ?? (currentML?.locked ?? false) })
    months.sort((a, b) => a.month.localeCompare(b.month))
    onLedgerChange({ ...ledger, months })
  }

  function confirmItem(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => {
      if (i.id !== id) return i
      return { ...i, status: 'paid' as ItemStatus, amount_actual: i.amount_actual || i.amount_expected }
    })
    updateMonthItems(selectedMonth, newItems)
  }

  function skipItem(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => i.id === id ? { ...i, status: 'skipped' as ItemStatus } : i)
    updateMonthItems(selectedMonth, newItems)
  }

  function reopenItem(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => i.id === id ? { ...i, status: 'expected' as ItemStatus, amount_actual: 0 } : i)
    updateMonthItems(selectedMonth, newItems)
  }

  function updateActualAmount(id: string, amount: number) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => i.id === id ? { ...i, amount_actual: amount } : i)
    updateMonthItems(selectedMonth, newItems)
  }

  function addManualItem() {
    const m = getOrCreateMonth(selectedMonth)
    const today = new Date().toISOString().slice(0, 10)
    const newItem: LedgerItem = {
      id: genId(),
      date: today,
      description: '',
      category: 'revenue',
      source: 'manual',
      amount_expected: 0,
      amount_actual: 0,
      status: 'expected',
    }
    updateMonthItems(selectedMonth, [...m.items, newItem])
  }

  function updateManualItem(id: string, patch: Partial<LedgerItem>) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, ...patch }
      // Sync expected = actual for manual items
      if ('amount_expected' in patch) updated.amount_actual = patch.amount_expected!
      return updated
    })
    updateMonthItems(selectedMonth, newItems)
  }

  function removeItem(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    updateMonthItems(selectedMonth, m.items.filter(i => i.id !== id))
  }

  function lockMonth() {
    const m = getOrCreateMonth(selectedMonth)
    updateMonthItems(selectedMonth, m.items, true)
  }

  function unlockMonth() {
    const m = getOrCreateMonth(selectedMonth)
    updateMonthItems(selectedMonth, m.items, false)
  }

  function updateBankBalance(value: number) {
    onLedgerChange({ ...ledger, bank_balance: value })
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Stav účtu</div>
          <input type="number" value={ledger.bank_balance || ''}
            onChange={e => updateBankBalance(+e.target.value || 0)}
            className="font-serif text-lg font-light text-ink leading-none bg-transparent outline-none border-b border-transparent focus:border-rose w-full" />
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Očekávané příjmy</div>
          <div className="font-serif text-lg font-light text-green leading-none">{fmtShort(stats.expected_income)}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Skutečné příjmy</div>
          <div className="font-serif text-lg font-light text-green leading-none">{fmtShort(stats.actual_income)}</div>
          <div className="text-[0.62rem] mt-0.5 text-mid">{stats.expected_income > 0 ? `${Math.round(stats.actual_income / stats.expected_income * 100)}% plánu` : ''}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Očekávané výdaje</div>
          <div className="font-serif text-lg font-light text-rose-deep leading-none">{fmtShort(stats.expected_expense)}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Odchylka</div>
          <div className={`font-serif text-lg font-light leading-none ${stats.variance_pct >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {stats.variance_pct >= 0 ? '+' : ''}{stats.variance_pct}%
          </div>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between bg-white rounded-[20px] p-4 border border-black/[0.06]">
        <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          className="px-3 py-1.5 rounded-lg text-mid hover:text-ink hover:bg-sand transition-colors text-sm">← Předchozí</button>
        <div className="text-center">
          <h3 className="font-serif text-lg text-ink">{monthLabel(selectedMonth)}</h3>
          {isLocked && <span className="text-[0.6rem] tracking-[0.1em] uppercase text-green font-semibold">🔒 Uzavřeno</span>}
        </div>
        <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          className="px-3 py-1.5 rounded-lg text-mid hover:text-ink hover:bg-sand transition-colors text-sm">Další →</button>
      </div>

      {/* Expected items */}
      {expectedItems.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Plánované položky</h3>
          <div className="space-y-2">
            {expectedItems.map(item => (
              <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                item.status === 'paid' ? 'bg-[#eef6f1] border-green/10' :
                item.status === 'skipped' ? 'bg-black/[0.02] border-black/[0.04] opacity-50' :
                item.status === 'confirmed' ? 'bg-[#eef6f1] border-green/10' :
                'bg-sand-pale border-black/[0.04]'
              }`}>
                {/* Source badge */}
                <span className={`text-[0.55rem] tracking-[0.08em] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${SOURCE_COLORS[item.source]}`}>
                  {SOURCE_LABELS[item.source]}
                </span>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <div className={`text-[0.8rem] font-medium ${item.status === 'skipped' ? 'line-through text-mid' : 'text-ink'}`}>
                    {item.description}
                  </div>
                </div>

                {/* Expected amount */}
                <div className="text-right flex-shrink-0 w-24">
                  <div className="text-[0.55rem] text-mid uppercase">Plán</div>
                  <div className={`text-[0.78rem] font-medium ${item.amount_expected >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                    {fmt(item.amount_expected)}
                  </div>
                </div>

                {/* Actual amount (editable when not skipped) */}
                {item.status !== 'skipped' && (
                  <div className="text-right flex-shrink-0 w-28">
                    <div className="text-[0.55rem] text-mid uppercase">Skutečnost</div>
                    {item.status === 'expected' ? (
                      <div className="text-[0.78rem] text-mid">···</div>
                    ) : (
                      <input type="number" value={item.amount_actual || ''}
                        onChange={e => updateActualAmount(item.id, +e.target.value || 0)}
                        className="w-full bg-transparent text-[0.78rem] text-right font-medium outline-none border-b border-transparent focus:border-rose"
                        disabled={isLocked} />
                    )}
                  </div>
                )}

                {/* Actions */}
                {!isLocked && (
                  <div className="flex gap-1 flex-shrink-0">
                    {item.status === 'expected' && (
                      <>
                        <button onClick={() => confirmItem(item.id)}
                          className="text-[0.55rem] tracking-[0.08em] uppercase font-semibold px-2 py-1 rounded bg-green/10 text-green hover:bg-green/20 transition-colors">
                          Potvrdit
                        </button>
                        <button onClick={() => skipItem(item.id)}
                          className="text-[0.55rem] tracking-[0.08em] uppercase font-semibold px-2 py-1 rounded bg-black/5 text-mid hover:bg-rose/10 hover:text-rose-deep transition-colors">
                          Přeskočit
                        </button>
                      </>
                    )}
                    {(item.status === 'confirmed' || item.status === 'paid' || item.status === 'skipped') && (
                      <button onClick={() => reopenItem(item.id)}
                        className="text-[0.55rem] tracking-[0.08em] uppercase font-semibold px-2 py-1 rounded bg-black/5 text-mid hover:bg-amber/10 hover:text-amber transition-colors">
                        Znovu otevřít
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual items */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Manuální položky</h3>
          {!isLocked && (
            <button onClick={addManualItem}
              className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
              + Přidat pohyb
            </button>
          )}
        </div>
        {manualItems.length === 0 ? (
          <p className="text-[0.8rem] text-mid text-center py-2">Žádné manuální položky.</p>
        ) : (
          <div className="space-y-2">
            {manualItems.map(item => (
              <div key={item.id} className="grid grid-cols-[90px_1fr_120px_30px] gap-2 items-center">
                <input type="date" value={item.date}
                  onChange={e => updateManualItem(item.id, { date: e.target.value })}
                  className="bg-transparent border-b border-black/10 py-1 text-xs outline-none focus:border-rose" disabled={isLocked} />
                <input value={item.description}
                  onChange={e => updateManualItem(item.id, { description: e.target.value })}
                  placeholder="Popis položky"
                  className="bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose" disabled={isLocked} />
                <input type="number" value={item.amount_expected || ''}
                  onChange={e => updateManualItem(item.id, { amount_expected: +e.target.value || 0 })}
                  placeholder="Částka"
                  className={`bg-transparent border-b border-black/10 py-1.5 text-sm text-right font-medium outline-none focus:border-rose ${(item.amount_expected || 0) >= 0 ? 'text-green' : 'text-rose-deep'}`}
                  disabled={isLocked} />
                {!isLocked && (
                  <button onClick={() => removeItem(item.id)} className="text-mid hover:text-rose-deep text-sm">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Month summary + lock */}
      <div className="bg-ink rounded-[20px] p-6 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[120px] text-white/[0.04] leading-none pointer-events-none">Σ</div>
        <div className="grid grid-cols-3 gap-6 mb-4">
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Plánované CF</div>
            <div className={`font-serif text-xl ${stats.expected_net >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {stats.expected_net >= 0 ? '+' : ''}{fmtShort(stats.expected_net)}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Skutečné CF</div>
            <div className={`font-serif text-xl ${stats.actual_net >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {stats.actual_net >= 0 ? '+' : ''}{fmtShort(stats.actual_net)}
            </div>
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Odchylka</div>
            <div className={`font-serif text-xl ${stats.variance_pct >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {stats.variance_pct >= 0 ? '+' : ''}{stats.variance_pct}%
            </div>
          </div>
        </div>
        <button onClick={isLocked ? unlockMonth : lockMonth}
          className={`px-5 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium transition-colors ${
            isLocked ? 'bg-amber text-white hover:bg-amber/80' : 'bg-green text-white hover:bg-green/80'
          }`}>
          {isLocked ? '🔓 Odemknout měsíc' : '🔒 Uzavřít měsíc'}
        </button>
      </div>
    </div>
  )
}
