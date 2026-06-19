// Salibandy s.r.o. — analýza banky (Raiffeisen CSV) + faktur (FV/FP) pro e-shop CFO.
// Cíl: kompaktní finanční obraz po letech a měsících, kategorie e-shopu. Nesype syrová data.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const D = 'C:/Users/klime/Downloads/'

// ---- CSV parser (oddělovač ;, uvozovky, středníky uvnitř polí) ----
function parseCSV(text) {
  const rows = []
  let cur = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else {
      if (c === '"') q = true
      else if (c === ';') { cur.push(field); field = '' }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  return rows
}
const num = (s) => { const v = parseFloat(String(s || '').replace(/\s/g, '').replace(',', '.')); return isNaN(v) ? 0 : v }

const raw = readFileSync(D + 'Pohyby_0092444767_202606191246.csv', 'utf8').replace(/^﻿/, '')
const rows = parseCSV(raw)
const head = rows[0]
const body = rows.slice(1).filter(r => r.length > 13 && r[1])

// indexy
const I = { datum: 0, kat: 4, prot: 5, protName: 6, typ: 7, zprava: 8, pozn: 9, vs: 10, amount: 13, origCur: 16, merchant: 20 }

function ym(d) { // "19.06.2026" -> "2026-06"
  const m = String(d).match(/(\d{2})\.(\d{2})\.(\d{4})/); return m ? `${m[3]}-${m[2]}` : '????-??'
}

// ---- kategorizace ----
function categorize(r) {
  const prot = r[I.prot] || '', pn = (r[I.protName] || '').toLowerCase()
  const z = (r[I.zprava] || '').toLowerCase(), po = (r[I.pozn] || '').toLowerCase()
  const me = (r[I.merchant] || '').toLowerCase(), kat = (r[I.kat] || '').toLowerCase()
  const typ = (r[I.typ] || '').toLowerCase(), vs = r[I.vs] || ''
  const a = num(r[I.amount]); const blob = `${pn} ${z} ${po} ${me}`
  const has = (...ks) => ks.some(k => blob.includes(k))

  // --- PŘÍJMY ---
  if (a > 0) {
    if (prot.startsWith('2107358917') || prot.startsWith('242398277') || has('comgate')) return 'rev_gateway'
    if (prot.startsWith('55550309') || has('global payments', 'akceptace platebnich karet')) return 'rev_terminal'
    if (has('paypal', 'payu')) return 'rev_gateway'
    if (prot.startsWith('2101565309') || has('florbal s.r.o', 'florbal vsetin', 'florbalovy spolek', 'florbalovy spolek ft')) return 'rev_b2b_florbal'
    if (has('vklad jednatele', 'pavlica david', 'brus, pavel', 'brusová barbora', 'brusova barbora', 'titp group', 'salibandy club', 'ps industries', 'pujcka', 'lemonero')) return 'owner_in'
    if (has('financni urad', 'financní úrad')) return 'tax_refund'
    if (has('cerpani', 'úvthe')) return 'loan_in'
    if (typ.includes('vklad hotovosti') || has('vklad hotovosti')) return 'cash_deposit'
    if (kat.includes('konverze') || kat.includes('fx spot') || has('fx spot', 'rb směnárna', 'rb smenarna')) return 'fx'
    // ostatní příchozí s VS = objednávka přes převod (B2C/B2B)
    if (vs && (typ.includes('příchozí') || typ.includes('prichozi'))) return 'rev_bank_orders'
    return 'rev_other_in'
  }

  // --- VÝDAJE ---
  if (kat.includes('úrok') || kat.includes('urok') || has('úrok z úvěru', 'urok z uveru', 'úrok z nevyčerp', 'sankční úrok')) return 'fin_interest'
  if (kat.includes('poplatek') || has('poplatek rb směnárna', 'vedení účtu', 'využívání a správa', 'jiný poplatek', 'výzva k zaplacení')) return 'bank_fees'
  if (has('splátka úvěru', 'splatka uveru', 'splátka jistiny', 'splátka poplatku', 'pohledávky po splatnosti')) return 'fin_loan_principal'
  if (has('raiffeisen-leasing', 'raiffeisen - leasing', 'leasing')) return 'fin_leasing'
  if (kat.includes('konverze') || kat.includes('fx spot') || has('fx spot', 'rb směnárna', 'rb smenarna')) return 'fx'

  // marketing
  if (has('facebk', 'meta pay', 'google*ads', 'google *ads', 'google ads', 'seznam', 'tiktok', 'ecomail', 'fiverr', 'canva', 'capcut', 'opus clip', 'raynet', 'clickfunnels', 'scribd', 'patreon', 'stape', 'leadhub')) return 'marketing'
  if (has('bajgar', 'václavíková', 'vaclavikova', 'kuchař', 'kuchar', 'zuzka marketing', 'sprava ppc', 'sprava meta', 'marketingove poradenstvi', 'simicek', 'sod', 'nataceni', 'vytvareni strategie', 'dohled nad vyvojem')) return 'marketing'

  // zboží / výroba (COGS)
  if (has('alibaba')) return 'cogs_import'
  if (prot.startsWith('107-9194600207') || has('lm rubber', 'machacek', 'herbalus', 'uher company', 'foxel', 'suchac', 'suchace', 'suchy zip', 'suche zipy', 'fakturujeme vam zbozi', 'fakturujeme vam za dodane', 'uctujeme vam zbozi', 'molitany', 'vylen', 'krabice', 'pytliky', 'salicube', 'salipong', 'zaslepky', 'rezani ringu', 'pila na rezani', 'tluste suchace', 'tlusty suchac', 'tenky suchac', 'omotávky', 'omotavky', 'dtpshop', 'naradihornig', 'promistry', 'electroworld', 'alza')) return 'cogs_goods'

  // logistika / doprava / balné
  if (has('česká pošta', 'ceska posta', 'dhl', 'balikdozahranici', 'balík do zahraničí', 'zásilkovna', 'doprava', 'preprava', 'webhosting', 'wedos', 'godaddy', 'eobaly', 'clo')) return 'logistics'

  // platforma / SaaS / web
  if (has('upgates', 'google workspace', 'google*gsuite', 'google gsuite', 'gsuite', 'superfaktur', 'ono - spytihnev')) return 'saas_platform'

  // mzdy / odměny
  if (has('zbyněk hora', 'zbynek hora', 'dennis hübsch', 'dennis hubsch', 'pavel brus vyplata', 'fak pavel', 'výplata', 'vyplata', 'mzda', 'monsport', 'adam kuchar')) return 'payroll'

  // účetnictví / poradenství
  if (has('davpav', 'top design taxes', 'ucetnictvi', 'účetnictví', 'firsen', 'ekonomicke poradenstvi', 'greenberg')) return 'accounting'

  // PHM / cestovné
  if (has('shell', 'orlen', 'omv', 'mol', 'eurooil', 'euro oil', 'robin oil', 'plus oil', 'petroil', 'benzina', 'eurobit', 'cs ', 'čerpac', 'cerpaci', 'parkov', 'parking', 'airport', 'letiste', 'letiště', 'imo car', 'automycka', 'amic', 'orlen cs', 'union road', 'tam autohof', 'moya', 'stalexport', 'autostrada', 'mpl services')) return 'fuel_travel'

  // osobní / stravování
  if (has('cafe', 'café', 'kafe', 'cokafe', 'bistro', 'restau', 'pizza', 'sushi', 'gokana', 'coloseum', 'hogofogo', 'poke', 'dock', 'monet', 'karma', 'drinkeat', 'coffeeshop', 'koncepty', 'hospoda', 'kurnik', 'mlecny bar', 'u cerneho stromu', 'ollies', 'form factory', 'clever fit', 'tesco', 'lidl', 'makro', 'albert', 'ikea', 'kaskada', 'rec 21', 'nefrito', 'eurobit 44')) return 'personal'

  // daně
  if (has('financni urad', 'finanční úřad', 'exekut', 'magistrat', 'magistrát', 'pokuta')) return 'tax_paid'

  // mezi účty / vlastní
  if (has('prevod mezi ucty', 'převod mezi účty', 'mezi ucty', 'salibandy club', 'titp group')) return 'internal_out'
  if (has('vracena platba', 'vrácena platba', 'vraceni', 'vrácení', 'odstoupeni', 'reklamace', 'vracene zbozi')) return 'refunds_out'
  if (typ.includes('výběr') || has('výběr hotovosti', 'vyber hotovosti')) return 'cash_withdraw'

  return 'other_out'
}

// ---- agregace ----
const byCatYear = {}, byMonthRev = {}, merch = {}
let firstBal = null
for (const r of body) {
  const a = num(r[I.amount]); if (!a) continue
  const cat = categorize(r); const y = ym(r[I.datum]).slice(0, 4); const m = ym(r[I.datum])
  byCatYear[cat] = byCatYear[cat] || {}
  byCatYear[cat][y] = (byCatYear[cat][y] || 0) + a
  if (cat.startsWith('rev_')) byMonthRev[m] = (byMonthRev[m] || 0) + a
  // top merchants pro COGS+marketing kontrolu
  if (['cogs_goods', 'cogs_import', 'marketing', 'other_out'].includes(cat)) {
    const k = (r[I.merchant] || r[I.protName] || r[I.zprava] || '?').slice(0, 28)
    merch[cat] = merch[cat] || {}; merch[cat][k] = (merch[cat][k] || 0) + a
  }
}

// ---- faktury ----
function readXlsx(f) { const wb = XLSX.readFile(D + f + '.xlsx'); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).slice(1) }
const kc = (s) => num(String(s).replace(/kč/i, ''))
function fdate(d) { const m = String(d).match(/(\d+)\/(\d+)\/(\d+)/); return m ? `${m[3]}-${String(m[2]).padStart(2, '0')}` : '?' } // M/D/YYYY

// FV: revenue base = Kč snížená(6) + Kč základní(8) + Kč 2 snížená(10); VAT = 7+9+11
const fv = readXlsx('FV2425'); const fvYear = {}
for (const r of fv) {
  const y = fdate(r[2]).slice(0, 4); if (!/20\d\d/.test(y)) continue
  const base = kc(r[6]) + kc(r[8]) + kc(r[10]); const vat = kc(r[7]) + kc(r[9]) + kc(r[11])
  fvYear[y] = fvYear[y] || { base: 0, vat: 0, n: 0 }
  fvYear[y].base += base; fvYear[y].vat += vat; fvYear[y].n++
}
// FP: cost total = Celkem(10); VAT in = DPH snížená(5)+DPH základní(6)+DPH 2(7)
const fp = readXlsx('FP_Sali_2425'); const fpYear = {}
for (const r of fp) {
  const y = fdate(r[3]).slice(0, 4); if (!/20\d\d/.test(y)) continue
  const tot = kc(r[10]); const vat = kc(r[5]) + kc(r[6]) + kc(r[7])
  fpYear[y] = fpYear[y] || { total: 0, vat: 0, n: 0 }
  fpYear[y].total += tot; fpYear[y].vat += vat; fpYear[y].n++
}

// ---- výstup ----
const f0 = (n) => Math.round(n).toLocaleString('cs-CZ')
console.log('=== BANKA: kategorie × rok (Kč) ===')
const cats = Object.keys(byCatYear).sort()
const years = ['2024', '2025', '2026']
console.log('kategorie'.padEnd(20), years.map(y => y.padStart(13)).join(''))
for (const c of cats) {
  console.log(c.padEnd(20), years.map(y => f0(byCatYear[c][y] || 0).padStart(13)).join(''))
}
console.log('\n=== FV (vydané faktury) — tržby bez DPH + DPH na výstupu ===')
for (const y of Object.keys(fvYear).sort()) console.log(y, 'base', f0(fvYear[y].base), '| DPH out', f0(fvYear[y].vat), '| ks', fvYear[y].n)
console.log('\n=== FP (přijaté faktury) — celkem vč. DPH + DPH na vstupu ===')
for (const y of Object.keys(fpYear).sort()) console.log(y, 'celkem', f0(fpYear[y].total), '| DPH in', f0(fpYear[y].vat), '| ks', fpYear[y].n)

console.log('\n=== TOP dodavatelé/merchanti (kontrola kategorizace) ===')
for (const c of ['cogs_goods', 'cogs_import', 'marketing', 'other_out']) {
  const m = merch[c] || {}; const top = Object.entries(m).sort((a, b) => a[1] - b[1]).slice(0, 12)
  console.log(`\n[${c}]`); for (const [k, v] of top) console.log('  ', f0(v).padStart(12), k)
}

console.log('\n=== měsíční tržby (banka, všechny rev_*) ===')
for (const m of Object.keys(byMonthRev).sort()) console.log(m, f0(byMonthRev[m]))
