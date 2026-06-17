// FINÁLNÍ build + zápis do reportu TechCars.
// Ledger: 2024+2025 skutečnost (paid) + 2026 očekávané (expected, z forecastu).
// Kategorie položek: tržby / materiál-variabilní / mzdy+odvody / provozní režie
// (bez odpisů = peněžní pohled). Roky striktně oddělené (klíč month = YYYY-MM).
import { readFileSync, writeFileSync } from 'node:fs'
import pkg from 'xlsx'
import { createClient } from '@supabase/supabase-js'
const XLSX = pkg.default || pkg
const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'
const REPORT_ID = 'cd2556ba-3480-42cb-934b-f98944fdd97b'
const WRITE = process.argv.includes('--write')

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function sheet(f) { const wb = XLSX.read(readFileSync(f), { type: 'buffer', cellDates: true }); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) }
const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.')) || 0)
function vykaz(year, f) {
  const rows = sheet(`${BASE}/${year}/${f}`)
  const g = (re) => { const r = rows.find((x) => re.test(String(x.TEXT || ''))); return r ? Number(r.NETTO) * 1000 : 0 }
  return {
    trzby: g(/Tržby z prodeje výrobk/i), zbozi: g(/Náklady vynaložené na prodané zboží/i),
    material: g(/Spotřeba materiálu a energie/i), sluzby: g(/3\.\s*Služby|^Služby|Služby/i),
    osobni: g(/Osobní náklady/i), odpisy: g(/Úpravy hodnot v provozní/i),
    ost_vyn: g(/Ostatní provozní výnosy/i), ost_nakl: g(/Ostatní provozní náklady/i),
    provozni_vh: g(/Provozní výsledek hospodař/i), vysledek: g(/Výsledek hospodaření za účetní obd/i),
  }
}
const V = { 2024: vykaz(2024, 'výkaz_2024_01-2024_12.xlsx'), 2025: vykaz(2025, 'vykaz_2025_01-2025_12.xlsx') }
const an = JSON.parse(readFileSync(new URL('../data/techcars/techcars-analysis.json', import.meta.url), 'utf8'))
const fc = JSON.parse(readFileSync(new URL('../data/techcars/techcars-forecast.json', import.meta.url), 'utf8'))

// sezónní index (suma=12) z průměru 2024/2025 příjmů
const seasonRaw = Array.from({ length: 12 }, (_, i) => (an.income[2024].seasonality[i].index + an.income[2025].seasonality[i].index) / 2)
const season = seasonRaw.map((s) => (s * 12) / seasonRaw.reduce((a, b) => a + b, 0))

let _id = 0
// Znaménková konvence enginu: příjmy +, náklady/odvody/daně −.
const mkItem = (date, description, category, source, amount, actual) => {
  const income = category === 'revenue'
  const signed = Math.round(income ? Math.abs(amount) : -Math.abs(amount))
  return {
    id: `tc-${++_id}`, date, description, category, source,
    amount_expected: signed, amount_actual: actual ? signed : 0,
    status: actual ? 'paid' : 'expected',
  }
}

function monthsForYear(year) {
  const v = V[year]
  const revAnnual = v.trzby + v.ost_vyn
  const matAnnual = v.material + v.zbozi
  const payrollAnnual = v.osobni
  const overheadAnnual = v.sluzby + v.ost_nakl
  const months = []
  for (let i = 0; i < 12; i++) {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`
    const s = season[i]
    const revenue = (revAnnual / 12) * s
    const material = (matAnnual / 12) * s   // variabilní → sezónní jako tržby
    const payroll = payrollAnnual / 12       // fixní rovnoměrně
    const overhead = overheadAnnual / 12
    months.push({
      month, locked: true,
      items: [
        mkItem(`${month}-15`, 'Tržby z prodeje služeb a výrobků', 'revenue', 'invoice', revenue, true),
        mkItem(`${month}-15`, 'Materiál a díly (variabilní)', 'cost', 'bill', material, true),
        mkItem(`${month}-15`, 'Mzdy a odvody (pravidelné)', 'cost', 'fixed_cost', payroll, true),
        mkItem(`${month}-15`, 'Provozní režie – služby, nájem (pravidelné)', 'cost', 'fixed_cost', overhead, true),
      ],
    })
  }
  return months
}

function months2026() {
  // locked:true → /cfo stránka je nepřegeneruje (jinak by smazala tržby+variabilní
  // a nechala jen fixní náklady, protože autoservis nemá tarify/členy).
  return fc.months.map((m, i) => ({
    month: m.label, locked: true,
    items: [
      mkItem(`${m.label}-15`, 'Tržby – plán 2026', 'revenue', 'invoice', m.revenue + Math.round(fc.annual.other_income / 12), false),
      mkItem(`${m.label}-15`, 'Materiál a díly (variabilní) – plán', 'cost', 'bill', m.variable, false),
      mkItem(`${m.label}-15`, 'Mzdy a odvody – plán', 'cost', 'fixed_cost', Math.round(V[2025].osobni * 1.04 / 12), false),
      mkItem(`${m.label}-15`, 'Provozní režie – plán', 'cost', 'fixed_cost', Math.round((V[2025].sluzby + V[2025].ost_nakl) * 1.04 / 12), false),
    ],
  }))
}

// bankovní zůstatek = poslední ZUSTATEK z deníku 2025
let bankBalance = 0
try { const d = sheet(`${BASE}/2025/denik.xlsx`); bankBalance = Math.round(num(d[d.length - 1].ZUSTATEK)) } catch {}

const ledgerMonths = [...monthsForYear(2024), ...monthsForYear(2025), ...months2026()]

// cashflow_months (36) z ledgeru
let cum = 0
const cashflow_months = ledgerMonths.map((m) => {
  const val = (it) => (it.status === 'paid' ? it.amount_actual : it.amount_expected)
  const revenue = m.items.filter((it) => it.category === 'revenue').reduce((s, it) => s + val(it), 0)
  const costs = Math.abs(m.items.filter((it) => it.category !== 'revenue').reduce((s, it) => s + val(it), 0)) // náklady jsou záporné → abs
  const ebitda = revenue - costs; cum += ebitda
  return { label: m.month, revenue, costs, ebitda, cumulative: cum }
})

// pohledávky/závazky z OPEN souborů
function parseOpen(file) {
  let rows; try { rows = sheet(file) } catch { return [] }
  const out = []
  for (const r of rows) {
    const desc = String(r.POPIS || '')
    if (/DPH|Zaokrouhl/i.test(desc)) continue
    const amt = num(r.CASTKA_MT) - num(r.CASTKA_DT); if (!amt) continue
    const dt = r.DATUM instanceof Date ? r.DATUM : new Date(r.DATUM)
    out.push({ id: `o-${out.length + 1}`, number: String(r.CISLO || ''), client: String(r.POPIS || '').slice(0, 50),
      description: desc.slice(0, 60), amount: Math.round(amt), vat_rate: 21, vat_amount: 0, total: Math.round(amt),
      issued_date: isNaN(dt) ? '' : dt.toISOString().slice(0, 10), due_date: '', status: 'overdue' })
  }
  return out
}
const receivables = {
  invoices_issued: parseOpen(`${BASE}/2025/OPEN_POHLEDAVKY.XLS.xlsx`),
  invoices_received: parseOpen(`${BASE}/2025/OPEN_ZAVAZKY.XLS.xlsx`).map((b) => ({
    id: b.id, number: b.number, supplier: b.client, description: b.description, amount: b.amount,
    vat_rate: 21, vat_amount: 0, total: b.total, received_date: b.issued_date, due_date: '', status: 'overdue' })),
}

// monthly_pnl (poslední rok 2025)
const monthly_pnl = {
  revenues: [{ name: 'Tržby z prodeje služeb', amount: V[2025].trzby }, { name: 'Ostatní provozní výnosy', amount: V[2025].ost_vyn }],
  costs: [
    { name: 'Materiál a díly (variabilní)', amount: V[2025].material + V[2025].zbozi },
    { name: 'Služby a režie', amount: V[2025].sluzby + V[2025].ost_nakl },
    { name: 'Osobní náklady (mzdy + odvody)', amount: V[2025].osobni },
    { name: 'Odpisy', amount: V[2025].odpisy },
  ],
}
const fmt = (n) => Math.round(n).toLocaleString('cs-CZ') + ' Kč'
const kpis = [
  { label: 'Tržby 2025', value: fmt(V[2025].trzby), delta: '+11 % vs 2024', up: true },
  { label: 'Provozní VH 2025', value: fmt(V[2025].provozni_vh), delta: 'ztráta', up: false },
  { label: 'EBITDA 2025', value: fmt(V[2025].provozni_vh + V[2025].odpisy), delta: 'téměř 0', up: false },
  { label: 'Forecast EBIT 2026', value: fmt(fc.annual.ebit), delta: 'při +4 % tržeb', up: false },
]

const patch = {
  tiers: [], // odstranit šablonu předplatného → dashboard použije reálná pole
  subtitle: 'TechCars Servis s.r.o. — autoservis',
  status: 'active',
  ledger: { bank_balance: bankBalance, months: ledgerMonths },
  receivables, cashflow_months, monthly_pnl, kpis,
  revenue: fmt(V[2025].trzby / 12), revenue_trend: '+11 % r/r', revenue_trend_up: true,
  ebitda: fmt(V[2025].provozni_vh + V[2025].odpisy), ebitda_period: 'EBITDA 2025 (ročně)', ebitda_trend: 'Téměř na nule', ebitda_trend_up: false,
  summary: `Autoservis se strukturální provozní ztrátou (2024 −277k, 2025 −269k). Variabilní náklady (materiál/díly) ≈ 61 % tržeb, fixní báze ≈ 3,3 M. Forecast 2026 (+4 % tržeb) EBIT ≈ −290k. Bod zvratu: tržby 8,14 M (+14 %), nebo materiálový podíl 61→43 %, nebo fixní −289k.`,
  risks: [
    { level: 'critical', title: 'Strukturální ztráta', desc: 'Marže po materiálu (~39 %) nepokryje fixní náklady. Bez zásahu i 2026 ve ztrátě (~−290k).' },
    { level: 'critical', title: 'Vysoký materiálový podíl 61 %', desc: 'Hlavní páka: vyjednat lepší nákup dílů (POP-ART, Inter Cars) nebo zvednout ceny práce. Cíl ≤ 43 % na bod zvratu.' },
    { level: 'medium', title: 'Růst osobních nákladů +29 %', desc: '2024→2025 mzdy 1,50→1,94 M. Hlídat produktivitu (tržby na zaměstnance).' },
    { level: 'medium', title: 'Sezónní propad léto', desc: 'Červen–srpen pod break-even. Plánovat cash rezervu / akce mimo sezónu.' },
    { level: 'low', title: 'Rostoucí úroky 10→59k', desc: 'Financování zdražuje. Zkontrolovat úvěry/leasing.' },
  ],
}

writeFileSync(new URL('../data/techcars/report-patch.json', import.meta.url), JSON.stringify(patch, null, 2))
console.log('Patch sestaven. Ledger měsíců:', ledgerMonths.length, '| položek:', _id, '| pohledávky:', receivables.invoices_issued.length, '| závazky:', receivables.invoices_received.length)
console.log('Bank balance (denik 2025 konec):', bankBalance.toLocaleString('cs-CZ'), 'Kč')
console.log('Kontrola EBITDA z ledgeru (suma ebitda):')
for (const y of [2024, 2025, 2026]) {
  const sum = cashflow_months.filter((c) => c.label.startsWith(String(y))).reduce((s, c) => s + c.ebitda, 0)
  console.log(`  ${y}: ${Math.round(sum).toLocaleString('cs-CZ')} Kč`)
}

if (!WRITE) { console.log('\n(DRY) Spusť s --write pro zápis do reportu.'); process.exit(0) }

const { data: cur, error: e1 } = await supa.from('reports').select('data').eq('id', REPORT_ID).single()
if (e1) { console.error('Načtení selhalo:', e1.message); process.exit(1) }
const merged = { ...cur.data, ...patch }
const { error: e2 } = await supa.from('reports').update({ data: merged }).eq('id', REPORT_ID)
if (e2) { console.error('Zápis selhal:', e2.message); process.exit(1) }
console.log('\n✅ Zapsáno do reportu', REPORT_ID)
