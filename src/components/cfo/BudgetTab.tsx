'use client'

import { type Budget, type CapexItem, fmt } from './calcEngine'
import ProgressBar from './ProgressBar'

interface BudgetTabProps {
  budget: Budget
  monthlyEbitda: number
  onBudgetChange: (budget: Budget) => void
}

export default function BudgetTab({ budget, monthlyEbitda, onBudgetChange }: BudgetTabProps) {
  const capexSpent = budget.capex_items.reduce((s, i) => s + i.spent, 0)
  const capexRemaining = budget.capex_budget - capexSpent
  const reserveRemaining = budget.reserve_budget - budget.reserve_drawn
  const totalSpent = capexSpent + budget.reserve_drawn
  const totalRemaining = budget.total - totalSpent

  const monthlyLoss = monthlyEbitda < 0 ? Math.abs(monthlyEbitda) : 0
  const runway = monthlyLoss > 0 ? Math.floor(reserveRemaining / monthlyLoss) : null

  function updateCapex(i: number, patch: Partial<CapexItem>) {
    const items = budget.capex_items.map((item, j) => j === i ? { ...item, ...patch } : item)
    onBudgetChange({ ...budget, capex_items: items })
  }

  function addCapex() {
    onBudgetChange({ ...budget, capex_items: [...budget.capex_items, { name: 'Nová položka', planned: 0, spent: 0 }] })
  }

  function removeCapex(i: number) {
    onBudgetChange({ ...budget, capex_items: budget.capex_items.filter((_, j) => j !== i) })
  }

  const inputCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'
  const numCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose text-right transition-colors'

  return (
    <div className="space-y-6">
      {/* Budget summary */}
      <div className="bg-ink rounded-[20px] p-7 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
        <h3 className="font-serif text-lg text-sand font-light mb-4">Celkový rozpočet</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Celkový rozpočet</div>
            <input type="number" value={budget.total || ''} min="0" onChange={e => onBudgetChange({ ...budget, total: Math.max(0, +e.target.value || 0) })}
              className="font-serif text-xl text-sand bg-transparent border-b border-white/10 outline-none focus:border-rose w-full" />
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">CAPEX rozpočet</div>
            <input type="number" value={budget.capex_budget || ''} min="0" onChange={e => onBudgetChange({ ...budget, capex_budget: Math.max(0, +e.target.value || 0) })}
              className="font-serif text-xl text-sand bg-transparent border-b border-white/10 outline-none focus:border-rose w-full" />
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Provozní rezerva</div>
            <input type="number" value={budget.reserve_budget || ''} min="0" onChange={e => onBudgetChange({ ...budget, reserve_budget: Math.max(0, +e.target.value || 0) })}
              className="font-serif text-xl text-sand bg-transparent border-b border-white/10 outline-none focus:border-rose w-full" />
          </div>
          <div>
            <div className="text-[0.6rem] tracking-[0.1em] uppercase text-white/40 mb-1">Zbývá</div>
            <div className={`font-serif text-xl ${totalRemaining >= 0 ? 'text-green' : 'text-rose-pale'}`}>
              {fmt(totalRemaining)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CAPEX tracker */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-base text-ink">CAPEX · investice</h3>
            <button onClick={addCapex} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
              + Položka
            </button>
          </div>
          <ProgressBar value={capexSpent} max={budget.capex_budget} label={`${fmt(capexSpent)} čerpáno z ${fmt(budget.capex_budget)}`} />

          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[1fr_100px_100px_30px] gap-2 text-[0.55rem] tracking-[0.1em] uppercase text-mid mb-1">
              <span>Položka</span><span className="text-right">Plán</span><span className="text-right">Čerpáno</span><span></span>
            </div>
            {budget.capex_items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_30px] gap-2 items-end">
                <input value={item.name} onChange={e => updateCapex(i, { name: e.target.value })} className={inputCls} />
                <input type="number" value={item.planned || ''} min="0" onChange={e => updateCapex(i, { planned: Math.max(0, +e.target.value || 0) })} className={numCls} />
                <input type="number" value={item.spent || ''} min="0" onChange={e => updateCapex(i, { spent: Math.max(0, +e.target.value || 0) })} className={numCls} />
                <button onClick={() => removeCapex(i)} className="text-mid hover:text-rose-deep text-sm pb-1.5">✕</button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 mt-3 border-t border-black/[0.06]">
            <span className="text-[0.8rem] text-ink font-medium">Zbývá k investici</span>
            <span className={`text-[0.8rem] font-medium ${capexRemaining >= 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(capexRemaining)}</span>
          </div>
        </div>

        {/* Reserve tracker */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Provozní rezerva</h3>
          <ProgressBar value={budget.reserve_drawn} max={budget.reserve_budget} label={`${fmt(budget.reserve_drawn)} čerpáno z ${fmt(budget.reserve_budget)}`} />

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Čerpáno z rezervy (Kč)</label>
              <input type="number" value={budget.reserve_drawn || ''} min="0" onChange={e => onBudgetChange({ ...budget, reserve_drawn: Math.max(0, +e.target.value || 0) })} className={numCls} />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-black/[0.06]">
              <span className="text-[0.8rem] text-mid">Zbývající rezerva</span>
              <span className={`text-[0.8rem] font-medium ${reserveRemaining > 0 ? 'text-green' : 'text-rose-deep'}`}>{fmt(reserveRemaining)}</span>
            </div>

            {monthlyLoss > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[0.8rem] text-mid">Aktuální měsíční ztráta</span>
                <span className="text-[0.8rem] font-medium text-rose-deep">{fmt(monthlyLoss)}</span>
              </div>
            )}

            {runway !== null && (
              <div className="flex justify-between items-center">
                <span className="text-[0.8rem] text-mid">Runway</span>
                <span className={`text-[0.8rem] font-medium ${runway > 3 ? 'text-green' : 'text-rose-deep'}`}>
                  {runway > 36 ? '3+ roky' : `${runway} měsíců`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
