'use client'

import { type Tier, type Extra, type CostItem, calcRevenue, calcOpex, calcEbitda, fmt } from './calcEngine'

interface PricingTabProps {
  tiers: Tier[]
  extras: Extra[]
  fixedCosts: CostItem[]
  variablePct: number
  onTiersChange: (tiers: Tier[]) => void
  onExtrasChange: (extras: Extra[]) => void
}

export default function PricingTab({ tiers, extras, fixedCosts, variablePct, onTiersChange, onExtrasChange }: PricingTabProps) {
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const ebitda = calcEbitda(rev, opex)

  function updateTier(i: number, patch: Partial<Tier>) {
    const arr = tiers.map((t, j) => j === i ? { ...t, ...patch } : t)
    onTiersChange(arr)
  }

  function addTier() {
    if (tiers.length >= 8) return
    onTiersChange([...tiers, { name: `Tier ${tiers.length + 1}`, price: 0, capacity: 10, members: 0, features: ['Základní přístup'] }])
  }

  function removeTier(i: number) {
    if (tiers.length <= 1) return
    onTiersChange(tiers.filter((_, j) => j !== i))
  }

  function updateFeature(tierIdx: number, featIdx: number, value: string) {
    const arr = [...tiers]
    arr[tierIdx] = { ...arr[tierIdx], features: arr[tierIdx].features.map((f, j) => j === featIdx ? value : f) }
    onTiersChange(arr)
  }

  function addFeature(tierIdx: number) {
    const arr = [...tiers]
    arr[tierIdx] = { ...arr[tierIdx], features: [...arr[tierIdx].features, 'Nová služba'] }
    onTiersChange(arr)
  }

  function removeFeature(tierIdx: number, featIdx: number) {
    const arr = [...tiers]
    arr[tierIdx] = { ...arr[tierIdx], features: arr[tierIdx].features.filter((_, j) => j !== featIdx) }
    onTiersChange(arr)
  }

  function updateExtra(i: number, patch: Partial<Extra>) {
    onExtrasChange(extras.map((e, j) => j === i ? { ...e, ...patch } : e))
  }

  function addExtra() {
    onExtrasChange([...extras, { name: 'Nový příjem', quantity: 0, unit_price: 0, unit: 'ks' }])
  }

  function removeExtra(i: number) {
    onExtrasChange(extras.filter((_, j) => j !== i))
  }

  const inputCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'
  const numCls = 'w-full bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose text-right transition-colors'

  return (
    <div className="space-y-6">
      {/* Tier builder */}
      <div className="flex justify-between items-center">
        <h3 className="font-serif text-base text-ink">Tarify</h3>
        <button onClick={addTier} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
          + Přidat tarif
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiers.map((t, i) => (
          <div key={i} className={`bg-white rounded-[20px] p-5 border ${t.badge ? 'border-rose/30' : 'border-black/[0.06]'} relative`}>
            {t.badge && (
              <span className="absolute -top-2.5 left-4 bg-rose text-white text-[0.58rem] tracking-[0.1em] uppercase font-semibold px-3 py-0.5 rounded-full">
                {t.badge}
              </span>
            )}
            <div className="flex justify-between items-start mb-3">
              <input
                value={t.name}
                onChange={e => updateTier(i, { name: e.target.value })}
                className="font-serif text-base text-ink bg-transparent outline-none border-b border-transparent focus:border-rose w-full"
              />
              {tiers.length > 1 && (
                <button onClick={() => removeTier(i)} className="text-mid hover:text-rose-deep text-sm ml-2">✕</button>
              )}
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Cena (Kč/měsíc)</label>
                <input type="number" value={t.price || ''} min="0" onChange={e => updateTier(i, { price: Math.max(0, +e.target.value || 0) })} className={numCls} />
              </div>
              <div>
                <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Počet členů</label>
                <input type="number" value={t.members || ''} min="0" onChange={e => updateTier(i, { members: Math.max(0, +e.target.value || 0) })} className={numCls} />
              </div>
              <div>
                <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Kapacita (max)</label>
                <input type="number" value={t.capacity || ''} min="0" onChange={e => updateTier(i, { capacity: Math.max(0, +e.target.value || 0) })} className={numCls} />
              </div>
            </div>

            <div className="text-right text-[0.82rem] font-medium text-rose mb-4">
              {fmt(t.price * t.members)}/měs
            </div>

            <div className="border-t border-black/[0.06] pt-3">
              <div className="text-[0.55rem] tracking-[0.1em] uppercase text-mid mb-2">Služby v ceně</div>
              {t.features.map((f, fi) => (
                <div key={fi} className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-rose text-[0.6rem]">◆</span>
                  <input value={f} onChange={e => updateFeature(i, fi, e.target.value)}
                    className="flex-1 bg-transparent border-b border-black/[0.04] text-[0.75rem] text-mid py-0.5 outline-none focus:border-rose" />
                  <button onClick={() => removeFeature(i, fi)} className="text-mid/50 hover:text-rose-deep text-xs">✕</button>
                </div>
              ))}
              <button onClick={() => addFeature(i)} className="text-[0.62rem] text-mid hover:text-rose mt-1">+ služba</button>
            </div>

            {/* Badge editor */}
            <div className="mt-3 pt-3 border-t border-black/[0.06]">
              <input value={t.badge || ''} onChange={e => updateTier(i, { badge: e.target.value })}
                placeholder="Badge (např. Doporučený)"
                className="w-full bg-transparent text-[0.68rem] text-mid outline-none border-b border-black/[0.04] focus:border-rose py-0.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Extra revenue */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Doplňkové příjmy</h3>
          <button onClick={addExtra} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
            + Přidat
          </button>
        </div>
        {extras.length === 0 && <p className="text-[0.8rem] text-mid">Žádné doplňkové příjmy.</p>}
        {extras.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_100px_60px_30px] gap-3 mb-2 items-end">
            <input value={e.name} onChange={ev => updateExtra(i, { name: ev.target.value })} placeholder="Název" className={inputCls} />
            <input type="number" value={e.quantity || ''} min="0" onChange={ev => updateExtra(i, { quantity: Math.max(0, +ev.target.value || 0) })} placeholder="Počet" className={numCls} />
            <input type="number" value={e.unit_price || ''} min="0" onChange={ev => updateExtra(i, { unit_price: Math.max(0, +ev.target.value || 0) })} placeholder="Kč/ks" className={numCls} />
            <input value={e.unit} onChange={ev => updateExtra(i, { unit: ev.target.value })} placeholder="jed." className={inputCls} />
            <button onClick={() => removeExtra(i)} className="text-mid hover:text-rose-deep text-sm pb-1.5">✕</button>
          </div>
        ))}
      </div>

      {/* Auto P&L */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-4">Měsíční P&L</h3>
        <table className="w-full text-[0.8rem]">
          <tbody>
            <tr><td colSpan={2} className="text-[0.62rem] tracking-[0.1em] uppercase text-rose font-medium pb-1.5 pt-2">Příjmy</td></tr>
            {rev.tierBreakdown.filter(t => t.members > 0).map((t, i) => (
              <tr key={`t-${i}`} className="border-b border-black/[0.04]">
                <td className="py-1.5 text-mid">{t.name} ({t.members} × {t.price.toLocaleString('cs-CZ')} Kč)</td>
                <td className="py-1.5 text-ink text-right font-medium">{fmt(t.revenue)}</td>
              </tr>
            ))}
            {rev.extraBreakdown.filter(e => e.revenue > 0).map((e, i) => (
              <tr key={`e-${i}`} className="border-b border-black/[0.04]">
                <td className="py-1.5 text-mid">{e.name} ({e.quantity} × {e.unit_price.toLocaleString('cs-CZ')} Kč)</td>
                <td className="py-1.5 text-ink text-right font-medium">{fmt(e.revenue)}</td>
              </tr>
            ))}
            <tr className="border-b border-black/[0.08]">
              <td className="py-2 text-ink font-medium">Celkem příjmy</td>
              <td className="py-2 text-ink text-right font-medium">{fmt(rev.total)}</td>
            </tr>

            <tr><td colSpan={2} className="text-[0.62rem] tracking-[0.1em] uppercase text-rose font-medium pb-1.5 pt-4">Náklady</td></tr>
            {fixedCosts.map((c, i) => (
              <tr key={i} className="border-b border-black/[0.04]">
                <td className="py-1.5 text-mid">{c.name}</td>
                <td className="py-1.5 text-ink text-right font-medium">{fmt(c.amount)}</td>
              </tr>
            ))}
            <tr className="border-b border-black/[0.04]">
              <td className="py-1.5 text-mid">Variabilní ({variablePct} % z obratu)</td>
              <td className="py-1.5 text-ink text-right font-medium">{fmt(opex.variable)}</td>
            </tr>
            <tr className="border-b border-black/[0.08]">
              <td className="py-2 text-ink font-medium">Celkem náklady</td>
              <td className="py-2 text-ink text-right font-medium">{fmt(opex.total)}</td>
            </tr>

            <tr>
              <td className="py-3 font-serif text-base text-ink">EBITDA</td>
              <td className={`py-3 text-right font-serif text-base font-medium ${ebitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
                {ebitda >= 0 ? '+' : ''}{fmt(ebitda)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
