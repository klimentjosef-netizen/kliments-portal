'use client'

import { type VatData, type VatPeriod, type VatRate, type Ledger, type BusinessProfile, calcVatFromLedger, fmt, fmtShort } from './calcEngine'

interface VatTabProps {
  vat: VatData
  ledger: Ledger
  capexVat: number
  profile: BusinessProfile
  onVatChange: (vat: VatData) => void
}

export default function VatTab({ vat, ledger, capexVat, profile, onVatChange }: VatTabProps) {
  const showVat = profile.vat_payer || !!profile.vat_transition_date
  // Calculate VAT from ledger items (Czech VAT: based on invoice date, not payment)
  const vatCalc = calcVatFromLedger(ledger)
  const totalOutput = vatCalc.output
  const totalInput = vatCalc.input + capexVat
  const liability = totalOutput - totalInput

  function updateRate(i: number, patch: Partial<VatRate>) {
    const rates = vat.rates.map((r, j) => j === i ? { ...r, ...patch } : r)
    onVatChange({ ...vat, rates })
  }
  function addRate() { onVatChange({ ...vat, rates: [...vat.rates, { service: '', rate: 21, note: '' }] }) }
  function removeRate(i: number) { onVatChange({ ...vat, rates: vat.rates.filter((_, j) => j !== i) }) }

  function updatePeriod(i: number, patch: Partial<VatPeriod>) {
    const periods = vat.periods.map((p, j) => j === i ? { ...p, ...patch } : p)
    onVatChange({ ...vat, periods })
  }
  function addPeriod() {
    onVatChange({ ...vat, periods: [...vat.periods, { label: '', output: 0, input: 0, liability: 0, paid: false, due_date: '' }] })
  }
  function removePeriod(i: number) { onVatChange({ ...vat, periods: vat.periods.filter((_, j) => j !== i) }) }

  const inputCls = 'bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">DPH na výstupu</div>
          <div className="font-serif text-xl font-light text-rose leading-none">{fmtShort(totalOutput)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">z prodeje služeb</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">DPH na vstupu</div>
          <div className="font-serif text-xl font-light text-green leading-none">{fmtShort(totalInput)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">z nákupů + CAPEX</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">{liability >= 0 ? 'K odvodu' : 'Nadměrný odpočet'}</div>
          <div className={`font-serif text-xl font-light leading-none ${liability >= 0 ? 'text-rose-deep' : 'text-green'}`}>
            {fmtShort(Math.abs(liability))}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">{liability < 0 ? 'FÚ vám vrátí' : 'zaplatíte FÚ'}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">DPH z CAPEX</div>
          <div className="font-serif text-xl font-light text-green leading-none">{fmtShort(capexVat)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">21 % k odpočtu</div>
        </div>
      </div>

      {/* VAT rates table */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Sazby DPH</h3>
          <button onClick={addRate} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">+ Sazba</button>
        </div>
        <div className="grid grid-cols-[1fr_80px_1fr_30px] gap-2 text-[0.55rem] tracking-[0.1em] uppercase text-mid mb-1">
          <span>Služba</span><span className="text-right">Sazba</span><span>Poznámka</span><span></span>
        </div>
        {vat.rates.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_1fr_30px] gap-2 items-end mb-1.5">
            <input value={r.service} onChange={e => updateRate(i, { service: e.target.value })} className={inputCls} placeholder="Služba" />
            <select value={r.rate} onChange={e => updateRate(i, { rate: +e.target.value })} className={`${inputCls} text-right`}>
              <option value={0}>0 %</option><option value={12}>12 %</option><option value={21}>21 %</option>
            </select>
            <input value={r.note} onChange={e => updateRate(i, { note: e.target.value })} className={inputCls} placeholder="Poznámka" />
            <button onClick={() => removeRate(i)} className="text-mid hover:text-rose-deep text-sm pb-1.5">✕</button>
          </div>
        ))}
      </div>

      {/* Periods */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-serif text-base text-ink">Přehledy DPH</h3>
            <div className="flex gap-2 mt-2">
              {(['monthly', 'quarterly'] as const).map(p => (
                <button key={p} onClick={() => onVatChange({ ...vat, period: p })}
                  className={`text-[0.62rem] px-3 py-1 rounded-full ${vat.period === p ? 'bg-rose text-white' : 'bg-black/5 text-mid'}`}>
                  {p === 'monthly' ? 'Měsíční' : 'Kvartální'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addPeriod} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">+ Období</button>
        </div>
        {vat.periods.length === 0 ? (
          <p className="text-[0.8rem] text-mid">Žádná období. Přidejte první přehledové období.</p>
        ) : (
          <div className="space-y-2">
            {vat.periods.map((p, i) => (
              <div key={i} className={`grid grid-cols-[120px_100px_100px_100px_90px_100px_30px] gap-2 items-center p-2 rounded-lg ${p.paid ? 'bg-[#eef6f1]' : p.liability > 0 ? 'bg-[#fdf0f0]' : 'bg-sand-pale'}`}>
                <input value={p.label} onChange={e => updatePeriod(i, { label: e.target.value })} className="bg-transparent text-[0.78rem] font-medium text-ink outline-none border-b border-transparent focus:border-rose" placeholder="Q1 2026" />
                <div className="text-right">
                  <div className="text-[0.55rem] text-mid uppercase">Výstup</div>
                  <input type="number" value={p.output || ''} onChange={e => { const o = +e.target.value || 0; updatePeriod(i, { output: o, liability: o - p.input }) }} className="bg-transparent text-[0.72rem] text-right outline-none border-b border-transparent focus:border-rose w-full" />
                </div>
                <div className="text-right">
                  <div className="text-[0.55rem] text-mid uppercase">Vstup</div>
                  <input type="number" value={p.input || ''} onChange={e => { const inp = +e.target.value || 0; updatePeriod(i, { input: inp, liability: p.output - inp }) }} className="bg-transparent text-[0.72rem] text-right outline-none border-b border-transparent focus:border-rose w-full" />
                </div>
                <div className="text-right">
                  <div className="text-[0.55rem] text-mid uppercase">{p.liability >= 0 ? 'Odvod' : 'Odpočet'}</div>
                  <div className={`text-[0.72rem] font-medium ${p.liability >= 0 ? 'text-rose-deep' : 'text-green'}`}>{fmt(Math.abs(p.liability))}</div>
                </div>
                <input type="date" value={p.due_date} onChange={e => updatePeriod(i, { due_date: e.target.value })} className="bg-transparent text-[0.65rem] text-mid outline-none border-b border-transparent focus:border-rose" />
                <button onClick={() => updatePeriod(i, { paid: !p.paid })}
                  className={`text-[0.58rem] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 rounded-full ${p.paid ? 'bg-green/20 text-green' : 'bg-rose/20 text-rose-deep'}`}>
                  {p.paid ? '✓ Zaplaceno' : 'Nezaplaceno'}
                </button>
                <button onClick={() => removePeriod(i)} className="text-mid hover:text-rose-deep text-sm">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
