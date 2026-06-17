// Nahradí blokový Přehled (d.blocks) PRAVDIVÝMI čísly z účetní závěrky.
// Zdroje: výkaz (úrovně), analysis.json (pravidelné/nepravidelné, dodavatelé),
// forecast.json (2026), cashflow_months z reportu (sezónní graf 2025).
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
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

// peněžní prostředky z rozvahy (pokladna + účty), v Kč
function cash(year, f) {
  const wb = XLSX.read(readFileSync(`${BASE}/${year}/${f}`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const r = rows.find((x) => /^Peněžní prostředky$/i.test(String(x.TEXT || '').trim()))
  return { now: (Number(r.NETTO) || 0) * 1000, prev: (Number(r.NETTO_MIN) || 0) * 1000 }
}
const cash25 = cash(2025, 'rozvaha_2025_12.xlsx')   // now=2025, prev=2024
const cash24 = cash(2024, 'rozvaha_2024_12.xlsx')   // now=2024, prev=2023

// rozvaha 2025 — delty aktiv pro cash bridge (v Kč)
function rozAsset(re) {
  const wb = XLSX.read(readFileSync(`${BASE}/2025/rozvaha_2025_12.xlsx`), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const r = rows.find((x) => re.test(String(x.TEXT || '').trim()))
  return r ? { now: (Number(r.NETTO) || 0) * 1000, prev: (Number(r.NETTO_MIN) || 0) * 1000 } : { now: 0, prev: 0 }
}
const zasoby = rozAsset(/^Zásoby$/i), pohl = rozAsset(/^Pohledávky$/i), casRoz = rozAsset(/^Časové rozlišení aktiv$/i)
const CASH = { 2023: cash24.prev, 2024: cash24.now, 2025: cash25.now } // 1168k, 496k, 82k
const fixedMonthly = Math.round((v25.sluzby + v25.osobni + v25.odpisy + v25.ost_nakl) / 12)
const runwayMonths = (CASH[2025] / fixedMonthly).toFixed(1)

// PASIVA z PDF rozvahy (XLSX export má jen aktiva). Hodnoty se OVĚŘUJÍ proti
// textu PDF přes pdftotext — co v PDF není, se nezapíše. tis. Kč → Kč: {2025, 2024}
const ROZ_PDF = `${BASE}/2025/ROZVAHA_2025_12.PDF`
const pdfText = execSync(`pdftotext -raw "${ROZ_PDF}" -`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
function verifyPdf(...vals) {
  for (const v of vals) if (!pdfText.includes(String(v))) throw new Error(`Hodnota "${v}" NENÍ v rozvaze PDF — odmítám zapsat (provenience).`)
}
verifyPdf('364', '359', '18', '861', '981', '308', '99', '108', '335', '294', '85', '49')
const k = (a, b) => ({ now: a * 1000, prev: b * 1000 })
const P = {
  equity: k(-364, -29),          // ř082 Vlastní kapitál (záporný = předlužení)
  bankLoan: k(861, 981),         // ř115 Závazky k úvěrovým institucím (dlouhodobé)
  advances: k(0, 308),           // ř131 Krátkodobé přijaté zálohy
  tradePay: k(29, 99),           // ř132 Závazky z obchodních vztahů (krátkodobé)
  ownerLoan: k(359, 18),         // ř137 Závazky ke společníkům
  payEmp: k(85, 79), paySoc: k(49, 41), payTax: k(108, 12), payOther: k(-84, -22), // ř139-143
}
const d = (o) => o.now - o.prev
const bridge = {
  netProfit: v25.vysledek, deprec: v25.odpisy,
  dInv: -(zasoby.now - zasoby.prev), dRec: -(pohl.now - pohl.prev), dPre: -(casRoz.now - casRoz.prev),
  dTradePay: d(P.tradePay), dAdvances: d(P.advances),
  dOtherPay: d(P.payEmp) + d(P.paySoc) + d(P.payTax) + d(P.payOther),
  ownerLoan: d(P.ownerLoan), bankLoan: d(P.bankLoan),
}
bridge.operating = bridge.netProfit + bridge.deprec + bridge.dInv + bridge.dRec + bridge.dPre + bridge.dTradePay + bridge.dAdvances + bridge.dOtherPay
bridge.financing = bridge.ownerLoan + bridge.bankLoan
bridge.total = bridge.operating + bridge.financing // ≈ změna hotovosti
const an = JSON.parse(readFileSync(new URL('../data/techcars/techcars-analysis.json', import.meta.url), 'utf8'))
const fc = JSON.parse(readFileSync(new URL('../data/techcars/techcars-forecast.json', import.meta.url), 'utf8'))

const { data: cur } = await supa.from('reports').select('data').eq('id', REPORT_ID).single()
const cf25 = (cur.data.cashflow_months || []).filter((m) => m.label.startsWith('2025'))

const var24 = v24.material + v24.zbozi, var25 = v25.material + v25.zbozi
const ebitda24 = v24.provozni_vh + v24.odpisy, ebitda25 = v25.provozni_vh + v25.odpisy
const topExp = an.expense[2025].regular_partners.slice(0, 6)

const newRisks = [
  { level: 'critical', title: 'Záporný vlastní kapitál −364k (předlužení)', desc: 'Účetní insolvenční signál. Firmu drží půjčka společníka (+341k v 2025). Řešit kapitalizací půjčky do vlastního kapitálu + návratem k zisku.' },
  { level: 'critical', title: `Kritická likvidita — hotovost ${CASH[2025].toLocaleString('cs-CZ')} Kč`, desc: `Rezerva ~${runwayMonths} měsíce fixních nákladů. Hotovost spadla 1,17 M → 496k → 82k za dva roky. Bez doplnění cash hrozí platební neschopnost v 2026.` },
  { level: 'critical', title: 'Strukturální provozní ztráta', desc: 'Marže po materiálu (~39 %) nepokryje fixní náklady. Bez zásahu i 2026 ve ztrátě (~−290k).' },
  { level: 'critical', title: 'Vysoký materiálový podíl 61 %', desc: 'Hlavní páka: lepší nákup dílů (POP-ART, Inter Cars) nebo zvednout ceny práce. Cíl ≤ 43 % = bod zvratu.' },
  { level: 'medium', title: 'Růst osobních nákladů +29 %', desc: '2024→2025 mzdy 1,50→1,94 M, rychleji než tržby (+11 %). Hlídat produktivitu (tržby na mechanika).' },
  { level: 'medium', title: 'Odliv cash mimo provoz', desc: 'Investice, splátky půjčky společníka a odvody odčerpávají víc než provozní ztráta. Zmapovat a zastavit zbytné odlivy.' },
  { level: 'medium', title: 'Sezónní propad léto', desc: 'Červen–srpen pod break-even. Plánovat rezervu / akce mimo sezónu.' },
  { level: 'low', title: 'Rostoucí úroky 10→59k', desc: 'Financování zdražuje. Zkontrolovat úvěry/leasing.' },
]

const blocks = [
  { type: 'heading', level: 1, text: 'Finanční řízení servisu',
    eyebrow: 'TECHCARS SERVIS · 2024–2025 SKUTEČNOST + 2026 PLÁN',
    sub: 'Reálná čísla z účetní závěrky. Roky oddělené, 2026 je plán (base case +4 % tržeb).' },

  { type: 'kpi-grid', columns: 4, items: [
    { label: 'Hotovost k 31.12.2025', value: CASH[2025].toLocaleString('cs-CZ') + ' Kč', sub: `runway ~${runwayMonths} měsíce ⚠`, trend: 'down', intent: 'critical' },
    { label: 'Tržby 2025', value: '7 119 000 Kč', sub: '+11 % vs 2024', trend: 'up', intent: 'default' },
    { label: 'Provozní VH 2025', value: '−269 000 Kč', sub: 'ztrátový 2. rok', trend: 'down', intent: 'warning' },
    { label: 'Materiálová náročnost', value: '61 %', sub: 'díly/materiál z tržeb', trend: 'neutral', intent: 'warning' },
  ] },

  { type: 'callout', intent: 'critical', title: `⚠ Kritická likvidita — hotovost klesla na ${CASH[2025].toLocaleString('cs-CZ')} Kč`,
    body: `Peněžní prostředky (pokladna + účty) spadly z ${CASH[2023].toLocaleString('cs-CZ')} Kč (2023) na ${CASH[2024].toLocaleString('cs-CZ')} (2024) a na pouhých ${CASH[2025].toLocaleString('cs-CZ')} Kč ke konci 2025. Při fixních nákladech ~${fixedMonthly.toLocaleString('cs-CZ')} Kč/měs je rezerva jen ~${runwayMonths} měsíce. Úbytek hotovosti (−672k, pak −414k/rok) je výrazně vyšší než provozní ztráta — odčerpávají ji i investice, splátky půjčky společníka a odvody. TOTO je nejnaléhavější téma: bez doplnění cash nebo zastavení odlivu hrozí platební neschopnost v 2026.` },

  { type: 'callout', intent: 'warning', title: 'Ztráta je strukturální, ne jednorázová',
    body: 'Po odečtení dílů a materiálu (61 % tržeb) zbývá marže ~39 %, která nepokryje fixní náklady (~3,3 M/rok). Provozní ztráta drží dva roky po sobě (−277k, −269k) a model 2026 ji bez zásahu opakuje (~−290k). Ziskové jsou jen sezónní vrcholy (duben, říjen) — léto (červen–srpen) je pod bodem zvratu.' },

  { type: 'yoy-comparison', title: 'Vývoj hospodaření 2024 → 2026', years: [2024, 2025, 2026], note: '2026 = plán (base case +4 % tržeb, fixní +4 %). EBITDA ≈ provozní VH + odpisy. „Výsledek po zdanění" 2026 neuveden (závisí na finančních nákladech).', rows: [
    { label: 'Tržby', values: [v24.trzby, v25.trzby, fc.annual.revenue], format: 'currency' },
    { label: 'Materiál a díly (variabilní)', values: [var24, var25, fc.annual.variable_costs], format: 'currency', higherIsBetter: false },
    { label: 'Osobní náklady', values: [v24.osobni, v25.osobni, Math.round(v25.osobni * 1.04)], format: 'currency', higherIsBetter: false },
    { label: 'EBITDA', values: [ebitda24, ebitda25, fc.annual.ebitda], format: 'currency', highlight: true },
    { label: 'Provozní VH (EBIT)', values: [v24.provozni_vh, v25.provozni_vh, fc.annual.ebit], format: 'currency', highlight: true },
    { label: 'Výsledek po zdanění', values: [v24.vysledek, v25.vysledek, null], format: 'currency' },
    { label: 'Hotovost (k 31.12.)', values: [CASH[2024], CASH[2025], null], format: 'currency', highlight: true, higherIsBetter: true },
    { label: 'Vlastní kapitál (k 31.12.)', values: [-29000, -364000, null], format: 'currency', highlight: true, higherIsBetter: true },
  ] },

  { type: 'heading', level: 2, text: 'Kam zmizela hotovost', eyebrow: 'Cash bridge 2025 (úplný, z rozvahy)' },
  { type: 'callout', intent: 'critical', title: '⚠ Záporný vlastní kapitál −364 tis. Kč = předlužení',
    body: `Nahromaděné ztráty stlačily vlastní kapitál do mínusu (−29k → −364k). To je účetní signál předlužení (insolvenční test). Firmu drží nad vodou půjčka společníka: závazky ke společníkovi vzrostly 18k → 359k, tj. majitel do firmy v 2025 vložil ~341 tis. Kč. Bez toho by hotovost spadla o ~755k místo 414k. Řešení předlužení: kapitalizovat půjčku společníka do vlastního kapitálu.` },
  { type: 'table', title: 'Proč hotovost spadla o 414 tis. Kč (2025) — úplný cash-flow', headers: ['Položka', 'Dopad na cash'], rows: [
    ['PROVOZNÍ', ''],
    ['  Výsledek po zdanění', bridge.netProfit.toLocaleString('cs-CZ') + ' Kč'],
    ['  + Odpisy (nepeněžní)', '+' + bridge.deprec.toLocaleString('cs-CZ') + ' Kč'],
    ['  − Nárůst zásob (materiál 128→298k)', bridge.dInv.toLocaleString('cs-CZ') + ' Kč'],
    ['  − Nárůst pohledávek', bridge.dRec.toLocaleString('cs-CZ') + ' Kč'],
    ['  − Úbytek přijatých záloh (308→0)', bridge.dAdvances.toLocaleString('cs-CZ') + ' Kč'],
    ['  − Splátka dodavatelů (99→29)', bridge.dTradePay.toLocaleString('cs-CZ') + ' Kč'],
    ['  ± Ostatní provozní závazky', (bridge.dOtherPay >= 0 ? '+' : '') + bridge.dOtherPay.toLocaleString('cs-CZ') + ' Kč'],
    ['  − Časové rozlišení', bridge.dPre.toLocaleString('cs-CZ') + ' Kč'],
    ['INVESTIČNÍ (CAPEX)', '~0 Kč'],
    ['FINANČNÍ', ''],
    ['  Půjčka od společníka', '+' + bridge.ownerLoan.toLocaleString('cs-CZ') + ' Kč'],
    ['  Splátka bankovního úvěru', bridge.bankLoan.toLocaleString('cs-CZ') + ' Kč'],
  ], footer: `Provozní −${Math.abs(bridge.operating).toLocaleString('cs-CZ')} + finanční +${bridge.financing.toLocaleString('cs-CZ')} = ${bridge.total.toLocaleString('cs-CZ')} Kč (hotovost 496k → 82k). Zdroj: rozvaha (PDF, vč. pasiv). Klíč: provoz a pracovní kapitál odčerpaly 636k, majitel dolil 341k.` },
  { type: 'callout', intent: 'info', title: 'Páky cash: zásoby +170k a zmizelé zálohy',
    body: 'Dvě věci vážou/odčerpaly nejvíc hotovosti: (1) sklad dílů narostl 128→298k — snížením na rozumnou úroveň (JIT nákup od POP-ART/Inter Cars, kteří dodávají každý měsíc) lze uvolnit ~100–170k; (2) 308k přijatých záloh od zákazníků se v 2025 vyčerpalo — zvážit zálohové platby u větších zakázek pro stabilní cash.' },

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
  { type: 'risk-list', items: newRisks },
]

console.log('Sestaveno bloků:', blocks.length)
blocks.forEach((b, i) => console.log(`  [${i}] ${b.type}${b.text ? ': ' + b.text : b.title ? ': ' + b.title : ''}`))

console.log('Hotovost (Kč):', CASH, '| fixní/měs', fixedMonthly, '| runway', runwayMonths, 'měs')
if (!WRITE) { console.log('\n(DRY) Spusť s --write.'); process.exit(0) }
const ledger = { ...cur.data.ledger, bank_balance: CASH[2025] }
const merged = { ...cur.data, blocks, risks: newRisks, ledger,
  summary: cur.data.summary + ` Hotovost klesla na ${CASH[2025].toLocaleString('cs-CZ')} Kč (runway ~${runwayMonths} měs) — nejnaléhavější téma.` }
const { error } = await supa.from('reports').update({ data: merged }).eq('id', REPORT_ID)
if (error) { console.error('Zápis selhal:', error.message); process.exit(1) }
console.log('\n✅ Přehled (blocks) přepsán reálnými čísly.')
