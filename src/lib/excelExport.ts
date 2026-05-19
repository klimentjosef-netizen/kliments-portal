/**
 * Export CFO reportu do Excel (.xlsx) souboru.
 * Pouziva se v CFO sekci pres tlacitko "Export Excel".
 *
 * Vystupni soubor obsahuje 4-5 listu:
 *   1. Souhrn (KPI, EBITDA, marže, rezerva)
 *   2. Ledger po měsících (vsechny transakce)
 *   3. Faktury vydane
 *   4. Faktury prijate
 *   5. Roční srovnání (YoY) pokud je dostupne víc let
 */

import * as XLSX from 'xlsx'
import {
  type Ledger, type ReceivablesData, type Tier, type CostItem,
  calcYearAggregate, calcYearsAggregate,
} from '@/components/cfo/calcEngine'

interface ExportOpts {
  filename: string
  clientName?: string
  ledger: Ledger
  receivables: ReceivablesData
  tiers: Tier[]
  fixedCosts: CostItem[]
  variablePct: number
}

export function exportCfoExcel(opts: ExportOpts) {
  const { filename, clientName, ledger, receivables, tiers, fixedCosts, variablePct } = opts
  const wb = XLSX.utils.book_new()

  // ── Detekce roků v ledgeru ──
  const years = Array.from(new Set(
    ledger.months
      .filter(m => m.items.length > 0)
      .map(m => parseInt(m.month.slice(0, 4), 10))
      .filter(y => !isNaN(y))
  )).sort()

  // ──────── List 1: SOUHRN ────────
  const summary: (string | number)[][] = [
    ['CFO REPORT' + (clientName ? ` — ${clientName}` : '')],
    [`Generováno: ${new Date().toLocaleDateString('cs-CZ')}`],
    [],
    ['Parametry'],
    ['Počet kategorií tržeb', tiers.length],
    ['Variabilní náklady (%)', variablePct],
    ['Celkové měsíční fixní náklady (Kč)', fixedCosts.reduce((s, c) => s + c.amount, 0)],
    ['Otevírací zůstatek banky (Kč)', ledger.bank_balance],
    [],
  ]

  if (years.length > 0) {
    summary.push(['Roční souhrny'])
    summary.push(['Rok', 'Tržby', 'Náklady', 'EBITDA', 'Daně', 'DPH', 'CAPEX', 'Čistý CF', 'Měsíců s daty'])
    for (const year of years) {
      const agg = calcYearAggregate(ledger, year)
      summary.push([
        agg.year,
        agg.revenue,
        agg.costs,
        agg.ebitda,
        agg.taxes,
        agg.vat,
        agg.capex,
        agg.net_cashflow,
        agg.months_with_data,
      ])
    }
  } else {
    summary.push(['Žádné transakce v ledgeru.'])
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summary)
  ws1['!cols'] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Souhrn')

  // ──────── List 2: LEDGER ────────
  const ledgerRows: (string | number)[][] = [
    ['Měsíc', 'Datum', 'Popis', 'Kategorie', 'Status', 'Očekáváno (Kč)', 'Skutečnost (Kč)', 'Zdroj', 'DPH sazba', 'DPH částka'],
  ]
  for (const m of ledger.months) {
    const sorted = [...m.items].sort((a, b) => a.date.localeCompare(b.date))
    for (const it of sorted) {
      ledgerRows.push([
        m.month,
        it.date,
        it.description,
        it.category,
        it.status,
        it.amount_expected ?? 0,
        it.amount_actual ?? 0,
        it.source,
        it.vat_rate ?? '',
        it.vat_amount ?? '',
      ])
    }
  }
  const ws2 = XLSX.utils.aoa_to_sheet(ledgerRows)
  ws2['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Ledger')

  // ──────── List 3: FAKTURY VYDANÉ ────────
  const issuedRows: (string | number)[][] = [
    ['Číslo', 'Klient', 'Popis', 'Vystaveno', 'Splatnost', 'Zaplaceno', 'Status', 'Bez DPH (Kč)', 'DPH sazba', 'DPH (Kč)', 'Celkem (Kč)'],
  ]
  for (const inv of receivables.invoices_issued) {
    issuedRows.push([
      inv.number, inv.client, inv.description || '',
      inv.issued_date, inv.due_date, inv.paid_date || '',
      inv.status, inv.amount, inv.vat_rate, inv.vat_amount, inv.total,
    ])
  }
  const ws3 = XLSX.utils.aoa_to_sheet(issuedRows)
  ws3['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Faktury vydané')

  // ──────── List 4: FAKTURY PŘIJATÉ ────────
  const receivedRows: (string | number)[][] = [
    ['Číslo', 'Dodavatel', 'Popis', 'Přijato', 'Splatnost', 'Zaplaceno', 'Status', 'Bez DPH (Kč)', 'DPH sazba', 'DPH (Kč)', 'Celkem (Kč)'],
  ]
  for (const b of receivables.invoices_received) {
    receivedRows.push([
      b.number, b.supplier, b.description || '',
      b.received_date, b.due_date, b.paid_date || '',
      b.status, b.amount, b.vat_rate, b.vat_amount, b.total,
    ])
  }
  const ws4 = XLSX.utils.aoa_to_sheet(receivedRows)
  ws4['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Faktury přijaté')

  // ──────── List 5: YoY (jen pokud min. 2 roky) ────────
  if (years.length >= 2) {
    const aggs = calcYearsAggregate(ledger, years)
    const yoyRows: (string | number)[][] = [
      ['Ukazatel (Kč)', ...years.map(String)],
      ['Tržby',         ...aggs.map(a => a.revenue)],
      ['Náklady',       ...aggs.map(a => a.costs)],
      ['EBITDA',        ...aggs.map(a => a.ebitda)],
      ['EBITDA marže %', ...aggs.map(a => a.revenue ? Math.round((a.ebitda / a.revenue) * 100 * 10) / 10 : 0)],
      ['Daně',          ...aggs.map(a => a.taxes)],
      ['DPH',           ...aggs.map(a => a.vat)],
      ['CAPEX',         ...aggs.map(a => a.capex)],
      ['Sociální',      ...aggs.map(a => a.social)],
      ['Zdravotní',     ...aggs.map(a => a.health)],
      ['Ostatní',       ...aggs.map(a => a.other)],
      ['Čistý cashflow', ...aggs.map(a => a.net_cashflow)],
      ['Měsíců s daty', ...aggs.map(a => a.months_with_data)],
    ]
    const ws5 = XLSX.utils.aoa_to_sheet(yoyRows)
    ws5['!cols'] = [{ wch: 24 }, ...years.map(() => ({ wch: 16 }))]
    XLSX.utils.book_append_sheet(wb, ws5, 'Meziroční srovnání')
  }

  // ── Write file ──
  XLSX.writeFile(wb, filename)
}
