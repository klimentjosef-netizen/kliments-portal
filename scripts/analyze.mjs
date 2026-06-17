// CFO analýza TechCars: pravidelné vs nepravidelné příjmy/výdaje + sezónnost, per rok.
// Zdroje: knihy vydaných/přijatých faktur (akruál, partner+datum+částka).
import { readFileSync, writeFileSync } from 'node:fs'
import pkg from 'xlsx'
const XLSX = pkg.default || pkg
const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'

function sheet(f) {
  const wb = XLSX.read(readFileSync(f), { type: 'buffer', cellDates: true })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
}
const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.')) || 0)
function ym(d) { const dt = d instanceof Date ? d : new Date(d); return isNaN(dt) ? null : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` }
function colKey(row, re) { return Object.keys(row).find((k) => re.test(k)) }
function stats(arr) {
  const n = arr.length, mean = arr.reduce((s, x) => s + x, 0) / n
  const sd = Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / n)
  return { mean, sd, cv: mean ? sd / mean : 0, min: Math.min(...arr), max: Math.max(...arr) }
}

function analyzeBook(file, year, { partnerRe, dateRe, amtRe }) {
  const rows = sheet(file)
  const s = rows[0] || {}
  const pK = colKey(s, partnerRe), dK = colKey(s, dateRe), aK = colKey(s, amtRe)
  const dCol = colKey(s, /^D\.?$/) // typ dokladu (PS = počáteční stav)
  const monthly = {} // 'YYYY-MM' -> sum
  const partners = {} // name -> { months:Set, total, byMonth:{} }
  for (const r of rows) {
    if (dCol && String(r[dCol]).trim().toUpperCase() === 'PS') continue
    const m = ym(r[dK]); if (!m || !m.startsWith(String(year))) continue
    const amt = num(r[aK]); if (!amt) continue
    monthly[m] = (monthly[m] || 0) + amt
    const p = String(r[pK] || '—').trim() || '—'
    partners[p] ??= { months: new Set(), total: 0, byMonth: {} }
    partners[p].months.add(m); partners[p].total += amt
    partners[p].byMonth[m] = (partners[p].byMonth[m] || 0) + amt
  }
  const months12 = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const series = months12.map((m) => monthly[m] || 0)
  const total = series.reduce((a, b) => a + b, 0)
  const st = stats(series)
  // klasifikace partnerů: pravidelný = přítomen >=8/12 měsíců
  const classed = Object.entries(partners).map(([name, p]) => {
    const mc = p.months.size
    const mv = months12.map((m) => p.byMonth[m] || 0).filter((x) => x > 0)
    const pst = stats(mv.length ? mv : [0])
    return { name, monthsPresent: mc, total: Math.round(p.total), avgPerActiveMonth: Math.round(pst.mean), cv: +pst.cv.toFixed(2), regular: mc >= 8 }
  }).sort((a, b) => b.total - a.total)
  const regularTotal = classed.filter((c) => c.regular).reduce((s, c) => s + c.total, 0)
  return {
    year, total: Math.round(total),
    monthly: months12.map((m, i) => ({ month: m, amount: Math.round(series[i]) })),
    seasonality: months12.map((m, i) => ({ month: m, index: total ? +(series[i] / (total / 12)).toFixed(2) : 0 })),
    monthly_stats: { mean: Math.round(st.mean), sd: Math.round(st.sd), cv: +st.cv.toFixed(2), min: Math.round(st.min), max: Math.round(st.max) },
    regular_share: total ? +(regularTotal / total).toFixed(2) : 0,
    regular_partners: classed.filter((c) => c.regular).slice(0, 15),
    top_irregular: classed.filter((c) => !c.regular).slice(0, 10),
    partner_count: classed.length,
  }
}

// Knihy faktur jsou kumulativní (jen ve složce 2025), filtrujeme podle roku.
const VYD = `${BASE}/2025/prehled vydanych faktur.xlsx`
const PRIJ = `${BASE}/2025/prehled prijatych faktur.xlsx`
const out = { income: {}, expense: {} }
for (const year of [2024, 2025]) {
  out.income[year] = analyzeBook(VYD, year,
    { partnerRe: /Odběratel|Partner|Název/i, dateRe: /Datum usk/i, amtRe: /Fakturov/i })
  out.expense[year] = analyzeBook(PRIJ, year,
    { partnerRe: /Dodavatel|Odběratel|Partner|Název/i, dateRe: /Datum usk|Datum/i, amtRe: /Fakturov|Částka|Celkem/i })
}
writeFileSync('C:/Users/klime/projects/kliments-portal/data/techcars/techcars-analysis.json', JSON.stringify(out, null, 2))

// ── Konzolní souhrn ──
for (const kind of ['income', 'expense']) {
  console.log(`\n###################  ${kind === 'income' ? 'PŘÍJMY (vydané faktury)' : 'VÝDAJE (přijaté faktury)'}  ###################`)
  for (const year of [2024, 2025]) {
    const a = out[kind][year]
    console.log(`\n── ${year} ──  součet ${a.total.toLocaleString('cs-CZ')} Kč | ø měsíc ${a.monthly_stats.mean.toLocaleString('cs-CZ')} (CV ${a.monthly_stats.cv}) | min ${a.monthly_stats.min.toLocaleString('cs-CZ')} / max ${a.monthly_stats.max.toLocaleString('cs-CZ')}`)
    console.log(`   pravidelná složka: ${(a.regular_share * 100).toFixed(0)} %  | partnerů: ${a.partner_count} (pravidelných ${a.regular_partners.length})`)
    console.log('   měsíčně: ' + a.monthly.map((m) => Math.round(m.amount / 1000) + 'k').join(' '))
    console.log('   sezónní index: ' + a.seasonality.map((s) => s.index.toFixed(1)).join(' '))
    if (a.regular_partners.length) console.log('   pravidelní (top): ' + a.regular_partners.slice(0, 5).map((p) => `${p.name.slice(0, 18)}(${p.monthsPresent}m,${Math.round(p.total / 1000)}k)`).join(', '))
  }
}
console.log('\nArtefakt: data/techcars/techcars-analysis.json')
