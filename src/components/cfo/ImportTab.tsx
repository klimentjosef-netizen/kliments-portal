'use client'

import { useState } from 'react'
import {
  type Ledger, type LedgerItem, type TransactionCategory,
  type ReceivablesData, type Invoice, type Bill,
  genId,
} from './calcEngine'

interface ImportTabProps {
  ledger: Ledger
  receivables: ReceivablesData
  onLedgerChange: (l: Ledger) => void
  onReceivablesChange: (r: ReceivablesData) => void
}

// ── CSV helpers ──

function parseCsv(text: string): string[][] {
  // Jednoduchy CSV parser: handluje quotes a comma uvnitr quotovaneho pole.
  const rows: string[][] = []
  let cur: string[] = []
  let val = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { val += '"'; i++ } else { inQuotes = false }
      } else {
        val += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',' || c === ';') {
      cur.push(val); val = ''
    } else if (c === '\n') {
      cur.push(val); val = ''
      if (cur.some(v => v.length > 0)) rows.push(cur)
      cur = []
    } else if (c === '\r') {
      // ignore
    } else {
      val += c
    }
  }
  if (val.length > 0 || cur.length > 0) {
    cur.push(val)
    if (cur.some(v => v.length > 0)) rows.push(cur)
  }
  return rows
}

function parseCzNumber(s: string): number {
  // Czech format: "1 234,56" → 1234.56. Také handluje "1,234.56" (US).
  const cleaned = s.trim().replace(/\s/g, '').replace(/Kč/g, '').replace(/CZK/g, '')
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // 1,234.56 → 1234.56
    return parseFloat(cleaned.replace(/,/g, ''))
  }
  return parseFloat(cleaned)
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const BANK_TEMPLATE = `date,description,amount,category
2025-01-15,"Faktura 2025-001 - AB Rent s.r.o.",15125,revenue
2025-01-20,"Naklady - elektrina CEZ",-4200,cost
2025-01-25,"DPH - leden",-12500,vat
2025-01-31,"Mzdy mechaniků - leden",-180000,cost`

const INVOICE_TEMPLATE = `type,number,client_or_supplier,description,amount_net,vat_rate,issued_or_received_date,due_date,paid_date,status
issued,2025-001,AB Rent s.r.o.,Servisni prohlidka Octavia,12500,21,2025-01-15,2025-02-14,2025-02-10,paid
issued,2025-002,Petr Novak,Vymena spojky,8200,21,2025-01-22,2025-02-21,,sent
received,DOD-001,Auto Kelly,Brzdove desticky,4500,21,2025-01-18,2025-02-17,2025-02-12,paid`

// ── Bank ledger import ──

type ParsedBankRow = {
  date: string
  description: string
  amount: number
  category: TransactionCategory
  error?: string
}

function parseBankRows(rows: string[][]): { items: ParsedBankRow[]; headers: string[] } {
  if (rows.length === 0) return { items: [], headers: [] }
  const headers = rows[0].map(h => h.trim().toLowerCase())
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('datum'))
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('popis') || h.includes('text'))
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('castka') || h.includes('částka'))
  const catIdx = headers.findIndex(h => h.includes('category') || h.includes('kategorie'))

  const items: ParsedBankRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.every(v => !v.trim())) continue
    const date = r[dateIdx]?.trim() || ''
    const description = r[descIdx]?.trim() || ''
    const amountStr = r[amountIdx]?.trim() || ''
    const catStr = (r[catIdx] || '').trim().toLowerCase()
    const amount = parseCzNumber(amountStr)

    let error: string | undefined
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) error = `Neplatné datum: "${date}" (čekal YYYY-MM-DD)`
    else if (isNaN(amount)) error = `Neplatná částka: "${amountStr}"`
    else if (!description) error = `Chybí popis`

    const category: TransactionCategory =
      ['revenue', 'cost', 'tax', 'vat', 'capex', 'social', 'health', 'other'].includes(catStr)
        ? (catStr as TransactionCategory)
        : amount >= 0 ? 'revenue' : 'cost'

    items.push({ date, description, amount, category, error })
  }
  return { items, headers }
}

// ── Invoice import ──

type ParsedInvoiceRow = {
  type: 'issued' | 'received'
  number: string
  party: string
  description: string
  amount_net: number
  vat_rate: number
  issued_date: string
  due_date: string
  paid_date: string
  status: string
  error?: string
}

function parseInvoiceRows(rows: string[][]): ParsedInvoiceRow[] {
  if (rows.length === 0) return []
  const headers = rows[0].map(h => h.trim().toLowerCase())
  const find = (n: string) => headers.findIndex(h => h.includes(n))
  const idxType = find('type')
  const idxNum = find('number')
  const idxParty = find('client') >= 0 ? find('client') : find('supplier')
  const idxDesc = find('descr')
  const idxNet = find('net') >= 0 ? find('net') : find('amount')
  const idxVat = find('vat_rate') >= 0 ? find('vat_rate') : find('vat')
  const idxIssued = find('issued') >= 0 ? find('issued') : find('received') >= 0 ? find('received') : find('date')
  const idxDue = find('due')
  const idxPaid = find('paid_date')
  const idxStatus = find('status')

  const items: ParsedInvoiceRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.every(v => !v.trim())) continue
    const type = (r[idxType] || 'issued').trim().toLowerCase() === 'received' ? 'received' : 'issued'
    const number = r[idxNum]?.trim() || ''
    const party = r[idxParty]?.trim() || ''
    const description = (r[idxDesc] || '').trim()
    const amount_net = parseCzNumber(r[idxNet] || '0')
    const vat_rate = parseCzNumber(r[idxVat] || '21')
    const issued_date = (r[idxIssued] || '').trim()
    const due_date = (r[idxDue] || '').trim()
    const paid_date = (r[idxPaid] || '').trim()
    const status = (r[idxStatus] || (paid_date ? 'paid' : 'sent')).trim()

    let error: string | undefined
    if (!number) error = 'Chybí číslo faktury'
    else if (!party) error = 'Chybí klient/dodavatel'
    else if (isNaN(amount_net)) error = `Neplatná částka: ${r[idxNet]}`
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(issued_date)) error = `Neplatné datum vystavení: ${issued_date}`

    items.push({ type, number, party, description, amount_net, vat_rate, issued_date, due_date, paid_date, status, error })
  }
  return items
}

// ══════════════════════════════════════════════
// ── Component ──
// ══════════════════════════════════════════════

export default function ImportTab({ ledger, receivables, onLedgerChange, onReceivablesChange }: ImportTabProps) {
  const [bankRows, setBankRows] = useState<ParsedBankRow[]>([])
  const [invoiceRows, setInvoiceRows] = useState<ParsedInvoiceRow[]>([])
  const [bankFile, setBankFile] = useState<string>('')
  const [invoiceFile, setInvoiceFile] = useState<string>('')
  const [bankImported, setBankImported] = useState(0)
  const [invoicesImported, setInvoicesImported] = useState(0)

  async function onBankFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const { items } = parseBankRows(parseCsv(text))
    setBankRows(items)
    setBankFile(file.name)
    setBankImported(0)
  }

  async function onInvoiceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const items = parseInvoiceRows(parseCsv(text))
    setInvoiceRows(items)
    setInvoiceFile(file.name)
    setInvoicesImported(0)
  }

  function importBank() {
    const valid = bankRows.filter(r => !r.error)
    if (valid.length === 0) return

    const newLedger: Ledger = {
      bank_balance: ledger.bank_balance,
      months: ledger.months.map(m => ({ ...m, items: [...m.items] })),
    }

    for (const row of valid) {
      const month = row.date.slice(0, 7)
      let ml = newLedger.months.find(m => m.month === month)
      if (!ml) {
        ml = { month, items: [], locked: false }
        newLedger.months.push(ml)
      }
      const item: LedgerItem = {
        id: genId(),
        date: row.date,
        description: row.description,
        category: row.category,
        source: 'manual',
        amount_expected: row.amount,
        amount_actual: row.amount,
        status: 'paid',
      }
      ml.items.push(item)
    }

    newLedger.months.sort((a, b) => a.month.localeCompare(b.month))
    onLedgerChange(newLedger)
    setBankImported(valid.length)
    setBankRows([])
    setBankFile('')
  }

  function importInvoices() {
    const valid = invoiceRows.filter(r => !r.error)
    if (valid.length === 0) return

    const issued: Invoice[] = [...receivables.invoices_issued]
    const received: Bill[] = [...receivables.invoices_received]

    for (const row of valid) {
      const vat_amount = row.amount_net * (row.vat_rate / 100)
      const total = row.amount_net + vat_amount

      if (row.type === 'issued') {
        const status = (row.status === 'paid' || row.status === 'sent' || row.status === 'draft' || row.status === 'overdue')
          ? row.status as Invoice['status']
          : (row.paid_date ? 'paid' : 'sent')
        issued.push({
          id: genId(),
          number: row.number,
          client: row.party,
          description: row.description,
          amount: row.amount_net,
          vat_rate: row.vat_rate,
          vat_amount,
          total,
          issued_date: row.issued_date,
          due_date: row.due_date || row.issued_date,
          paid_date: row.paid_date || undefined,
          status,
        })
      } else {
        const status = (row.status === 'paid' || row.status === 'received' || row.status === 'approved' || row.status === 'overdue')
          ? row.status as Bill['status']
          : (row.paid_date ? 'paid' : 'received')
        received.push({
          id: genId(),
          number: row.number,
          supplier: row.party,
          description: row.description,
          amount: row.amount_net,
          vat_rate: row.vat_rate,
          vat_amount,
          total,
          received_date: row.issued_date,
          due_date: row.due_date || row.issued_date,
          paid_date: row.paid_date || undefined,
          status,
        })
      }
    }

    onReceivablesChange({ invoices_issued: issued, invoices_received: received })
    setInvoicesImported(valid.length)
    setInvoiceRows([])
    setInvoiceFile('')
  }

  const bankErrors = bankRows.filter(r => r.error).length
  const bankValid = bankRows.length - bankErrors
  const invoiceErrors = invoiceRows.filter(r => r.error).length
  const invoiceValid = invoiceRows.length - invoiceErrors

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.06]">
        <h3 className="font-serif text-lg text-ink mb-2">Hromadný import dat</h3>
        <p className="text-[0.82rem] text-mid leading-relaxed mb-3">
          Nahrajte bankovní výpisy nebo faktury v CSV formátu. Systém soubor projde, ukáže náhled a po potvrzení zapíše data do ledgeru / pohledávek. Ručně přepisování stovek řádků není potřeba.
        </p>
        <p className="text-[0.78rem] text-mid">
          Nejste si jistý formátem? Stáhněte si šablonu (níže), vyplňte data, nahrajte zpět.
        </p>
      </div>

      {/* ── BANK STATEMENT IMPORT ── */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.06]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-serif text-base text-ink">1. Bankovní výpis → Cashflow ledger</h3>
            <p className="text-[0.78rem] text-mid mt-1">
              CSV se sloupci: <code className="text-[0.74rem] bg-sand px-1.5 py-0.5 rounded">date, description, amount, category</code>
            </p>
          </div>
          <button
            onClick={() => downloadCsv(BANK_TEMPLATE, 'bank-template.csv')}
            className="text-[0.72rem] tracking-[0.1em] uppercase text-rose hover:text-rose-deep px-3 py-1.5 border border-rose-pale rounded-full"
          >
            Stáhnout šablonu
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="cursor-pointer bg-rose hover:bg-rose-deep transition-colors text-white px-5 py-2 rounded-full text-[0.72rem] tracking-[0.1em] uppercase font-medium">
            Vybrat CSV soubor
            <input type="file" accept=".csv,text/csv" onChange={onBankFile} className="hidden" />
          </label>
          {bankFile && <span className="text-[0.78rem] text-mid">{bankFile} · {bankRows.length} řádků</span>}
          {bankImported > 0 && (
            <span className="text-[0.78rem] text-green">
              ✓ Importováno {bankImported} řádků do ledgeru
            </span>
          )}
        </div>

        {bankRows.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-3 text-[0.78rem]">
              <span className="text-green font-medium">{bankValid} platných</span>
              {bankErrors > 0 && <span className="text-rose-deep font-medium">{bankErrors} s chybou</span>}
            </div>
            <div className="max-h-80 overflow-auto border border-black/[0.06] rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-sand sticky top-0">
                  <tr>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Datum</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Popis</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium text-right">Částka</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Kategorie</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bankRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className={`border-t border-black/[0.04] ${r.error ? 'bg-rose-blush/30' : ''}`}>
                      <td className="py-1.5 px-3 text-[0.78rem]">{r.date}</td>
                      <td className="py-1.5 px-3 text-[0.78rem] max-w-xs truncate">{r.description}</td>
                      <td className={`py-1.5 px-3 text-[0.78rem] text-right font-mono ${r.amount < 0 ? 'text-rose-deep' : 'text-green'}`}>
                        {r.amount.toLocaleString('cs-CZ')}
                      </td>
                      <td className="py-1.5 px-3 text-[0.72rem] text-mid">{r.category}</td>
                      <td className="py-1.5 px-3 text-[0.72rem]">
                        {r.error ? <span className="text-rose-deep">⚠ {r.error}</span> : <span className="text-green">✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bankRows.length > 100 && (
                <p className="text-[0.72rem] text-mid p-2 text-center">+ {bankRows.length - 100} dalších řádků (zobrazeno prvních 100)</p>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={importBank}
                disabled={bankValid === 0}
                className="bg-rose hover:bg-rose-deep transition-colors text-white px-6 py-2 rounded-full text-[0.72rem] tracking-[0.1em] uppercase font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Importovat {bankValid} řádků
              </button>
              <button
                onClick={() => { setBankRows([]); setBankFile('') }}
                className="text-[0.72rem] tracking-[0.1em] uppercase text-mid hover:text-ink px-4 py-2"
              >
                Zrušit
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── INVOICES IMPORT ── */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.06]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-serif text-base text-ink">2. Faktury (vydané + přijaté) → Pohledávky</h3>
            <p className="text-[0.78rem] text-mid mt-1">
              CSV se sloupci: <code className="text-[0.74rem] bg-sand px-1.5 py-0.5 rounded">type, number, client_or_supplier, amount_net, vat_rate, issued_or_received_date, due_date, paid_date, status</code>
            </p>
          </div>
          <button
            onClick={() => downloadCsv(INVOICE_TEMPLATE, 'invoices-template.csv')}
            className="text-[0.72rem] tracking-[0.1em] uppercase text-rose hover:text-rose-deep px-3 py-1.5 border border-rose-pale rounded-full"
          >
            Stáhnout šablonu
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="cursor-pointer bg-rose hover:bg-rose-deep transition-colors text-white px-5 py-2 rounded-full text-[0.72rem] tracking-[0.1em] uppercase font-medium">
            Vybrat CSV soubor
            <input type="file" accept=".csv,text/csv" onChange={onInvoiceFile} className="hidden" />
          </label>
          {invoiceFile && <span className="text-[0.78rem] text-mid">{invoiceFile} · {invoiceRows.length} řádků</span>}
          {invoicesImported > 0 && (
            <span className="text-[0.78rem] text-green">
              ✓ Importováno {invoicesImported} faktur
            </span>
          )}
        </div>

        {invoiceRows.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-3 text-[0.78rem]">
              <span className="text-green font-medium">{invoiceValid} platných</span>
              {invoiceErrors > 0 && <span className="text-rose-deep font-medium">{invoiceErrors} s chybou</span>}
            </div>
            <div className="max-h-80 overflow-auto border border-black/[0.06] rounded-lg">
              <table className="w-full text-left">
                <thead className="bg-sand sticky top-0">
                  <tr>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Typ</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Číslo</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Strana</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium text-right">Bez DPH</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">DPH</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Vystaveno</th>
                    <th className="text-[0.62rem] uppercase tracking-wider text-mid py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className={`border-t border-black/[0.04] ${r.error ? 'bg-rose-blush/30' : ''}`}>
                      <td className="py-1.5 px-3 text-[0.72rem] uppercase tracking-wider text-mid">{r.type}</td>
                      <td className="py-1.5 px-3 text-[0.78rem] font-mono">{r.number}</td>
                      <td className="py-1.5 px-3 text-[0.78rem] max-w-xs truncate">{r.party}</td>
                      <td className="py-1.5 px-3 text-[0.78rem] text-right font-mono">{r.amount_net.toLocaleString('cs-CZ')}</td>
                      <td className="py-1.5 px-3 text-[0.72rem]">{r.vat_rate} %</td>
                      <td className="py-1.5 px-3 text-[0.78rem]">{r.issued_date}</td>
                      <td className="py-1.5 px-3 text-[0.72rem]">
                        {r.error ? <span className="text-rose-deep">⚠ {r.error}</span> : <span className="text-green">✓ {r.status}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoiceRows.length > 100 && (
                <p className="text-[0.72rem] text-mid p-2 text-center">+ {invoiceRows.length - 100} dalších řádků (zobrazeno prvních 100)</p>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={importInvoices}
                disabled={invoiceValid === 0}
                className="bg-rose hover:bg-rose-deep transition-colors text-white px-6 py-2 rounded-full text-[0.72rem] tracking-[0.1em] uppercase font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Importovat {invoiceValid} faktur
              </button>
              <button
                onClick={() => { setInvoiceRows([]); setInvoiceFile('') }}
                className="text-[0.72rem] tracking-[0.1em] uppercase text-mid hover:text-ink px-4 py-2"
              >
                Zrušit
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tips */}
      <div className="bg-sand rounded-2xl p-5 border border-rose-pale">
        <p className="text-[0.78rem] font-medium text-ink mb-2">💡 Tipy pro export z účetních SW</p>
        <ul className="text-[0.78rem] text-mid space-y-1.5 list-disc list-inside">
          <li><strong>Pohoda:</strong> Účetnictví → Sestavy → Hlavní kniha → Export do CSV (Excel)</li>
          <li><strong>Money S3:</strong> Účetnictví → Účetní deník → tlačítko „Export" → vyberte CSV</li>
          <li><strong>Banka (ČSOB, KB, Air Bank, mBank):</strong> Internet banking → Historie → Export → CSV</li>
          <li>Pokud má soubor jiné názvy sloupců, otevřete ho v Excelu a přejmenujte hlavičku podle šablony.</li>
        </ul>
      </div>
    </div>
  )
}
