// Forecast 2026 z oficiálních úrovní (výkaz) + sezónnosti (knihy faktur).
// Model: náklady = variabilní (materiál/zboží, škáluje s tržbami) + fixní (služby,
// osobní, odpisy, ostatní; roste s inflací). Tržby = 2025 × (1+growth) × sezónnost.
import { readFileSync, writeFileSync } from 'node:fs'
import pkg from 'xlsx'
const XLSX = pkg.default || pkg
const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'

const GROWTH = Number(process.argv[2] ?? 0.04)   // růst tržeb 2026 (default +4 %)
const INFLATION = Number(process.argv[3] ?? 0.04) // růst fixních nákladů

function vykaz(year, f) {
  const wb = XLSX.read(readFileSync(`${BASE}/${year}/${f}`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const g = (re) => { const r = rows.find((x) => re.test(String(x.TEXT || ''))); return r ? Number(r.NETTO) * 1000 : 0 }
  return {
    trzby: g(/Tržby z prodeje výrobk/i),
    zbozi_naklad: g(/Náklady vynaložené na prodané zboží/i),
    material: g(/Spotřeba materiálu a energie/i),
    sluzby: g(/^Služby|3\.\s*Služby|Služby/i),
    osobni: g(/Osobní náklady/i),
    odpisy: g(/Úpravy hodnot v provozní/i),
    ost_vynosy: g(/Ostatní provozní výnosy/i),
    ost_naklady: g(/Ostatní provozní náklady/i),
    provozni_vh: g(/Provozní výsledek hospodař/i),
  }
}
const y25 = vykaz(2025, 'vykaz_2025_01-2025_12.xlsx')

// sezónnost = průměr indexů 2024+2025 z analýzy příjmů
const an = JSON.parse(readFileSync('C:/Users/klime/projects/kliments-portal/data/techcars/techcars-analysis.json', 'utf8'))
const seasonAvg = Array.from({ length: 12 }, (_, i) => {
  const a = an.income[2024].seasonality[i].index, b = an.income[2025].seasonality[i].index
  return (a + b) / 2
})
const sNorm = seasonAvg.map((s) => (s * 12) / seasonAvg.reduce((x, y) => x + y, 0)) // suma=12

// 2026 roční
const rev26 = Math.round(y25.trzby * (1 + GROWTH))
const variable25 = y25.material + y25.zbozi_naklad           // škáluje s tržbami
const varRatio = variable25 / y25.trzby                      // variabilní podíl na tržbách
const fixed25 = y25.sluzby + y25.osobni + y25.odpisy + y25.ost_naklady
const fixed26 = Math.round(fixed25 * (1 + INFLATION))
const variable26 = Math.round(rev26 * varRatio)
const ostVyn26 = Math.round(y25.ost_vynosy)                  // konzervativně jako 2025
const ebit26 = rev26 + ostVyn26 - variable26 - fixed26

// měsíční rozpad
const months = Array.from({ length: 12 }, (_, i) => {
  const label = `2026-${String(i + 1).padStart(2, '0')}`
  const revenue = Math.round((rev26 / 12) * sNorm[i])
  const variable = Math.round((variable26 / 12) * sNorm[i]) // var škáluje se sezónností tržeb
  const fixed = Math.round(fixed26 / 12)                    // fixní rovnoměrně
  const otherInc = Math.round(ostVyn26 / 12)
  const costs = variable + fixed
  const ebitda = revenue + otherInc - costs + Math.round(y25.odpisy / 12) // EBITDA = EBIT + odpisy
  const ebit = revenue + otherInc - costs
  return { label, revenue, variable, fixed, costs, otherInc, ebit, ebitda }
})

const result = {
  assumptions: { growth: GROWTH, inflation: INFLATION, var_ratio: +varRatio.toFixed(3) },
  annual: {
    revenue: rev26, other_income: ostVyn26, variable_costs: variable26, fixed_costs: fixed26,
    ebit: ebit26, ebitda: ebit26 + y25.odpisy,
  },
  seasonality_norm: sNorm.map((x) => +x.toFixed(2)),
  months,
}
writeFileSync('C:/Users/klime/projects/kliments-portal/data/techcars/techcars-forecast.json', JSON.stringify(result, null, 2))

const f = (n) => Math.round(n).toLocaleString('cs-CZ')
console.log(`\n=== FORECAST 2026 (růst tržeb +${(GROWTH*100).toFixed(0)} %, inflace fixních +${(INFLATION*100).toFixed(0)} %) ===`)
console.log(`Variabilní podíl (materiál+zboží / tržby) 2025: ${(varRatio*100).toFixed(1)} %`)
console.log(`Tržby:            ${f(rev26)} Kč   (2025: ${f(y25.trzby)})`)
console.log(`+ ost. výnosy:    ${f(ostVyn26)} Kč`)
console.log(`Variabilní nákl.: ${f(variable26)} Kč`)
console.log(`Fixní náklady:    ${f(fixed26)} Kč   (2025: ${f(fixed25)})`)
console.log(`Provozní VH (EBIT): ${f(ebit26)} Kč   (2025: ${f(y25.provozni_vh)})`)
console.log(`EBITDA:           ${f(ebit26 + y25.odpisy)} Kč`)
console.log(`\nMěsíčně 2026 (tržby / náklady / EBIT):`)
for (const m of months) console.log(`  ${m.label}:  ${f(m.revenue).padStart(9)} / ${f(m.costs).padStart(9)} / ${f(m.ebit).padStart(8)}`)
console.log('\nArtefakt: data/techcars/techcars-forecast.json')
