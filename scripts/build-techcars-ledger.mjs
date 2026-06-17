// Sestaví CFO data pro TechCars z účetních XLSX (2024, 2025).
// Princip: roční P&L = oficiální z výkazu (v tis. Kč); měsíční tvar z knih faktur
// se naškáluje na roční oficiální součty (řeší DPH i zaokrouhlení).
// Výstup = JSON artefakt k revizi (DO DB se zapisuje až samostatným krokem).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import pkg from 'xlsx'
const XLSX = pkg.default || pkg

const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'
const YEARS = [2024, 2025]

function sheet(file) {
  const wb = XLSX.read(readFileSync(file), { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) // pole objektů dle hlavičky
}
function num(v) {
  if (typeof v === 'number') return v
  if (!v) return 0
  return parseFloat(String(v).replace(/\s/g, '').replace(',', '.')) || 0
}
function ym(d) {
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt)) return null
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

// ── 1) Oficiální roční P&L z výkazu ──
function parseVykaz(year) {
  const f = `${BASE}/${year}/${year === 2024 ? 'výkaz_2024_01-2024_12.xlsx' : 'vykaz_2025_01-2025_12.xlsx'}`
  const rows = sheet(f)
  const find = (re) => {
    const r = rows.find((x) => re.test(String(x.TEXT || '')))
    return r ? { netto: num(r.NETTO) * 1000, min: num(r.NETTO_MIN) * 1000, text: r.TEXT } : null
  }
  return {
    trzby_vyrobky: find(/Tržby z prodeje výrobk/i),
    trzby_zbozi: find(/Tržby za prodej zboží/i),
    vykonova_spotreba: find(/^Výkonová spotřeba/i) || find(/Výkonová spotřeba/i),
    osobni_naklady: find(/Osobní náklady/i),
    odpisy: find(/Úpravy hodnot.*dlouhodob|Odpisy/i),
    provozni_vh: find(/Provozní výsledek hospodař/i),
    vh_obdobi: find(/Výsledek hospodaření za účetní obd/i),
  }
}

// ── 2) Měsíční váhy z knihy faktur (Datum usk. v daném roce) ──
function monthlyWeights(file, year) {
  let rows
  try { rows = sheet(file) } catch { return {} }
  const weights = {}
  for (const r of rows) {
    const dKey = Object.keys(r).find((k) => /Datum usk/i.test(k))
    const fKey = Object.keys(r).find((k) => /Fakturov/i.test(k))
    if (!dKey || !fKey) continue
    const m = ym(r[dKey])
    if (!m || !m.startsWith(String(year))) continue
    weights[m] = (weights[m] || 0) + num(r[fKey])
  }
  return weights
}

// rozprostře roční total na 12 měsíců dle vah (fallback rovnoměrně)
function distribute(annualTotal, weights, year) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const sum = months.reduce((s, m) => s + (weights[m] || 0), 0)
  return months.map((m) => ({
    month: m,
    value: Math.round(sum > 0 ? (annualTotal * (weights[m] || 0)) / sum : annualTotal / 12),
  }))
}

// ── 3) Otevřené pohledávky (detail) ──
function parseOpen(file, kind) {
  let rows
  try { rows = sheet(file) } catch { return [] }
  const out = []
  for (const r of rows) {
    const desc = String(r.POPIS || '')
    if (/DPH|Zaokrouhl/i.test(desc)) continue // jen hlavní řádky
    const amt = num(r.CASTKA_MT) - num(r.CASTKA_DT)
    if (!amt) continue
    out.push({
      number: String(r.CISLO || ''),
      partner: String(r.PARTNER || r.POPIS || '').slice(0, 40),
      description: desc.slice(0, 60),
      amount: Math.round(amt),
      date: ym(r.DATUM) || '',
      kind,
    })
  }
  return out
}

// ── Sestavení ──
const result = { years: {}, cashflow_months: [], kpis: [], generated_for: 'TechCars Servis s.r.o.' }

for (const year of YEARS) {
  const v = parseVykaz(year)
  const revAnnual = (v.trzby_vyrobky?.netto || 0) + (v.trzby_zbozi?.netto || 0)
  const costAnnual = (v.vykonova_spotreba?.netto || 0) + (v.osobni_naklady?.netto || 0) + (v.odpisy?.netto || 0)
  const ebitAnnual = v.provozni_vh?.netto ?? (revAnnual - costAnnual)

  const revW = monthlyWeights(`${BASE}/${year}/prehled vydanych faktur.xlsx`, year)
  const costW = monthlyWeights(`${BASE}/${year}/prehled prijatych faktur.xlsx`, year)
  const revM = distribute(revAnnual, revW, year)
  const costM = distribute(costAnnual, costW, year)

  result.years[year] = {
    revenue_annual: revAnnual,
    cost_annual: costAnnual,
    ebit_annual: ebitAnnual,
    profit_annual: v.vh_obdobi?.netto ?? null,
    breakdown: {
      vykonova_spotreba: v.vykonova_spotreba?.netto || 0,
      osobni_naklady: v.osobni_naklady?.netto || 0,
      odpisy: v.odpisy?.netto || 0,
    },
  }

  let cum = result.cashflow_months.length
    ? result.cashflow_months[result.cashflow_months.length - 1].cumulative
    : 0
  for (let i = 0; i < 12; i++) {
    const revenue = revM[i].value
    const costs = costM[i].value
    const ebitda = revenue - costs
    cum += ebitda
    result.cashflow_months.push({ label: revM[i].month, revenue, costs, ebitda, cumulative: cum })
  }
}

// KPI z posledního roku
const last = YEARS[YEARS.length - 1]
const ly = result.years[last]
result.kpis = [
  { label: `Tržby ${last}`, value: ly.revenue_annual.toLocaleString('cs-CZ') + ' Kč' },
  { label: `Provozní VH ${last}`, value: (ly.ebit_annual || 0).toLocaleString('cs-CZ') + ' Kč' },
  { label: `Výsledek ${last}`, value: (ly.profit_annual || 0).toLocaleString('cs-CZ') + ' Kč' },
]

// Otevřené pohledávky/závazky (rok 2025 = poslední stav)
result.open_receivables = parseOpen(`${BASE}/2025/OPEN_POHLEDAVKY.XLS.xlsx`, 'receivable')
result.open_payables = parseOpen(`${BASE}/2025/OPEN_ZAVAZKY.XLS.xlsx`, 'payable')

mkdirSync('C:/Users/klime/projects/kliments-portal/data/techcars', { recursive: true })
writeFileSync(
  'C:/Users/klime/projects/kliments-portal/data/techcars/techcars-cfo-data.json',
  JSON.stringify(result, null, 2)
)

// ── Souhrn na konzoli (revize) ──
for (const y of YEARS) {
  const r = result.years[y]
  console.log(`\n=== ${y} (oficiální výkaz) ===`)
  console.log(`  Tržby:        ${r.revenue_annual.toLocaleString('cs-CZ')} Kč`)
  console.log(`  Náklady:      ${r.cost_annual.toLocaleString('cs-CZ')} Kč  (výk.spotřeba ${r.breakdown.vykonova_spotreba.toLocaleString('cs-CZ')}, osobní ${r.breakdown.osobni_naklady.toLocaleString('cs-CZ')}, odpisy ${r.breakdown.odpisy.toLocaleString('cs-CZ')})`)
  console.log(`  Provozní VH:  ${(r.ebit_annual||0).toLocaleString('cs-CZ')} Kč`)
  console.log(`  Výsledek:     ${(r.profit_annual??0).toLocaleString('cs-CZ')} Kč`)
}
console.log(`\n=== Měsíční cashflow: ${result.cashflow_months.length} měsíců ===`)
console.log('  první:', JSON.stringify(result.cashflow_months[0]))
console.log('  poslední:', JSON.stringify(result.cashflow_months[result.cashflow_months.length - 1]))
console.log(`\n=== Otevřené pohledávky: ${result.open_receivables.length} | závazky: ${result.open_payables.length} ===`)
console.log('Artefakt: data/techcars/techcars-cfo-data.json')
