// Salibandy s.r.o. — postaví e-shop CFO report z reálné banky (cash basis).
// Tržby (ex-VAT) + e-shop nákladové vrstvy → měsíční ledger + whatif_base + KPI + rizika.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')

const D = 'C:/Users/klime/Downloads/'
const REPORT_ID = '3d841ad0-d1b1-40f0-8c0d-27e818bed234'
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ---- CSV ----
function parseCSV(text) {
  const rows = []; let cur = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c }
    else { if (c === '"') q = true; else if (c === ';') { cur.push(field); field = '' } else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' } else if (c === '\r') {} else field += c }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}
const num = (s) => { const v = parseFloat(String(s || '').replace(/\s/g, '').replace(',', '.')); return isNaN(v) ? 0 : v }
const I = { datum: 0, kat: 4, prot: 5, protName: 6, typ: 7, zprava: 8, pozn: 9, vs: 10, amount: 13, merchant: 20 }
const ym = (d) => { const m = String(d).match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? `${m[3]}-${m[2]}` : null }

function categorize(r) {
  const prot = r[I.prot] || '', pn = (r[I.protName] || '').toLowerCase(), z = (r[I.zprava] || '').toLowerCase()
  const po = (r[I.pozn] || '').toLowerCase(), me = (r[I.merchant] || '').toLowerCase(), kat = (r[I.kat] || '').toLowerCase()
  const typ = (r[I.typ] || '').toLowerCase(), vs = r[I.vs] || '', a = num(r[I.amount])
  const blob = `${pn} ${z} ${po} ${me}`, has = (...ks) => ks.some(k => blob.includes(k))
  if (a > 0) {
    if (prot.startsWith('2107358917') || prot.startsWith('242398277') || has('comgate', 'paypal', 'payu')) return 'rev_gateway'
    if (prot.startsWith('55550309') || has('global payments', 'akceptace platebnich karet')) return 'rev_terminal'
    if (prot.startsWith('2101565309') || has('florbal s.r.o', 'florbal vsetin', 'florbalovy spolek', 'florbal hodonin', 'fbc')) return 'rev_b2b'
    if (has('vklad jednatele', 'pavlica david', 'brus, pavel', 'brusová barbora', 'brusova barbora', 'titp group', 'salibandy club', 'ps industries', 'pujcka', 'lemonero', 'cerpani')) return 'owner_in'
    if (has('financni urad', 'finanční úřad')) return 'tax_refund'
    if (kat.includes('konverze') || kat.includes('fx spot') || has('fx spot', 'rb smenarna', 'rb směnárna', 'vyrovnání')) return 'fx'
    if (typ.includes('vklad hotovosti')) return 'cash_in'
    if (vs && (typ.includes('příchozí') || typ.includes('prichozi'))) return 'rev_bank'
    return 'rev_other'
  }
  if (kat.includes('rok') && (has('úrok', 'urok') || z.includes('rok'))) return 'fin_interest'
  if (has('úrok z úvěru', 'urok z uveru', 'úrok z nevyčerp', 'sankční úrok', 'sankcni urok')) return 'fin_interest'
  if (kat.includes('poplatek') || has('vedení účtu', 'vedeni uctu', 'využívání a správa', 'jiný poplatek', 'výzva k zaplacení', 'poplatek rb', 'zpracování žádosti', 'připojení k rozhraní')) return 'bank_fees'
  if (has('splátka úvěru', 'splatka uveru', 'splátka jistiny', 'splátka poplatku', 'pohledávky po splatnosti', 'čerpání úvěru', 'cerpani uveru')) return 'fin_loan'
  if (has('raiffeisen-leasing', 'raiffeisen - leasing', 'leasing')) return 'fin_leasing'
  if (kat.includes('konverze') || kat.includes('fx spot') || has('fx spot', 'rb smenarna', 'rb směnárna')) return 'fx'
  if (has('facebk', 'meta pay', 'google*ads', 'google *ads', 'google ads', 'seznam', 'tiktok', 'ecomail', 'fiverr', 'canva', 'capcut', 'opus clip', 'raynet', 'clickfunnels', 'scribd', 'patreon', 'stape', 'leadhub', 'vintrica')) return 'marketing'
  if (has('bajgar', 'václavíková', 'vaclavikova', 'kuchař', 'kuchar', 'zuzka marketing', 'sprava ppc', 'sprava meta', 'sprava reklam', 'marketingove poradenstvi', 'simicek', 'nataceni', 'vytvareni strategie', 'dohled nad vyvojem', 'winitio', 'fit academy', 'eos media', 'story s animaci')) return 'marketing'
  // Pravidelná měsíční fixní platba na účet ...797 ("SALIBANDY SRO", VS=období) — neidentifikovaná, ale reálný fixní náklad → režie
  if (prot.startsWith('261043797')) return 'fixed_unknown'
  // KAPITÁL / vybavení (mimo provozní P&L): mantinely, elektronika, auto, fitko
  if (has('uher company', 'uher', 'mantinely', 'electro world', 'electroworld', 'alza', 'ikea', 'auto hruska', 'platba auto', 'salibandy - 1', 'clever fit', 'form factory')) return 'capex'
  // ZBOŽÍ (COGS) — jasní dodavatelé zboží a výrobní vstupy
  if (has('alibaba')) return 'cogs'
  if (prot.startsWith('107-9194600207') || prot.startsWith('123-2916950267') || prot.startsWith('212069093')) return 'cogs'
  if (has('lm rubber', 'machacek', 'herbalus', 'foxel', 'suchac', 'suchy zip', 'suche zip', 'fakturujeme vam zbozi', 'fakturujeme vam za dodane', 'uctujeme vam zbozi', 'molitany', 'vylen', 'salicube', 'rezani ringu', 'pila na rezani', 'tluste suchac', 'tlusty suchac', 'tenky suchac', 'omotávky', 'omotavky', 'naradihornig', 'promistry', 'zaslepky')) return 'cogs'
  // LOGISTIKA / balné / doprava / web
  if (has('česká pošta', 'ceska posta', 'dhl', 'balikdozahranici', 'balík do zahraničí', 'zásilkovna', 'zasilkovna', 'doprava', 'preprava', 'webhosting', 'wedos', 'godaddy', 'eobaly', 'clo', 'pays', 'krabice', 'pytliky', 'dtpshop')) return 'logistics'
  if (has('upgates', 'google workspace', 'google*gsuite', 'google gsuite', 'gsuite', 'superfaktur')) return 'saas'
  if (has('zbyněk hora', 'zbynek hora', 'dennis hübsch', 'dennis hubsch', 'pavel brus vyplata', 'fak pavel', 'pavel brus výplata', 'výplata', 'vyplata', 'mzda', 'monsport', 'adam kuchar')) return 'payroll'
  if (has('davpav', 'top design taxes', 'ucetnictvi', 'účetnictví', 'firsen', 'ekonomicke poradenstvi', 'greenberg', 'trucino')) return 'accounting'
  if (has('shell', 'orlen', 'omv', 'mol ', 'mol-', 'eurooil', 'euro oil', 'robin oil', 'plus oil', 'petroil', 'benzina', 'cs gold', 'cs euro', 'cs petroil', 'cs litovel', 'čerpac', 'cerpaci', 'parkov', 'parking', 'airport', 'letiste', 'letiště', 'imo car', 'automycka', 'amic', 'union road', 'tam autohof', 'moya', 'stalexport', 'autostrada', 'mpl services', 'parkovi', 'aeroparking', 'parkvia', 'easypark', 'mpla', 'smart parkov', 'kongresove', 'auto hruska')) return 'personal'
  if (has('cafe', 'café', 'kafe', 'cokafe', 'bistro', 'restau', 'pizza', 'sushi', 'gokana', 'coloseum', 'hogofogo', 'poke', 'dock', 'monet', ' karma', 'drinkeat', 'coffeeshop', 'koncepty', 'hospoda', 'kurnik', 'mlecny bar', 'cerneho stromu', 'ollies', 'form factory', 'clever fit', 'tesco', 'lidl', 'makro', 'albert', 'ikea', 'kaskada', 'rec 21', 'nefrito', 'eurobit', 'a cafe', 'imperial hotel', 'stages hotel', 'muziker', 'electroworld', 'alza', 'zalando', 'nemocnice', 'forum nova', 'palladium')) return 'personal'
  if (has('financni urad', 'finanční úřad', 'exekut', 'magistrat', 'magistrát', 'pokuta', 'financni sprava', 'finanční správa', 'clo lucie')) return 'tax_paid'
  if (has('prevod mezi ucty', 'převod mezi účty', 'mezi ucty', 'salibandy club', 'titp group')) return 'internal'
  if (has('vracena platba', 'vrácena platba', 'vraceni', 'vrácení', 'odstoupeni', 'reklamace', 'vracene zbozi', 'vrácené zboží')) return 'refunds'
  if (typ.includes('výběr') || has('výběr hotovosti', 'vyber hotovosti')) return 'cash_out'
  return 'other'
}

// ---- agregace měsíčně ----
const raw = readFileSync(D + 'Pohyby_0092444767_202606191246.csv', 'utf8').replace(/^﻿/, '')
const body = parseCSV(raw).slice(1).filter(r => r.length > 13 && r[1])
const M = {} // month -> {rev, cogs, marketing, logistics, rezie, osobni}
const VAT = 1.21
for (const r of body) {
  const a = num(r[I.amount]); if (!a) continue
  const m = ym(r[I.datum]); if (!m) continue
  const c = categorize(r)
  M[m] = M[m] || { rev: 0, cogs: 0, marketing: 0, logistics: 0, rezie: 0, osobni: 0 }
  if (c === 'rev_gateway' || c === 'rev_terminal' || c === 'rev_b2b' || c === 'rev_bank') M[m].rev += a / VAT
  else if (c === 'cogs') M[m].cogs += a
  else if (c === 'marketing') M[m].marketing += a
  else if (c === 'logistics') M[m].logistics += a
  else if (c === 'payroll' || c === 'accounting' || c === 'saas' || c === 'fixed_unknown') M[m].rezie += a
  else if (c === 'fuel_travel' || c === 'personal') M[m].osobni += a
}

// ---- ledger ----
const months = Object.keys(M).sort()
const item = (mo, n, desc, cat, amount, extra = {}) => {
  const v = Math.round(amount)
  return { id: `sl-${mo}-${n}`, date: `${mo}-15`, source: cat === 'revenue' ? 'invoice' : 'bill', status: 'paid',
    category: cat, description: desc, amount_actual: v, amount_expected: v, ...extra }
}
const ledgerMonths = months.map(mo => {
  const b = M[mo]; const items = []
  if (Math.round(b.rev)) items.push(item(mo, 1, 'Tržby (e-shop)', 'revenue', b.rev))
  if (Math.round(b.cogs)) items.push(item(mo, 2, 'Nákup zboží', 'cost', b.cogs))
  if (Math.round(b.marketing)) items.push(item(mo, 3, 'Marketing', 'cost', b.marketing))
  if (Math.round(b.logistics)) items.push(item(mo, 4, 'Logistika a balné', 'cost', b.logistics))
  if (Math.round(b.rezie)) items.push(item(mo, 5, 'Mzdy a režie', 'cost', b.rezie))
  if (Math.round(b.osobni)) items.push(item(mo, 6, 'Osobní (auto, strava)', 'cost', b.osobni, { kind: 'osobni' }))
  return { month: mo, items }
})

// ---- roční souhrn pro KPI + whatif (2025 = báze) ----
function yearSum(y) {
  const o = { rev: 0, cogs: 0, marketing: 0, logistics: 0, rezie: 0, osobni: 0 }
  for (const mo of months) if (mo.startsWith(y)) for (const k in o) o[k] += M[mo][k]
  return o
}
const y24 = yearSum('2024'), y25 = yearSum('2025'), y26 = yearSum('2026')
const r0 = (n) => Math.round(n)
const fmt = (n) => `${r0(n).toLocaleString('cs-CZ')} Kč`
const pct = (a, b) => b ? Math.round(a / b * 100) : 0
// reálný provozní výsledek (bez osobní): rev - cogs - marketing - logistics - rezie ; osobni je − (záporné) tak ho NEodečítáme
const oper = (y) => y.rev + y.cogs + y.marketing + y.logistics + y.rezie // cogs atd. jsou záporné
const grossM = (y) => pct(y.rev + y.cogs, y.rev) // (rev - zboží)/rev
const pno = (y) => pct(-y.marketing, y.rev)

const whatif_base = {
  annual_revenue: r0(y25.rev),
  material_pct: pct(-y25.cogs, y25.rev),
  other_income: 0,
  fixed_annual: r0(-(y25.marketing + y25.logistics + y25.rezie + y25.osobni)),
  depreciation_annual: 0,
  labor_share_pct: 0, // e-shop · žádná hodinová práce
}

const kpiGrid = {
  type: 'kpi-grid', columns: 4, items: [
    { label: 'Tržby 2025 (z banky)', value: fmt(y25.rev), sub: 'reálný obrat bez DPH', trend: 'neutral', intent: 'default' },
    { label: 'Hrubá marže', value: `${grossM(y25)} %`, sub: 'po nákupu zboží', trend: 'neutral', intent: grossM(y25) < 55 ? 'warning' : 'default' },
    { label: 'PNO · marketing/obrat', value: `${pno(y25)} %`, sub: 'zdravé je 10–20 %', trend: 'down', intent: 'critical' },
    { label: 'Provozní výsledek 2025', value: fmt(oper(y25)), sub: oper(y25) < 0 ? 'ztrátový provoz' : 'ziskový', trend: oper(y25) < 0 ? 'down' : 'up', intent: oper(y25) < 0 ? 'critical' : 'default' },
  ],
}
const riskList = {
  type: 'risk-list', items: [
    { level: 'critical', title: `Marketing požírá marži · PNO ${pno(y25)} %`, desc: `Reklama stála ${fmt(-y25.marketing)} v 2025 (Meta dominuje). Na e-shop je zdravé 10–20 % obratu. Hlavní páka: vypnout neefektivní kampaně, řídit ROAS po kanálech a produktech.` },
    { level: 'critical', title: 'Předlužení (záporný vlastní kapitál) + vysoká dluhová služba', desc: `Doloženo rozvahou 2023: vlastní kapitál −338 tis. Kč (2022: −351), cizí zdroje 1,46 mil. Kč. K tomu leasing + investiční úvěr + neúčelový úvěr + Lemonero + kontokorent · splátky a úroky ~35–40 tis. Kč/měs. Řešit kapitalizací půjček společníka do vlastního kapitálu a refinancováním.` },
    { level: 'critical', title: 'Provoz drží vklady majitele', desc: `Společníci dolévají ~780 tis. Kč ročně, jinak je firma cash-flow záporná. Cíl: provoz, který se uživí sám · marže × objem pokryjí fixní náklady i dluh.` },
    { level: 'medium', title: 'Silná sezónnost a kolísání tržeb', desc: 'Špička Q4 (listopad/prosinec), propad v létě. Plánovat zásoby, marketing i cashflow podle sezóny, držet rezervu na slabé měsíce.' },
    { level: 'medium', title: 'Závislost na jednom kanálu (Meta)', desc: 'Většina marketingu jde přes Facebook/Meta. Rozložit riziko · SEO/PPC, Heureka/Zboží.cz, e-mail, opakované nákupy.' },
    { level: 'low', title: 'Účetnictví nesedí s bankou', desc: 'Vydané faktury (FV) ukazují jen ~450 tis./rok, banka 2–3× víc. Sjednotit evidenci tržeb s účetní (výsledovka) · ať daně i reporting sedí.' },
  ],
}
const overview = [
  { id: 'sl-h', type: 'heading', level: 2, eyebrow: 'CFO obraz', text: 'Salibandy · reálný obraz e-shopu z banky', sub: 'Postaveno ze skutečných bankovních pohybů 2024–2026. Tržby bez DPH, náklady v reálných penězích.' },
  { id: 'sl-kpi', ...kpiGrid },
  { id: 'sl-c1', type: 'callout', intent: 'warning', title: 'Tři věci, které firmu dusí', body: 'Marketing kolem 34 % obratu, těžká dluhová služba a závislost na vkladech majitele. Provoz je zatím cash-flow záporný. Dobrá zpráva: všechny tři páky jdou řešit a v portálu je teď vidíš černé na bílém.' },
  { id: 'sl-c2', type: 'callout', intent: 'info', title: 'Co je e-shop CFO', body: 'Hospodaření čteš jako e-shop: tržby → nákup zboží → hrubá marže → marketing → logistika → mzdy a režie. Osobní výdaje (auto, strava) jsou oddělené v reálné vrstvě. Klimentík (vpravo dole) zná celý obraz a spočítá „co kdyby".' },
  { id: 'sl-risk', ...riskList },
  { id: 'sl-ph', type: 'heading', level: 2, eyebrow: 'Ozdravný plán', text: 'Jak Salibandy dostat zpátky do zisku', sub: 'Pět tahů v pořadí podle dopadu. Cíl: provoz, který se uživí sám, a konec dolévání z kapsy majitele.' },
  {
    id: 'sl-plan', type: 'step-list', title: 'Plán ozdravení · krok za krokem', layout: 'timeline',
    items: [
      { num: '1', title: `Srazit marketing na PNO ~25 % (z ${pno(y25)} %)`, desc: `Reklama je hlavní díra. Audit kampaní podle ROAS po produktech a kanálech, vypnout ztrátové, posílit retenci (e-mail, opakované nákupy) a levné kanály (SEO, Heureka/Zboží.cz). Z ~${fmt(-y25.marketing)} na ~270 tis./rok = úspora kolem 250 tis. To samo vrátí provoz blízko nuly.` },
      { num: '2', title: 'Kapitalizovat půjčky společníků do vlastního kapitálu', desc: 'Vklady ~780 tis./rok přeměnit na základní/ostatní kapitál místo půjček. Řeší předlužení (záporný VK), uklidní rozvahu a zastaví část úroků. Pak refinancovat drahé úvěry (investiční + neúčelový + Lemonero) do jednoho levnějšího · dnešní dluhová služba ~35–40 tis./měs.' },
      { num: '3', title: 'Řídit zásoby podle obrátky, ne nakupovat na sklad dopředu', desc: 'Velké nákupy z Alibaby vážou hotovost na měsíce dopředu (proto 2026 opticky propadlo). Objednávat podle prodejnosti a sezóny, držet jen rychloobrátkové. Uvolní desítky tisíc cash měsíčně.' },
      { num: '4', title: 'Identifikovat fixní platbu ~30 tis./měs (účet …797) a stlačit fixní náklady', desc: 'Pravidelná platba „SALIBANDY SRO" ~30 tis./měs (~360 tis./rok) · zjistit co to je (sklad / služba / odměna) a vyjednat nebo zrušit. Spolu s ostatní režií je to největší páka po marketingu.' },
      { num: '5', title: 'Týdenní cashflow režim a konec dolévání majitelem', desc: 'Sledovat hotovost, DPH (jste v nadměrném odpočtu = vratky od FÚ), splatnosti pohledávek i závazků. Cílový stav: provoz pokryje sám sebe i dluh, vklady majitele přestanou být nutné.' },
    ],
  },
  { id: 'sl-target', type: 'callout', intent: 'success', title: 'Kam to může dojet', body: `Hrubá marže zboží je zdravá (~55 %), problém není v produktu ani cenách · je v nákladech nad marží. Když srazíš PNO na ~25 % a zkrotíš fixní náklady, provoz se dostane z dnešní ztráty do plusu řádově +100 až +150 tis./rok. To spolu s kapitalizací půjček a refinancováním dluhu firmu stabilizuje · bez dalších vkladů z kapsy.` },
]

// ---- zápis ----
const { data: cur, error: e0 } = await sb.from('reports').select('data').eq('id', REPORT_ID).single()
if (e0) { console.error('load:', e0.message); process.exit(1) }
const d = cur.data || {}
const next = {
  ...d,
  business_model: 'transaction',
  title: 'Salibandy, s.r.o.',
  subtitle: 'CFO Report · e-shop · reálná data z banky 2024–2026',
  status: 'active',
  ledger: { bank_balance: 40000, months: ledgerMonths },
  whatif_base,
  business_profile: {
    industry: 'E-shop · florbalové vybavení', employees: '2/3', vat_payer: true, complexity: 'standard',
    entity_type: 'sro', founding_date: '2020-01', annual_revenue: `${(y25.rev / 1e6).toFixed(1)} mil. Kč (2025, z banky)`,
    fiscal_year_start: '01', vat_transition_date: '',
  },
  revenue: fmt(y25.rev / 12), revenue_trend: 'reálný obrat z banky', revenue_trend_up: true,
  ebitda: fmt(oper(y25) / 12), ebitda_period: 'provozní výsledek (měs. ø 2025)', ebitda_trend: oper(y25) < 0 ? 'ztrátový' : 'ziskový', ebitda_trend_up: oper(y25) >= 0,
  blocks_overview: overview,
}

const { error: e1 } = await sb.from('reports').update({ data: next }).eq('id', REPORT_ID)
if (e1) { console.error('write:', e1.message); process.exit(1) }

console.log('=== ZAPSÁNO ===')
console.log('měsíců:', ledgerMonths.length, '| položek celkem:', ledgerMonths.reduce((s, m) => s + m.items.length, 0))
for (const [y, o] of [['2024', y24], ['2025', y25], ['2026 (do VI)', y26]]) {
  console.log(`\n${y}: tržby ${fmt(o.rev)} | zboží ${fmt(-o.cogs)} | hrubá marže ${grossM(o)}% | marketing ${fmt(-o.marketing)} (PNO ${pno(o)}%) | logistika ${fmt(-o.logistics)} | mzdy+režie ${fmt(-o.rezie)} | osobní ${fmt(-o.osobni)} | PROVOZ ${fmt(oper(o))}`)
}
console.log('\nwhatif_base:', JSON.stringify(whatif_base))
