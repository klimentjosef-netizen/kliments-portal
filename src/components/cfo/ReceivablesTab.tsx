'use client'

import { useState } from 'react'
import { type ReceivablesData, type Invoice, type Bill, type InvoiceStatus, type BillStatus, calcAging, genId, fmt, fmtShort } from './calcEngine'

interface ReceivablesTabProps {
  receivables: ReceivablesData
  onReceivablesChange: (r: ReceivablesData) => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-black/5 text-mid',
  sent: 'bg-amber/10 text-amber',
  received: 'bg-amber/10 text-amber',
  approved: 'bg-[#d4e8f5] text-[#2a6496]',
  paid: 'bg-green/10 text-green',
  overdue: 'bg-rose/10 text-rose-deep',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  sent: 'Odesláno',
  received: 'Přijato',
  approved: 'Schváleno',
  paid: 'Zaplaceno',
  overdue: 'Po splatnosti',
}

export default function ReceivablesTab({ receivables, onReceivablesChange }: ReceivablesTabProps) {
  const [view, setView] = useState<'issued' | 'received'>('issued')
  const aging = calcAging(receivables.invoices_issued)

  const totalReceivables = receivables.invoices_issued.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0)
  const totalPayables = receivables.invoices_received.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0)
  const overdue = receivables.invoices_issued.filter(i => i.status === 'overdue')

  function addInvoice() {
    const inv: Invoice = {
      id: genId(), number: '', client: '', description: '', amount: 0,
      vat_rate: 21, vat_amount: 0, total: 0,
      issued_date: new Date().toISOString().slice(0, 10),
      due_date: '', status: 'draft',
    }
    onReceivablesChange({ ...receivables, invoices_issued: [...receivables.invoices_issued, inv] })
  }

  function updateInvoice(id: string, patch: Partial<Invoice>) {
    const invoices = receivables.invoices_issued.map(inv => {
      if (inv.id !== id) return inv
      const updated = { ...inv, ...patch }
      if ('amount' in patch || 'vat_rate' in patch) {
        updated.vat_amount = Math.round(updated.amount * updated.vat_rate / 100)
        updated.total = updated.amount + updated.vat_amount
      }
      // Auto-detect overdue
      if (updated.status !== 'paid' && updated.due_date && new Date(updated.due_date) < new Date()) {
        updated.status = 'overdue'
      }
      return updated
    })
    onReceivablesChange({ ...receivables, invoices_issued: invoices })
  }

  function removeInvoice(id: string) {
    onReceivablesChange({ ...receivables, invoices_issued: receivables.invoices_issued.filter(i => i.id !== id) })
  }

  function addBill() {
    const bill: Bill = {
      id: genId(), number: '', supplier: '', description: '', amount: 0,
      vat_rate: 21, vat_amount: 0, total: 0,
      received_date: new Date().toISOString().slice(0, 10),
      due_date: '', status: 'received',
    }
    onReceivablesChange({ ...receivables, invoices_received: [...receivables.invoices_received, bill] })
  }

  function updateBill(id: string, patch: Partial<Bill>) {
    const bills = receivables.invoices_received.map(b => {
      if (b.id !== id) return b
      const updated = { ...b, ...patch }
      if ('amount' in patch || 'vat_rate' in patch) {
        updated.vat_amount = Math.round(updated.amount * updated.vat_rate / 100)
        updated.total = updated.amount + updated.vat_amount
      }
      return updated
    })
    onReceivablesChange({ ...receivables, invoices_received: bills })
  }

  function removeBill(id: string) {
    onReceivablesChange({ ...receivables, invoices_received: receivables.invoices_received.filter(i => i.id !== id) })
  }

  const inputCls = 'bg-transparent border-b border-black/10 py-1.5 text-sm outline-none focus:border-rose transition-colors'

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Pohledávky</div>
          <div className="font-serif text-xl font-light text-ink leading-none">{fmtShort(totalReceivables)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">{receivables.invoices_issued.filter(i => i.status !== 'paid').length} nezaplacených</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Závazky</div>
          <div className="font-serif text-xl font-light text-ink leading-none">{fmtShort(totalPayables)}</div>
          <div className="text-[0.68rem] mt-1 text-mid">{receivables.invoices_received.filter(i => i.status !== 'paid').length} nezaplacených</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Po splatnosti</div>
          <div className="font-serif text-xl font-light text-rose-deep leading-none">{fmtShort(overdue.reduce((s, i) => s + i.total, 0))}</div>
          <div className="text-[0.68rem] mt-1 text-mid">{overdue.length} faktur</div>
        </div>
        <div className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
          <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">Čistá pozice</div>
          <div className={`font-serif text-xl font-light leading-none ${totalReceivables - totalPayables >= 0 ? 'text-green' : 'text-rose-deep'}`}>
            {fmtShort(totalReceivables - totalPayables)}
          </div>
          <div className="text-[0.68rem] mt-1 text-mid">pohledávky − závazky</div>
        </div>
      </div>

      {/* Aging report */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-4">Aging report — pohledávky</h3>
        <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
          {[
            { label: 'Aktuální', value: aging.current, color: 'bg-green' },
            { label: '1-30 dnů', value: aging.d30, color: 'bg-amber' },
            { label: '31-60 dnů', value: aging.d60, color: 'bg-[#d4914a]' },
            { label: '61-90 dnů', value: aging.d90, color: 'bg-rose' },
            { label: '90+ dnů', value: aging.d90plus, color: 'bg-rose-deep' },
          ].filter(s => s.value > 0).map((s, i) => (
            <div key={i} className={`${s.color} flex items-center justify-center text-white text-[0.55rem] font-medium`}
              style={{ width: `${aging.total > 0 ? (s.value / aging.total * 100) : 0}%`, minWidth: s.value > 0 ? '40px' : 0 }}
              title={`${s.label}: ${fmt(s.value)}`}>
              {s.label}
            </div>
          ))}
          {aging.total === 0 && <div className="bg-sand-deep flex-1 flex items-center justify-center text-[0.65rem] text-mid">Žádné pohledávky</div>}
        </div>
        <div className="flex gap-4 mt-2 text-[0.62rem] text-mid">
          <span>Aktuální: {fmt(aging.current)}</span>
          <span>1-30d: {fmt(aging.d30)}</span>
          <span>31-60d: {fmt(aging.d60)}</span>
          <span>61-90d: {fmt(aging.d90)}</span>
          <span>90+d: {fmt(aging.d90plus)}</span>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('issued')} className={`px-5 py-2 rounded-full text-[0.72rem] font-medium transition-colors ${view === 'issued' ? 'bg-rose text-white' : 'bg-white border border-black/10 text-mid'}`}>
          Vydané faktury ({receivables.invoices_issued.length})
        </button>
        <button onClick={() => setView('received')} className={`px-5 py-2 rounded-full text-[0.72rem] font-medium transition-colors ${view === 'received' ? 'bg-rose text-white' : 'bg-white border border-black/10 text-mid'}`}>
          Přijaté faktury ({receivables.invoices_received.length})
        </button>
      </div>

      {/* Invoices issued */}
      {view === 'issued' && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-base text-ink">Vydané faktury</h3>
            <button onClick={addInvoice} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">+ Nová faktura</button>
          </div>
          {receivables.invoices_issued.length === 0 ? (
            <p className="text-[0.8rem] text-mid text-center py-4">Žádné vydané faktury.</p>
          ) : (
            <div className="space-y-2">
              {receivables.invoices_issued.map(inv => (
                <div key={inv.id} className={`p-3 rounded-lg border ${inv.status === 'paid' ? 'bg-[#eef6f1] border-green/10' : inv.status === 'overdue' ? 'bg-[#fdf0f0] border-rose/10' : 'bg-sand-pale border-black/[0.04]'}`}>
                  <div className="grid grid-cols-[80px_120px_1fr_80px_80px_80px_90px_30px] gap-2 items-center">
                    <input value={inv.number} onChange={e => updateInvoice(inv.id, { number: e.target.value })} placeholder="FV-001" className={`${inputCls} text-xs font-medium`} />
                    <input value={inv.client} onChange={e => updateInvoice(inv.id, { client: e.target.value })} placeholder="Klient" className={`${inputCls} text-xs`} />
                    <input value={inv.description} onChange={e => updateInvoice(inv.id, { description: e.target.value })} placeholder="Popis" className={`${inputCls} text-xs`} />
                    <input type="number" value={inv.amount || ''} onChange={e => updateInvoice(inv.id, { amount: +e.target.value || 0 })} placeholder="Základ" className={`${inputCls} text-xs text-right`} />
                    <select value={inv.vat_rate} onChange={e => updateInvoice(inv.id, { vat_rate: +e.target.value })} className={`${inputCls} text-xs`}>
                      <option value={0}>0%</option><option value={12}>12%</option><option value={21}>21%</option>
                    </select>
                    <div className="text-[0.72rem] text-right font-medium text-ink">{fmt(inv.total)}</div>
                    <select value={inv.status} onChange={e => updateInvoice(inv.id, { status: e.target.value as InvoiceStatus, paid_date: e.target.value === 'paid' ? new Date().toISOString().slice(0, 10) : undefined })}
                      className={`text-[0.55rem] font-semibold px-2 py-0.5 rounded-full outline-none cursor-pointer ${STATUS_COLORS[inv.status]}`}>
                      <option value="draft">{STATUS_LABELS.draft}</option>
                      <option value="sent">{STATUS_LABELS.sent}</option>
                      <option value="paid">{STATUS_LABELS.paid}</option>
                      <option value="overdue">{STATUS_LABELS.overdue}</option>
                    </select>
                    <button onClick={() => removeInvoice(inv.id)} className="text-mid hover:text-rose-deep text-sm">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div className="flex gap-2 items-center">
                      <span className="text-[0.55rem] text-mid">Vystaveno:</span>
                      <input type="date" value={inv.issued_date} onChange={e => updateInvoice(inv.id, { issued_date: e.target.value })} className="bg-transparent text-[0.65rem] text-mid outline-none" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[0.55rem] text-mid">Splatnost:</span>
                      <input type="date" value={inv.due_date} onChange={e => updateInvoice(inv.id, { due_date: e.target.value })} className="bg-transparent text-[0.65rem] text-mid outline-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoices received */}
      {view === 'received' && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif text-base text-ink">Přijaté faktury</h3>
            <button onClick={addBill} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">+ Nová faktura</button>
          </div>
          {receivables.invoices_received.length === 0 ? (
            <p className="text-[0.8rem] text-mid text-center py-4">Žádné přijaté faktury.</p>
          ) : (
            <div className="space-y-2">
              {receivables.invoices_received.map(bill => (
                <div key={bill.id} className={`p-3 rounded-lg border ${bill.status === 'paid' ? 'bg-[#eef6f1] border-green/10' : 'bg-sand-pale border-black/[0.04]'}`}>
                  <div className="grid grid-cols-[80px_120px_1fr_80px_80px_80px_90px_30px] gap-2 items-center">
                    <input value={bill.number} onChange={e => updateBill(bill.id, { number: e.target.value })} placeholder="FP-001" className={`${inputCls} text-xs font-medium`} />
                    <input value={bill.supplier} onChange={e => updateBill(bill.id, { supplier: e.target.value })} placeholder="Dodavatel" className={`${inputCls} text-xs`} />
                    <input value={bill.description} onChange={e => updateBill(bill.id, { description: e.target.value })} placeholder="Popis" className={`${inputCls} text-xs`} />
                    <input type="number" value={bill.amount || ''} onChange={e => updateBill(bill.id, { amount: +e.target.value || 0 })} placeholder="Základ" className={`${inputCls} text-xs text-right`} />
                    <select value={bill.vat_rate} onChange={e => updateBill(bill.id, { vat_rate: +e.target.value })} className={`${inputCls} text-xs`}>
                      <option value={0}>0%</option><option value={12}>12%</option><option value={21}>21%</option>
                    </select>
                    <div className="text-[0.72rem] text-right font-medium text-ink">{fmt(bill.total)}</div>
                    <select value={bill.status} onChange={e => updateBill(bill.id, { status: e.target.value as BillStatus, paid_date: e.target.value === 'paid' ? new Date().toISOString().slice(0, 10) : undefined })}
                      className={`text-[0.55rem] font-semibold px-2 py-0.5 rounded-full outline-none cursor-pointer ${STATUS_COLORS[bill.status]}`}>
                      <option value="received">{STATUS_LABELS.received}</option>
                      <option value="approved">{STATUS_LABELS.approved}</option>
                      <option value="paid">{STATUS_LABELS.paid}</option>
                    </select>
                    <button onClick={() => removeBill(bill.id)} className="text-mid hover:text-rose-deep text-sm">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div className="flex gap-2 items-center">
                      <span className="text-[0.55rem] text-mid">Přijato:</span>
                      <input type="date" value={bill.received_date} onChange={e => updateBill(bill.id, { received_date: e.target.value })} className="bg-transparent text-[0.65rem] text-mid outline-none" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-[0.55rem] text-mid">Splatnost:</span>
                      <input type="date" value={bill.due_date} onChange={e => updateBill(bill.id, { due_date: e.target.value })} className="bg-transparent text-[0.65rem] text-mid outline-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
