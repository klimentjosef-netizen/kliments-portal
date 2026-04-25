'use client'

import { useState } from 'react'
import {
  type Ledger, type MonthLedger, type LedgerItem, type ItemStatus,
  type TransactionCategory, calcLedgerMonth, genId, fmt, fmtShort,
} from './calcEngine'

interface MonthlyPlanTabProps {
  ledger: Ledger
  onLedgerChange: (ledger: Ledger) => void
}

function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(m: string): string {
  const CZ = ['Leden', 'Unor', 'Brezen', 'Duben', 'Kveten', 'Cerven', 'Cervenec', 'Srpen', 'Zari', 'Rijen', 'Listopad', 'Prosinec']
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const currentML = ledger.months.find(m => m.month === selectedMonth)
  const items = currentML?.items || []
  const isLocked = currentML?.locked ?? false
  const stats = calcLedgerMonth(items)

  // Split into income and expense
  const incomeItems = items.filter(i => i.amount_expected > 0 || (i.amount_expected === 0 && i.category === 'revenue'))
  const expenseItems = items.filter(i => i.amount_expected < 0 || (i.amount_expected === 0 && i.category !== 'revenue' && i.category !== 'other'))

  const incomeConfirmed = incomeItems.filter(i => i.status === 'paid' || i.status === 'confirmed').reduce((s, i) => s + i.amount_actual, 0)
  const expenseConfirmed = expenseItems.filter(i => i.status === 'paid' || i.status === 'confirmed').reduce((s, i) => s + Math.abs(i.amount_actual), 0)

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
    setExpandedId(id)
  }

  function skipItem(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => i.id === id ? { ...i, status: 'skipped' as ItemStatus } : i)
    updateMonthItems(selectedMonth, newItems)
    setExpandedId(null)
  }

  function reopenItem(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => i.id === id ? { ...i, status: 'expected' as ItemStatus, amount_actual: 0 } : i)
    updateMonthItems(selectedMonth, newItems)
    setExpandedId(null)
  }

  function updateActualAmount(id: string, amount: number) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => i.id === id ? { ...i, amount_actual: amount } : i)
    updateMonthItems(selectedMonth, newItems)
  }

  function addManualItem(type: 'income' | 'expense') {
    const m = getOrCreateMonth(selectedMonth)
    const today = new Date().toISOString().slice(0, 10)
    const newItem: LedgerItem = {
      id: genId(),
      date: today,
      description: '',
      category: (type === 'income' ? 'revenue' : 'cost') as TransactionCategory,
      source: 'manual',
      amount_expected: type === 'income' ? 0 : 0,
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

  // Render a single item row
  function renderItem(item: LedgerItem) {
    const isPaid = item.status === 'paid' || item.status === 'confirmed'
    const isSkipped = item.status === 'skipped'
    const isExpanded = expandedId === item.id
    const isManual = item.source === 'manual'
    const absExpected = Math.abs(item.amount_expected)
    const absActual = Math.abs(item.amount_actual)

    if (isManual && item.status === 'expected') {
      return (
        <div key={item.id} className="flex items-center gap-2 p-3 rounded-lg bg-sand-pale border border-black/[0.04]">
          <input value={item.description}
            onChange={e => updateManualItem(item.id, { description: e.target.value })}
            placeholder="Popis"
            className="flex-1 bg-transparent text-[0.82rem] outline-none border-b border-transparent focus:border-rose" disabled={isLocked} />
          <input type="number" value={item.amount_expected || ''}
            onChange={e => updateManualItem(item.id, { amount_expected: +e.target.value || 0 })}
            placeholder="Castka"
            className="w-28 bg-transparent text-[0.82rem] text-right font-medium outline-none border-b border-black/10 focus:border-rose"
            disabled={isLocked} />
          {!isLocked && (
            <button onClick={() => removeItem(item.id)} className="text-mid hover:text-rose-deep text-sm ml-1">x</button>
          )}
        </div>
      )
    }

    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
            isPaid ? 'bg-green/[0.04] border-green/15' :
            isSkipped ? 'bg-black/[0.02] border-black/[0.04] opacity-40' :
            'bg-sand-pale border-black/[0.04] hover:border-rose/20'
          }`}
          onClick={() => {
            if (isLocked) return
            if (item.status === 'expected') {
              confirmItem(item.id)
            } else {
              setExpandedId(isExpanded ? null : item.id)
            }
          }}
        >
          {/* Checkbox */}
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
            isPaid ? 'bg-green border-green text-white' :
            isSkipped ? 'bg-black/10 border-black/10' :
            'border-black/15 hover:border-rose'
          }`}>
            {isPaid && <span className="text-[0.7rem]">&#10003;</span>}
            {isSkipped && <span className="text-[0.6rem] text-mid">-</span>}
          </div>

          {/* Description */}
          <div className="flex-1 min-w-0">
            <div className={`text-[0.82rem] font-medium ${isSkipped ? 'line-through text-mid' : 'text-ink'}`}>
              {item.description}
            </div>
          </div>

          {/* Amount */}
          <div className="text-right flex-shrink-0">
            {isPaid ? (
              <div className="text-[0.82rem] font-medium text-green">{fmt(absActual)}</div>
            ) : (
              <div className={`text-[0.82rem] font-medium ${isSkipped ? 'text-mid line-through' : 'text-ink'}`}>{fmt(absExpected)}</div>
            )}
          </div>
        </div>

        {/* Expanded: edit actual amount or reopen */}
        {isExpanded && !isLocked && (
          <div className="flex items-center gap-2 px-3 py-2 ml-8 mt-1 rounded-lg bg-white border border-black/[0.06]">
            {isPaid && (
              <>
                <span className="text-[0.72rem] text-mid">Skutecna castka:</span>
                <input type="number"
                  value={item.amount_expected >= 0 ? (absActual || '') : (absActual ? -absActual : '')}
                  onChange={e => {
                    const val = +e.target.value || 0
                    updateActualAmount(item.id, item.amount_expected >= 0 ? Math.abs(val) : -Math.abs(val))
                  }}
                  className="w-28 bg-transparent text-[0.82rem] text-right font-medium outline-none border-b border-black/10 focus:border-rose" />
                <span className="text-[0.72rem] text-mid">Kc</span>
              </>
            )}
            <div className="flex-1" />
            <button onClick={() => reopenItem(item.id)}
              className="text-[0.62rem] tracking-[0.08em] uppercase font-semibold px-3 py-1 rounded bg-black/5 text-mid hover:bg-amber/10 hover:text-amber transition-colors">
              Zrusit
            </button>
            {item.status === 'expected' && (
              <button onClick={() => skipItem(item.id)}
                className="text-[0.62rem] tracking-[0.08em] uppercase font-semibold px-3 py-1 rounded bg-black/5 text-mid hover:bg-rose/10 hover:text-rose-deep transition-colors">
                Preskocit
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Bank balance + month summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Stav uctu</div>
          <input type="number" value={ledger.bank_balance || ''}
            onChange={e => updateBankBalance(+e.target.value || 0)}
            className="font-serif text-lg font-light text-ink leading-none bg-transparent outline-none border-b border-transparent focus:border-rose w-full" />
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Ocekavane prijmy</div>
          <div className="font-serif text-lg font-light text-green leading-none">{fmtShort(stats.expected_income)}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Ocekavane vydaje</div>
          <div className="font-serif text-lg font-light text-rose-deep leading-none">{fmtShort(stats.expected_expense)}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Bilance</div>
          <div className={`font-serif text-lg font-light leading-none ${stats.expected_net >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {stats.expected_net >= 0 ? '+' : ''}{fmtShort(stats.expected_net)}
          </div>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between bg-white rounded-[20px] p-4 border border-black/[0.06]">
        <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          className="px-3 py-1.5 rounded-lg text-mid hover:text-ink hover:bg-sand transition-colors text-sm">&larr; Predchozi</button>
        <div className="text-center">
          <h3 className="font-serif text-lg text-ink">{monthLabel(selectedMonth)}</h3>
          {isLocked && <span className="text-[0.6rem] tracking-[0.1em] uppercase text-green font-semibold">Uzavreno</span>}
        </div>
        <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          className="px-3 py-1.5 rounded-lg text-mid hover:text-ink hover:bg-sand transition-colors text-sm">Dalsi &rarr;</button>
      </div>

      {/* INCOME section */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green" />
            <h3 className="font-serif text-base text-ink">Prijmy</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.75rem] font-medium text-green">{fmt(stats.expected_income)}</span>
            {!isLocked && (
              <button onClick={() => addManualItem('income')}
                className="text-[0.68rem] px-3 py-1 rounded-full border border-black/10 text-mid hover:border-green hover:text-green transition-colors">
                + Prijem
              </button>
            )}
          </div>
        </div>

        {incomeItems.length === 0 ? (
          <p className="text-[0.8rem] text-mid text-center py-4">Zadne ocekavane prijmy tento mesic.</p>
        ) : (
          <div className="space-y-2">
            {incomeItems.map(item => renderItem(item))}
          </div>
        )}

        {incomeConfirmed > 0 && (
          <div className="flex justify-between items-center pt-3 mt-3 border-t border-black/[0.06]">
            <span className="text-[0.72rem] text-mid">Potvrzeno</span>
            <span className="text-[0.78rem] font-medium text-green">{fmt(incomeConfirmed)} z {fmt(stats.expected_income)}</span>
          </div>
        )}
      </div>

      {/* EXPENSE section */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-deep" />
            <h3 className="font-serif text-base text-ink">Vydaje</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.75rem] font-medium text-rose-deep">{fmt(stats.expected_expense)}</span>
            {!isLocked && (
              <button onClick={() => addManualItem('expense')}
                className="text-[0.68rem] px-3 py-1 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
                + Vydaj
              </button>
            )}
          </div>
        </div>

        {expenseItems.length === 0 ? (
          <p className="text-[0.8rem] text-mid text-center py-4">Zadne ocekavane vydaje tento mesic.</p>
        ) : (
          <div className="space-y-2">
            {expenseItems.map(item => renderItem(item))}
          </div>
        )}

        {expenseConfirmed > 0 && (
          <div className="flex justify-between items-center pt-3 mt-3 border-t border-black/[0.06]">
            <span className="text-[0.72rem] text-mid">Potvrzeno</span>
            <span className="text-[0.78rem] font-medium text-rose-deep">{fmt(expenseConfirmed)} z {fmt(stats.expected_expense)}</span>
          </div>
        )}
      </div>

      {/* Bottom summary + lock */}
      <div className="bg-ink rounded-[20px] p-6 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[120px] text-white/[0.04] leading-none pointer-events-none">K</div>
        <div className="grid grid-cols-3 gap-6 mb-4">
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Prijmy</div>
            <div className="font-serif text-xl text-green">{fmtShort(stats.expected_income)}</div>
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Vydaje</div>
            <div className="font-serif text-xl text-rose-pale">{fmtShort(stats.expected_expense)}</div>
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Bilance</div>
            <div className={`font-serif text-xl ${stats.expected_net >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {stats.expected_net >= 0 ? '+' : ''}{fmtShort(stats.expected_net)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={isLocked ? unlockMonth : lockMonth}
            className={`px-5 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium transition-colors ${
              isLocked ? 'bg-amber text-white hover:bg-amber/80' : 'bg-green text-white hover:bg-green/80'
            }`}>
            {isLocked ? 'Odemknout mesic' : 'Uzavrit mesic'}
          </button>
          {isPaid(items) && (
            <span className="text-[0.68rem] text-white/40">
              {items.filter(i => i.status === 'paid' || i.status === 'confirmed').length} z {items.filter(i => i.status !== 'skipped').length} polozek potvrzeno
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function isPaid(items: LedgerItem[]): boolean {
  return items.some(i => i.status === 'paid' || i.status === 'confirmed')
}
