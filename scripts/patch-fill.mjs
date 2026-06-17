// Dokonalé naplnění vedlejších CFO polí ze skutečnosti (hlavní kniha 2025).
// fixed_costs = reálné měsíční fixní náklady po kategoriích (z účtů 5xx, /12),
// uzemněné na výkaz. variable_cost_pct, extras, business_profile.
import { readFileSync } from 'node:fs'
import pkg from 'xlsx'
import { createClient } from '@supabase/supabase-js'
const XLSX = pkg.default || pkg
const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'
const REPORT_ID = 'cd2556ba-3480-42cb-934b-f98944fdd97b'
const WRITE = process.argv.includes('--write')

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// hlavní kniha 2025 → účet → roční náklad (OBRAT_MD)
const wb = XLSX.read(readFileSync(`${BASE}/2025/hk_obrat.xlsx`), { type: 'buffer' })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
const acc = {}
for (const r of rows) { const u = String(r.UCET || ''); if (/^5/.test(u)) acc[u] = (acc[u] || 0) + (Number(r.OBRAT_MD) || 0) }
const sum = (...prefixes) => Object.entries(acc).filter(([u]) => prefixes.some((p) => u.startsWith(p))).reduce((s, [, v]) => s + v, 0)

// VARIABILNÍ (materiál/služby na zakázky) — NEjde do fixed_costs, ale do variable_cost_pct
const variable = acc['501.500'] + acc['504.100'] + (acc['501.999'] || 0) + (acc['518.500'] || 0)
const revenue25 = 7119000
const varPct = Math.round((variable / revenue25) * 100)

// FIXNÍ kategorie (roční → měsíční)
const m = (v) => Math.round(v / 12)
const fixed_costs = [
  { name: 'Mzdy a odvody (mechanici + majitel)', amount: m(sum('521', '524', '527')) },
  { name: 'Nájem prostor a aut', amount: m((acc['518.203'] || 0) + (acc['518.202'] || 0) + (acc['518.103'] || 0) + (acc['518.300'] || 0)) },
  { name: 'Ostatní služby a režie', amount: m((acc['518.100'] || 0) + (acc['518.101'] || 0) + (acc['518.999'] || 0) + (acc['518.994'] || 0) + (acc['511.100'] || 0) + (acc['513.100'] || 0)) },
  { name: 'Reklama a inzerce', amount: m(acc['518.400'] || 0) },
  { name: 'Účetnictví a právní služby', amount: m(acc['518.102'] || 0) },
  { name: 'Materiálová režie (kancelář, OOPP, PHM, DrHM)', amount: m(sum('501.1', '501.2')) },
  { name: 'Pojištění a provozní daně', amount: m(sum('548', '538', '545')) },
  { name: 'Odpisy', amount: m(acc['551.100'] || 0) },
  { name: 'Úroky a bankovní poplatky', amount: m(sum('562', '563', '568')) },
].filter((c) => c.amount > 0)
const fixedMonthlyTotal = fixed_costs.reduce((s, c) => s + c.amount, 0)

const patch = {
  business_model: 'transaction', // autoservis = transakční (ne tarify/členové)
  variable_cost_pct: 61, // výkaz-based materiálová náročnost (konzistentní s Přehledem)
  fixed_costs,
  extras: [], // odstranit šablonové odhady
  budget: { total: 0, capex_budget: 0, reserve_budget: 0, capex_items: [], reserve_drawn: 0 },
  business_profile: {
    vat_payer: true, complexity: 'standard', entity_type: 'sro', founding_date: '', fiscal_year_start: '01',
    vat_transition_date: '', industry: 'Autoservis', employees: '3–4', annual_revenue: '7,1 mil. Kč (2025)',
  },
  // výchozí báze pro what-if simulátor (skutečnost 2025, reconciliováno na výkaz) — klient si může upravit
  whatif_base: {
    annual_revenue: 7119000, material_pct: 60.9, other_income: 245000,
    fixed_annual: 3297500, depreciation_annual: 255000, labor_share_pct: 40,
  },
}

console.log('Variabilní (materiál/zakázky):', Math.round(variable).toLocaleString('cs-CZ'), `→ ${varPct}% tržeb (zapisuji 61% dle výkazu)`)
console.log('Fixní náklady / měsíc:', fixedMonthlyTotal.toLocaleString('cs-CZ'), '(ročně', (fixedMonthlyTotal * 12).toLocaleString('cs-CZ'), ')')
for (const c of fixed_costs) console.log('  -', c.name.padEnd(46), c.amount.toLocaleString('cs-CZ'))

if (!WRITE) { console.log('\n(DRY) Spusť s --write.'); process.exit(0) }
const { data: cur } = await supa.from('reports').select('data').eq('id', REPORT_ID).single()
const merged = { ...cur.data, ...patch }
const { error } = await supa.from('reports').update({ data: merged }).eq('id', REPORT_ID)
if (error) { console.error('Zápis selhal:', error.message); process.exit(1) }
console.log('\n✅ Vedlejší pole naplněna skutečností.')
