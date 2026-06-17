// Nahradí blokový Přehled (d.blocks) PRAVDIVÝMI čísly z účetní závěrky.
// Zdroje: výkaz (úrovně), analysis.json (pravidelné/nepravidelné, dodavatelé),
// forecast.json (2026), cashflow_months z reportu (sezónní graf 2025).
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

function vykaz(year, f) {
  const wb = XLSX.read(readFileSync(`${BASE}/${year}/${f}`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const g = (re) => { const r = rows.find((x) => re.test(String(x.TEXT || ''))); return r ? Number(r.NETTO) * 1000 : 0 }
  return { trzby: g(/Tržby z prodeje výrobk/i), zbozi: g(/Náklady vynaložené na prodané zboží/i),
    material: g(/Spotřeba materiálu a energie/i), sluzby: g(/3\.\s*Služby|Služby/i), osobni: g(/Osobní náklady/i),
    odpisy: g(/Úpravy hodnot v provozní/i), ost_vyn: g(/Ostatní provozní výnosy/i), ost_nakl: g(/Ostatní provozní náklady/i),
    provozni_vh: g(/Provozní výsledek hospodař/i), vysledek: g(/Výsledek hospodaření za účetní obd/i) }
}
const v24 = vykaz(2024, 'výkaz_2024_01-2024_12.xlsx'), v25 = vykaz(2025, 'vykaz_2025_01-2025_12.xlsx')
const an = JSON.parse(readFileSync(new URL('../data/techcars/techcars-analysis.json', import.meta.url), 'utf8'))
const fc = JSON.parse(readFileSync(new URL('../data/techcars/techcars-forecast.json', import.meta.url), 'utf8'))

const { data: cur } = await supa.from('reports').select('data').eq('id', REPORT_ID).single()
const cf25 = (cur.data.cashflow_months || []).filter((m) => m.label.startsWith('2025'))

const var24 = v24.material + v24.zbozi, var25 = v25.material + v25.zbozi
const ebitda24 = v24.provozni_vh + v24.odpisy, ebitda25 = v25.provozni_vh + v25.odpisy
const topExp = an.expense[2025].regular_partners.slice(0, 6)

const blocks = [
  { type: 'heading', level: 1, text: 'Finanční řízení servisu',
    eyebrow: 'TECHCARS SERVIS · 2024–2025 SKUTEČNOST + 2026 PLÁN',
    sub: 'Reálná čísla z účetní závěrky. Roky oddělené, 2026 je plán (base case +4 % tržeb).' },

  { type: 'kpi-grid', columns: 4, items: [
    { label: 'Tržby 2025', value: '7 119 000 Kč', sub: '+11 % vs 2024', trend: 'up', intent: 'default' },
    { label: 'Provozní VH 2025', value: '−269 000 Kč', sub: 'ztrátový 2. rok', trend: 'down', intent: 'critical' },
    { label: 'Materiálová náročnost', value: '61 %', sub: 'díly/materiál z tržeb', trend: 'neutral', intent: 'warning' },
    { label: 'Forecast EBIT 2026', value: '−290 000 Kč', sub: 'při +4 % tržeb', trend: 'down', intent: 'warning' },
  ] },

  { type: 'callout', intent: 'critical', title: 'Ztráta je strukturální, ne jednorázová',
    body: 'Po odečtení dílů a materiálu (61 % tržeb) zbývá marže ~39 %, která nepokryje fixní náklady (~3,3 M/rok). Provozní ztráta drží dva roky po sobě (−277k, −269k) a model 2026 ji bez zásahu opakuje (~−290k). Ziskové jsou jen sezónní vrcholy (duben, říjen) — léto (červen–srpen) je pod bodem zvratu.' },

  { type: 'yoy-comparison', title: 'Vývoj hospodaření 2024 → 2026', years: [2024, 2025, 2026], note: '2026 = plán (base case +4 % tržeb, fixní +4 %). EBITDA ≈ provozní VH + odpisy. „Výsledek po zdanění" 2026 neuveden (závisí na finančních nákladech).', rows: [
    { label: 'Tržby', values: [v24.trzby, v25.trzby, fc.annual.revenue], format: 'currency' },
    { label: 'Materiál a díly (variabilní)', values: [var24, var25, fc.annual.variable_costs], format: 'currency', higherIsBetter: false },
    { label: 'Osobní náklady', values: [v24.osobni, v25.osobni, Math.round(v25.osobni * 1.04)], format: 'currency', higherIsBetter: false },
    { label: 'EBITDA', values: [ebitda24, ebitda25, fc.annual.ebitda], format: 'currency', highlight: true },
    { label: 'Provozní VH (EBIT)', values: [v24.provozni_vh, v25.provozni_vh, fc.annual.ebit], format: 'currency', highlight: true },
    { label: 'Výsledek po zdanění', values: [v24.vysledek, v25.vysledek, null], format: 'currency' },
  ] },

  { type: 'heading', level: 2, text: 'Z čeho vyděláváme — pravidelné vs nepravidelné', eyebrow: 'Skladba příjmů (z knihy faktur)' },
  { type: 'table', title: 'Charakter příjmů 2025', headers: ['Segment', 'Charakter', 'Podíl', 'Poznámka'], rows: [
    ['Drobné zakázky (retail)', 'Nepravidelné po zákazníkovi, stabilní v součtu', '~94 %', '500+ zákazníků/rok, kolísání ±22 %'],
    ['B2B / flotila (STING aj.)', 'Pravidelné', '~6 %', 'STING Service 11 měsíců/rok, „Přímý prodej" každý měsíc'],
  ], footer: 'Pravidelná (smluvní) složka jen 4–6 % → příjmy řídí sezónnost, ne dlouhodobé smlouvy. Příležitost: získat víc flotilových klientů (stabilní opakovaný příjem).' },

  { type: 'cashflow-chart', title: 'Měsíční tržby vs náklady 2025 (sezónnost)',
    months: cf25.map((m) => m.label.slice(5)), revenue: cf25.map((m) => m.revenue), costs: cf25.map((m) => m.costs) },

  { type: 'heading', level: 2, text: 'Co stojí provoz', eyebrow: 'Nákladová struktura 2025' },
  { type: 'kpi-grid', columns: 3, items: [
    { label: 'Variabilní (materiál/díly)', value: '61 % tržeb', sub: 'POP-ART, Inter Cars', intent: 'warning' },
    { label: 'Fixní náklady', value: '~275 000 Kč/měs', sub: 'mzdy, služby, režie, odpisy' },
    { label: 'Osobní náklady', value: '1 941 000 Kč', sub: '+29 % vs 2024 ⚠', intent: 'warning' },
  ] },
  { type: 'table', title: 'Největší pravidelní dodavatelé 2025', headers: ['Dodavatel', 'Měsíců/rok', 'Objem (Kč, vč. DPH)'],
    rows: topExp.map((p) => [p.name.slice(0, 28), String(p.monthsPresent), p.total.toLocaleString('cs-CZ')]),
    footer: 'Hrubé částky z knihy přijatých faktur (vč. DPH). POP-ART a Inter Cars = nákup dílů (variabilní); FÚ/OSSZ = daně a odvody; Výplata = mzdy.' },

  { type: 'heading', level: 2, text: 'Silné a slabé stránky', eyebrow: 'Stav firmy' },
  { type: 'strengths-weaknesses',
    strengths: [
      'Stabilní poptávka — 500+ zákazníků ročně, nízké kolísání (CV 0,22)',
      'Vysoce předvídatelné náklady — 77–84 % pravidelných, 15 stálých dodavatelů',
      'Rostoucí tržby (+11 % v 2025)',
      'Žádná závislost na jednom velkém zákazníkovi',
    ],
    weaknesses: [
      'Strukturální ztráta — provozní VH záporný dva roky po sobě',
      'Materiálová náročnost 61 % → nízká marže po dílech (~39 %)',
      'Osobní náklady rostou rychleji než tržby (+29 % vs +11 %)',
      'Rostoucí úroky (10→59k) — dražší financování',
      'Letní sezónní propad bez vyrovnávací rezervy',
    ] },

  { type: 'heading', level: 2, text: 'Co s tím — cesta k bodu zvratu', eyebrow: 'Akční plán' },
  { type: 'callout', intent: 'info', title: 'Bod zvratu (EBIT = 0): tři páky',
    body: 'Tržby 8,14 M (+14 % vs 2025) · NEBO snížit materiálový podíl z 61 % na 43 % · NEBO srazit fixní náklady o ~290k. Nejúčinnější je marže na dílech a cenotvorba práce.' },
  { type: 'step-list', layout: 'timeline', title: 'Priority', items: [
    { num: '01', title: 'Zvýšit marži na dílech a cenu práce', desc: 'Materiálový podíl 61 % je hlavní páka. Vyjednat nákup (POP-ART, Inter Cars), revidovat hodinovou sazbu. Cíl ≤ 43 % = bod zvratu i bez růstu tržeb.' },
    { num: '02', title: 'Růst tržeb na 8,1 M přes B2B', desc: 'Flotilové/firemní smlouvy dnes jen ~6 % příjmů. Stabilní opakovaný příjem + lepší vytížení mimo sezónu.' },
    { num: '03', title: 'Zastropovat osobní náklady', desc: 'Mzdy +29 % předběhly tržby +11 %. Sledovat tržby na mechanika (produktivita).' },
    { num: '04', title: 'Letní cash rezerva', desc: 'Červen–srpen pod break-even. Držet rezervu ≥ 1 měsíční fixní náklad (~275k).' },
    { num: '05', title: 'Měsíční uzávěrka v portálu', desc: 'Každý měsíc 2026 nahrát doklady → portál porovná plán vs skutečnost a ukáže odchylky.' },
  ] },

  { type: 'heading', level: 2, text: 'Co může zaboleť', eyebrow: 'Rizika' },
  { type: 'risk-list', items: (cur.data.risks || []).map((r) => ({ level: r.level, title: r.title, desc: r.desc })) },
]

console.log('Sestaveno bloků:', blocks.length)
blocks.forEach((b, i) => console.log(`  [${i}] ${b.type}${b.text ? ': ' + b.text : b.title ? ': ' + b.title : ''}`))

if (!WRITE) { console.log('\n(DRY) Spusť s --write.'); process.exit(0) }
const merged = { ...cur.data, blocks }
const { error } = await supa.from('reports').update({ data: merged }).eq('id', REPORT_ID)
if (error) { console.error('Zápis selhal:', error.message); process.exit(1) }
console.log('\n✅ Přehled (blocks) přepsán reálnými čísly.')
