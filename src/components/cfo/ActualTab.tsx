'use client'

import { useState } from 'react'
import { type Actuals, type ActualMonth, type Transaction, type TransactionCategory, calcActualMonth, genId, fmt, fmtShort } from './calcEngine'

const CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'revenue', label: 'Příjem' },
  { value: 'cost', label: 'Náklad' },
  { value: 'tax', label: 'Daň' },
  { value: 'vat', label: 'DPH' },
  { value: 'capex', label: 'CAPEX' },
  { value: 'social', label: 'Sociální' },
  { value: 'health', label: 'Zdravotní' },
  { value: 'other', label: 'Ostatní' },
]

const CAT_COLORS: Record<TransactionCategory, string> = {
  revenue: 'bg-green/10 text-green',
  cost: 'bg-rose/10 text-rose-deep',
  tax: 'bg-amber/10 text-amber',
  vat: 'bg-[#e0d4f5] text-[#6b3fa0]',
  capex: 'bg-ink/10 text-ink',
  social: 'bg-[#d4e8f5] text-[#2a6496]',
  health: 'bg-[#d4f5e0] text-[#2a7d4a]',
  other: 'bg-black/5 text-mid',
}

interface ActualTabProps {
  actuals: Actuals
  onActualsChange: (actuals: Actuals) => void
}

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

export default function ActualTab({ actuals, onActualsChange }: ActualTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const currentMonthData = actuals.months.find(m => m.month === selectedMonth)
  const items = currentMonthData?.items || []
  const { income, expense, net } = calcActualMonth(items)

  function getOrCreateMonth(month: string): ActualMonth {
    const existing = actuals.months.find(m => m.month === month)
    if (existing) return existing
    return { month, items: [] }
  }

  function updateMonth(month: string, newItems: Transaction[]) {
    const months = actuals.months.filter(m => m.month !== month)
    months.push({ month, items: newItems })
    months.sort((a, b) => a.month.localeCompare(b.month))
    onActualsChange({ ...actuals, months })
  }

  function addTransaction() {
    const m = getOrCreateMonth(selectedMonth)
    const today = new Date().toISOString().slice(0, 10)
    const newItem: Transaction = {
      id: genId(),
      date: today,
      description: '',
      category: 'revenue',
      amount: 0,
      vat_rate: 0,
      paid: true,
    }
    updateMonth(selectedMonth, [...m.items, newItem])
  }

  function updateTransaction(id: string, patch: Partial<Transaction>) {
    const m = getOrCreateMonth(selectedMonth)
    const newItems = m.items.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, ...patch }
      // Auto-calc VAT amount
      if ('amount' in patch || 'vat_rate' in patch) {
        const base = Math.abs(updated.amount)
        const rate = updated.vat_rate || 0
        updated.vat_amount = rate > 0 ? Math.round(base - base / (1 + rate / 100)) : 0
      }
      return updated
    })
    updateMonth(selectedMonth, newItems)
  }

  function removeTransaction(id: string) {
    const m = getOrCreateMonth(selectedMonth)
    updateMonth(selectedMonth, m.items.filter(i => i.id !== id))
  }

  function updateBankBalance(value: number) {
    onActualsChange({ ...actuals, bank_balance: value })
  }

  const inputCls = 'bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Stav účtu</div>
          <input
            type="number"
            value={actuals.bank_balance || ''}
            onChange={e => updateBankBalance(+e.target.value || 0)}
            className="font-serif text-xl font-light text-ink leading-none bg-transparent outline-none border-b border-transparent focus:border-rose w-full"
          />
          <div className="text-[0.68rem] mt-1 text-mid">aktuální zůstatek</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Příjmy tento měsíc</div>
          <div className="font-serif text-xl font-light text-green leading-none">{fmtShort(income)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">{items.filter(i => i.amount > 0).length} položek</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Výdaje tento měsíc</div>
          <div className="font-serif text-xl font-light text-rose-deep leading-none">{fmtShort(expense)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">{items.filter(i => i.amount < 0).length} položek</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Čistý cashflow</div>
          <div className={`font-serif text-xl font-light leading-none ${net >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {net >= 0 ? '+' : ''}{fmtShort(net)}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">příjmy − výdaje</div>
        </div>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between bg-white rounded-[20px] p-4 border border-black/[0.06]">
        <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          className="px-3 py-1.5 rounded-lg text-mid hover:text-ink hover:bg-sand transition-colors text-sm">← Předchozí</button>
        <h3 className="font-serif text-lg text-ink">{monthLabel(selectedMonth)}</h3>
        <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          className="px-3 py-1.5 rounded-lg text-mid hover:text-ink hover:bg-sand transition-colors text-sm">Další →</button>
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Pohyby: {monthLabel(selectedMonth)}</h3>
          <button onClick={addTransaction}
            className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
            + Přidat pohyb
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-[0.8rem] text-mid py-4 text-center">Žádné pohyby v tomto měsíci. Přidejte první pohyb nebo importujte CSV.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[90px_1fr_100px_100px_80px_70px_30px] gap-2 text-[0.55rem] tracking-[0.1em] uppercase text-mid pb-1">
              <span>Datum</span><span>Popis</span><span>Kategorie</span><span className="text-right">Částka</span><span className="text-right">DPH %</span><span className="text-right">DPH</span><span></span>
            </div>
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-[90px_1fr_100px_100px_80px_70px_30px] gap-2 items-center">
                <input type="date" value={item.date} onChange={e => updateTransaction(item.id, { date: e.target.value })} className={`${inputCls} text-xs`} />
                <input value={item.description} onChange={e => updateTransaction(item.id, { description: e.target.value })} placeholder="Popis pohybu" className={inputCls} />
                <select value={item.category} onChange={e => updateTransaction(item.id, { category: e.target.value as TransactionCategory })}
                  className={`text-[0.62rem] font-medium px-2 py-1 rounded-full outline-none cursor-pointer ${CAT_COLORS[item.category]}`}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="number" value={item.amount || ''} onChange={e => updateTransaction(item.id, { amount: +e.target.value || 0 })}
                  className={`${inputCls} text-right font-medium ${item.amount >= 0 ? 'text-green' : 'text-rose-deep'}`} />
                <select value={item.vat_rate || 0} onChange={e => updateTransaction(item.id, { vat_rate: +e.target.value })}
                  className={`${inputCls} text-right text-xs`}>
                  <option value={0}>0 %</option>
                  <option value={12}>12 %</option>
                  <option value={21}>21 %</option>
                </select>
                <div className="text-right text-[0.72rem] text-mid">{item.vat_amount ? fmt(item.vat_amount) : '···'}</div>
                <button onClick={() => removeTransaction(item.id)} className="text-mid hover:text-rose-deep text-sm">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Category summary */}
        {items.length > 0 && (
          <div className="mt-6 pt-4 border-t border-black/[0.06]">
            <h4 className="text-[0.62rem] tracking-[0.1em] uppercase text-mid mb-3">Rozdělení podle kategorií</h4>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const catItems = items.filter(i => i.category === cat.value)
                if (catItems.length === 0) return null
                const total = catItems.reduce((s, i) => s + i.amount, 0)
                return (
                  <div key={cat.value} className={`px-3 py-1.5 rounded-full text-[0.68rem] font-medium ${CAT_COLORS[cat.value]}`}>
                    {cat.label}: {total >= 0 ? '+' : ''}{fmt(total)}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
