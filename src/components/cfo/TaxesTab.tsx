'use client'

import { type TaxData, type TaxAdvance, type TaxDeadline, fmt, fmtShort } from './calcEngine'

interface TaxesTabProps {
  taxes: TaxData
  taxDeadlines: TaxDeadline[]
  complexity: 'simple' | 'detailed'
  onTaxesChange: (taxes: TaxData) => void
}

function statusColor(due: string, paid: boolean): string {
  if (paid) return 'bg-green/10 text-green border-green/20'
  const days = Math.floor((new Date(due).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'bg-[#fdf0f0] text-rose-deep border-rose/20'
  if (days < 14) return 'bg-amber/10 text-amber border-amber/20'
  return 'bg-white text-mid border-black/[0.06]'
}

export default function TaxesTab({ taxes, taxDeadlines, complexity, onTaxesChange }: TaxesTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isSimple = complexity === 'simple'
  const totalMonthly = (taxes.income_tax.annual_estimate / 12) + taxes.social.monthly + taxes.health.monthly
  const totalAnnual = taxes.income_tax.annual_estimate + taxes.social.monthly * 12 + taxes.health.monthly * 12

  // Collect all upcoming payments into a calendar
  const allPayments: Array<{ name: string; amount: number; due_date: string; paid: boolean; toggle: () => void }> = []

  taxes.income_tax.advances.forEach((a, i) => allPayments.push({
    name: `Daň z příjmů: ${a.period}`, amount: a.amount, due_date: a.due_date, paid: a.paid,
    toggle: () => { const adv = [...taxes.income_tax.advances]; adv[i] = { ...adv[i], paid: !adv[i].paid }; onTaxesChange({ ...taxes, income_tax: { ...taxes.income_tax, advances: adv } }) }
  }))
  taxes.social.advances.forEach((a, i) => allPayments.push({
    name: `Sociální: ${a.period}`, amount: a.amount, due_date: a.due_date, paid: a.paid,
    toggle: () => { const adv = [...taxes.social.advances]; adv[i] = { ...adv[i], paid: !adv[i].paid }; onTaxesChange({ ...taxes, social: { ...taxes.social, advances: adv } }) }
  }))
  taxes.health.advances.forEach((a, i) => allPayments.push({
    name: `Zdravotní: ${a.period}`, amount: a.amount, due_date: a.due_date, paid: a.paid,
    toggle: () => { const adv = [...taxes.health.advances]; adv[i] = { ...adv[i], paid: !adv[i].paid }; onTaxesChange({ ...taxes, health: { ...taxes.health, advances: adv } }) }
  }))
  taxes.other_taxes.forEach((t, i) => allPayments.push({
    name: t.name, amount: t.amount, due_date: t.due_date, paid: t.paid,
    toggle: () => { const arr = [...taxes.other_taxes]; arr[i] = { ...arr[i], paid: !arr[i].paid }; onTaxesChange({ ...taxes, other_taxes: arr }) }
  }))

  allPayments.sort((a, b) => a.due_date.localeCompare(b.due_date))

  function updateAdvance(section: 'income_tax' | 'social' | 'health', i: number, patch: Partial<TaxAdvance>) {
    if (section === 'income_tax') {
      const adv = taxes.income_tax.advances.map((a, j) => j === i ? { ...a, ...patch } : a)
      onTaxesChange({ ...taxes, income_tax: { ...taxes.income_tax, advances: adv } })
    } else {
      const adv = taxes[section].advances.map((a, j) => j === i ? { ...a, ...patch } : a)
      onTaxesChange({ ...taxes, [section]: { ...taxes[section], advances: adv } })
    }
  }

  function addAdvance(section: 'income_tax' | 'social' | 'health') {
    const newAdv: TaxAdvance = { period: '', amount: 0, due_date: '', paid: false }
    if (section === 'income_tax') {
      onTaxesChange({ ...taxes, income_tax: { ...taxes.income_tax, advances: [...taxes.income_tax.advances, newAdv] } })
    } else {
      onTaxesChange({ ...taxes, [section]: { ...taxes[section], advances: [...taxes[section].advances, newAdv] } })
    }
  }

  const inputCls = 'bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'

  // Filter tax-related deadlines
  const taxCalendar = taxDeadlines.filter(d => d.category !== 'dph')

  return (
    <div className="space-y-6">
      {/* Czech tax calendar - auto-generated deadlines */}
      {taxCalendar.length > 0 && (
        <div className="bg-amber/[0.04] rounded-[20px] p-6 border border-amber/10">
          <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-amber font-medium mb-3">Automaticky cesky danovy kalendar</h3>
          <div className="space-y-1.5">
            {taxCalendar.slice(0, 8).map((d, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg ${d.urgent ? 'bg-rose/[0.06]' : 'bg-white/60'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-[0.72rem] font-medium w-12 ${d.urgent ? 'text-rose-deep' : 'text-ink'}`}>
                    {d.date.split('-')[2]}.{d.date.split('-')[1]}.
                  </span>
                  <span className="text-[0.8rem] text-ink">{d.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {d.amount !== 0 && <span className="text-[0.8rem] font-medium text-rose-deep">{fmtShort(Math.abs(d.amount))}</span>}
                  {d.urgent && <span className="text-[0.5rem] tracking-[0.08em] uppercase font-semibold px-1.5 py-0.5 rounded bg-rose/20 text-rose-deep">Brzy</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Měsíční zatížení</div>
          <div className="font-serif text-xl font-light text-rose-deep leading-none">{fmtShort(totalMonthly)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">daně + odvody</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Roční odhad</div>
          <div className="font-serif text-xl font-light text-ink leading-none">{fmtShort(totalAnnual)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">celkem za rok</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Daň z příjmů</div>
          <div className="font-serif text-xl font-light text-ink leading-none">{taxes.income_tax.rate} %</div>
          <div className="text-[0.68rem] mt-1 text-mid">{taxes.entity_type === 'sro' ? 's.r.o.' : 'OSVČ'}</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Nezaplaceno</div>
          <div className="font-serif text-xl font-light text-rose-deep leading-none">
            {fmtShort(allPayments.filter(p => !p.paid).reduce((s, p) => s + p.amount, 0))}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">{allPayments.filter(p => !p.paid).length} plateb</div>
        </div>
      </div>

      {/* Payment calendar */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-4">Platební kalendář</h3>
        {allPayments.length === 0 ? (
          <p className="text-[0.8rem] text-mid">Žádné naplánované platby.</p>
        ) : (
          <div className="space-y-2">
            {allPayments.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${statusColor(p.due_date, p.paid)}`}>
                <button onClick={p.toggle}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${p.paid ? 'border-green bg-green text-white' : 'border-mid/30'}`}>
                  {p.paid && <span className="text-xs">✓</span>}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-[0.8rem] font-medium ${p.paid ? 'line-through text-mid' : 'text-ink'}`}>{p.name}</div>
                  <div className="text-[0.68rem] text-mid">{p.due_date ? new Date(p.due_date).toLocaleDateString('cs-CZ') : '···'}</div>
                </div>
                <div className={`text-[0.85rem] font-medium ${p.paid ? 'text-mid' : 'text-ink'}`}>{fmt(p.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Income tax */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif text-base text-ink">Daň z příjmů</h3>
            <button onClick={() => addAdvance('income_tax')} className="text-[0.62rem] text-mid hover:text-rose">+ Záloha</button>
          </div>
          <div className="mb-3">
            <label className="text-[0.55rem] tracking-[0.1em] uppercase text-mid">Roční odhad daně</label>
            <input type="number" value={taxes.income_tax.annual_estimate || ''} onChange={e => onTaxesChange({ ...taxes, income_tax: { ...taxes.income_tax, annual_estimate: +e.target.value || 0 } })} className={`w-full ${inputCls} text-right`} />
          </div>
          {taxes.income_tax.advances.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px] gap-1.5 mb-1 items-end">
              <input value={a.period} onChange={e => updateAdvance('income_tax', i, { period: e.target.value })} className={`${inputCls} text-xs`} placeholder="Q1 2026" />
              <input type="number" value={a.amount || ''} onChange={e => updateAdvance('income_tax', i, { amount: +e.target.value || 0 })} className={`${inputCls} text-xs text-right`} />
              <input type="date" value={a.due_date} onChange={e => updateAdvance('income_tax', i, { due_date: e.target.value })} className={`${inputCls} text-[0.6rem]`} />
            </div>
          ))}
        </div>

        {/* Social */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif text-base text-ink">Sociální pojištění</h3>
            <button onClick={() => addAdvance('social')} className="text-[0.62rem] text-mid hover:text-rose">+ Záloha</button>
          </div>
          <div className="mb-3">
            <label className="text-[0.55rem] tracking-[0.1em] uppercase text-mid">Měsíční záloha</label>
            <input type="number" value={taxes.social.monthly || ''} onChange={e => onTaxesChange({ ...taxes, social: { ...taxes.social, monthly: +e.target.value || 0 } })} className={`w-full ${inputCls} text-right`} />
          </div>
          {taxes.social.advances.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px] gap-1.5 mb-1 items-end">
              <input value={a.period} onChange={e => updateAdvance('social', i, { period: e.target.value })} className={`${inputCls} text-xs`} placeholder="Dub 2026" />
              <input type="number" value={a.amount || ''} onChange={e => updateAdvance('social', i, { amount: +e.target.value || 0 })} className={`${inputCls} text-xs text-right`} />
              <input type="date" value={a.due_date} onChange={e => updateAdvance('social', i, { due_date: e.target.value })} className={`${inputCls} text-[0.6rem]`} />
            </div>
          ))}
        </div>

        {/* Health */}
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-serif text-base text-ink">Zdravotní pojištění</h3>
            <button onClick={() => addAdvance('health')} className="text-[0.62rem] text-mid hover:text-rose">+ Záloha</button>
          </div>
          <div className="mb-3">
            <label className="text-[0.55rem] tracking-[0.1em] uppercase text-mid">Měsíční záloha</label>
            <input type="number" value={taxes.health.monthly || ''} onChange={e => onTaxesChange({ ...taxes, health: { ...taxes.health, monthly: +e.target.value || 0 } })} className={`w-full ${inputCls} text-right`} />
          </div>
          {taxes.health.advances.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px] gap-1.5 mb-1 items-end">
              <input value={a.period} onChange={e => updateAdvance('health', i, { period: e.target.value })} className={`${inputCls} text-xs`} placeholder="Dub 2026" />
              <input type="number" value={a.amount || ''} onChange={e => updateAdvance('health', i, { amount: +e.target.value || 0 })} className={`${inputCls} text-xs text-right`} />
              <input type="date" value={a.due_date} onChange={e => updateAdvance('health', i, { due_date: e.target.value })} className={`${inputCls} text-[0.6rem]`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
