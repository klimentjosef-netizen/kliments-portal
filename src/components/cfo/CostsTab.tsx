'use client'

import { type CostItem, fmt } from './calcEngine'

interface CostsTabProps {
  fixedCosts: CostItem[]
  variablePct: number
  onCostsChange: (costs: CostItem[]) => void
  onVariableChange: (pct: number) => void
}

export default function CostsTab({ fixedCosts, variablePct, onCostsChange, onVariableChange }: CostsTabProps) {
  const totalFixed = fixedCosts.reduce((s, c) => s + c.amount, 0)

  function updateCost(i: number, patch: Partial<CostItem>) {
    onCostsChange(fixedCosts.map((c, j) => j === i ? { ...c, ...patch } : c))
  }

  function addCost() {
    onCostsChange([...fixedCosts, { name: 'Nový náklad', amount: 0 }])
  }

  function removeCost(i: number) {
    onCostsChange(fixedCosts.filter((_, j) => j !== i))
  }

  const inputCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'
  const numCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose text-right transition-colors'

  return (
    <div className="space-y-6">
      {/* Fixed costs */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Fixní měsíční náklady</h3>
          <button onClick={addCost} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
            + Přidat náklad
          </button>
        </div>
        <div className="space-y-2">
          {fixedCosts.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_150px_30px] gap-3 items-end">
              <input value={c.name} onChange={e => updateCost(i, { name: e.target.value })} className={inputCls} />
              <input type="number" value={c.amount || ''} min="0" onChange={e => updateCost(i, { amount: Math.max(0, +e.target.value || 0) })} className={numCls} />
              <button onClick={() => removeCost(i)} className="text-mid hover:text-rose-deep text-sm pb-1.5">✕</button>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-black/[0.06]">
          <span className="text-[0.85rem] text-ink font-medium">Celkem fixní OPEX</span>
          <span className="font-serif text-lg text-ink">{fmt(totalFixed)}</span>
        </div>
      </div>

      {/* Variable costs */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-4">Variabilní náklady</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0" max="30" step="0.5"
            value={variablePct}
            onChange={e => onVariableChange(+e.target.value)}
            className="flex-1 accent-rose"
          />
          <div className="flex items-center gap-2 min-w-[100px]">
            <input
              type="number"
              min="0" max="100" step="0.5"
              value={variablePct}
              onChange={e => onVariableChange(Math.max(0, Math.min(100, +e.target.value || 0)))}
              className="w-16 bg-transparent border-b border-black/10 py-1 text-sm text-right outline-none focus:border-rose"
            />
            <span className="text-sm text-mid">%</span>
          </div>
        </div>
        <p className="text-[0.72rem] text-mid mt-2">
          Procento z celkových příjmů (pokrývá pohyblivé náklady jako provize, spotřební materiál, apod.)
        </p>
      </div>

      {/* Info card */}
      <div className="bg-ink rounded-[20px] p-6 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[120px] text-white/[0.04] leading-none pointer-events-none">%</div>
        <h3 className="font-serif text-base text-sand font-light mb-2">Jak to funguje</h3>
        <p className="text-[0.78rem] text-white/40 leading-relaxed">
          Fixní náklady se platí každý měsíc bez ohledu na příjmy. Variabilní náklady rostou s obratem — typicky 3-8 % pro služby, 15-30 % pro prodejce zboží.
          Všechny výpočty (P&L, break-even, cashflow projekce) se automaticky přepočítají při jakékoli změně.
        </p>
      </div>
    </div>
  )
}
