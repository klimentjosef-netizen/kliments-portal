// Seznam podkladů, které klientovi za měsíc chybí: platby bez dokladu, výplaty platební
// brány bez vyúčtování a body k vyjasnění. PDF ve vzhledu Kliments, samostatný dokument
// k faktuře.
//
//   node chybejici.mjs --ico 24051705 --mesic 2026-09 [--poznamka "text"]... [--vystaveni 2026-10-01] [--ven slozka]
//   --bez-vratek  nevypisovat vrácené platby zákazníkům (dobropisy dodá kancelář sama)
import './lib/env.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { FIRSEN, KLIMENT } from './lib/firsen.mjs'

const requirePortal = createRequire(new URL('../package.json', import.meta.url))
const { chromium } = requirePortal('playwright')
const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const vsechny = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []))
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const CSS = fs.readFileSync(new URL('./sablony/kliments.css', import.meta.url), 'utf8')
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const kc = (n) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const den = (s) => new Date(s).toLocaleDateString('cs-CZ')
const NASE_UCTY = new Set([FIRSEN.ucet, KLIMENT.ucet])
// Název příjemce: u SEPA plateb bývá jen ve zprávě mezi středníky (např. "533,48 EUR;...;Silvexcraft Sp. k.;Eshop")
const prijemce = (t) => t.counterparty_name || (t.message ?? '').split(/[;·]/).map((s) => s.trim()).find((s) => /[a-zA-Zá-ž]{4}/.test(s) && !/^\d[\d\s,.]*\s*[A-Z]{3}$/.test(s)) || 'neuvedeno'

// Co po klientovi chtít podle druhu platby
function coDodat(t) {
  const txt = `${t.counterparty_name ?? ''} ${t.message ?? ''}`
  if (/vraceni platby|vrácení platby/i.test(txt)) return 'doklad o vrácení platby zákazníkovi (dobropis nebo storno objednávky)'
  if (!t.counterparty_name && !/[a-z]{3}/i.test(t.message ?? '')) return 'upřesnit, komu a za co platba šla, a doložit doklad'
  if (/zásilkovna|zasilkovna|ppl|dpd|česká pošta|gls/i.test(txt)) return 'faktura za přepravu zásilek'
  if (/seznam|kredit/i.test(txt)) return 'daňový doklad k dobití kreditu nebo faktura Sklik'
  if (/gopay \*|card|karta|; [a-z]{3}$/i.test(txt) || t.category === 'card') return 'účtenka nebo faktura k platbě kartou'
  return 'faktura nebo jiný doklad k platbě'
}

async function main() {
  const ico = arg('--ico')
  const mesic = `${arg('--mesic')}-01`
  const vystaveni = arg('--vystaveni') ?? new Date().toISOString().slice(0, 10)
  const { data: k } = await db.from('clients').select('id, name, ico, pricing').eq('ico', ico).single()
  const m = new Date(mesic)
  const doo = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  const mesicSlovem = `${MESICE[m.getUTCMonth()]} ${m.getUTCFullYear()}`

  const { data: pohyby, error } = await db.from('bank_transactions')
    .select('id, booked_on, amount, counterparty_name, counterparty_account, var_symbol, message, category, no_document_needed')
    .eq('client_id', k.id).gte('booked_on', mesic).lt('booked_on', doo).order('booked_on')
  if (error) throw error
  const { data: pary } = await db.from('payment_matches').select('bank_transaction_id').in('bank_transaction_id', pohyby.map((t) => t.id))
  const sparovano = new Set((pary ?? []).map((p) => p.bank_transaction_id))

  const jeVratka = (t) => /vraceni platby|vrácení platby/i.test(`${t.counterparty_name ?? ''} ${t.message ?? ''}`)
  const chybi = pohyby.filter((t) => Number(t.amount) < 0 && !sparovano.has(t.id) && !t.no_document_needed && !NASE_UCTY.has(t.counterparty_account)
    && !(args.includes('--bez-vratek') && jeVratka(t)))
  const vyplaty = k.pricing?.gopay_rozpad
    ? pohyby.filter((t) => Number(t.amount) > 0 && /gopay|vyuctovani/i.test(`${t.counterparty_name ?? ''} ${t.message ?? ''}`))
    : []
  const poznamky = vsechny('--poznamka')
  const soucet = chybi.reduce((s, t) => s - Number(t.amount), 0)

  const radky = chybi.map((t) => `<tr><td>${den(t.booked_on)}</td>
      <td>${esc(prijemce(t))}${t.var_symbol ? `<span class="sub">VS ${esc(t.var_symbol)}${t.counterparty_account ? ` · účet ${esc(t.counterparty_account)}` : ''}</span>` : t.counterparty_account ? `<span class="sub">účet ${esc(t.counterparty_account)}</span>` : ''}</td>
      <td class="r">${kc(-Number(t.amount))}</td><td>${esc(coDodat(t))}</td></tr>`).join('')

  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Chybějící podklady</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS}
  .page.flow { height: auto; min-height: 297mm; overflow: visible; padding-bottom: 16mm; }
  .page.flow footer { position: static; margin-top: 8mm; }
  table.price td { padding: 1.3mm 3mm; font-size: 8pt; }
  table.price td:first-child { white-space: nowrap; }
  table.price tr { page-break-inside: avoid; }
  .stat .v { font-size: 16pt; }
</style></head><body>
<div class="page flow">
  <header>
    <div class="logo">Kliments<span>.</span></div>
    <div class="contact">Josef Kliment · Business architekt<br><a>kliments.cz</a> · kliment.josef@email.cz · Ostrava</div>
  </header>
  <div class="eyebrow">Podklady k doplnění</div>
  <h1>Co chybí ${esc(k.name.replace(/,?\s*s\.\s?r\.\s?o\.\s*$/i, ''))} <em>${esc(mesicSlovem)}</em></h1>
  <p class="lead">Platby z bankovního účtu za ${esc(mesicSlovem)}, ke kterým zatím nemáme doklad, a další podklady potřebné k uzavření měsíce.</p>
  <div class="chips">
    <div class="chip">Pro <b>${esc(k.name)}</b></div>
    <div class="chip">IČO <b>${esc(k.ico)}</b></div>
    <div class="chip">Období <b>${esc(mesicSlovem)}</b></div>
    <div class="chip">Stav k <b>${den(vystaveni)}</b></div>
  </div>

  <div class="sec-num" style="margin-top:4mm">01</div>
  <h2>Shrnutí</h2>
  <div class="grid4">
    <div class="stat"><div class="v">${chybi.length}</div><div class="l">Platby bez dokladu</div></div>
    <div class="stat"><div class="v">${Math.round(soucet).toLocaleString('cs-CZ')} Kč</div><div class="l">Jejich hodnota</div></div>
    <div class="stat"><div class="v">${vyplaty.length}</div><div class="l">Vyúčtování GoPay</div></div>
    <div class="stat"><div class="v">${poznamky.length}</div><div class="l">K vyjasnění</div></div>
  </div>

  <div class="sec-num" style="margin-top:4mm">02</div>
  <h2>Platby <em>bez dokladu</em></h2>
  <table class="price">
    <tr><th>Datum</th><th>Příjemce</th><th class="r">Částka Kč</th><th>Co prosím dodat</th></tr>
    ${radky || '<tr><td colspan="4">Ke všem platbám doklady máme.</td></tr>'}
    ${chybi.length ? `<tr class="tot"><td>Celkem</td><td>${chybi.length} plateb</td><td class="r">${kc(soucet)}</td><td></td></tr>` : ''}
  </table>

  ${vyplaty.length ? `<div class="sec-num" style="margin-top:4mm">03</div>
  <h2>Vyúčtování <em>GoPay</em></h2>
  <table class="price">
    <tr><th>Datum výplaty</th><th>Číslo vyúčtování</th><th class="r">Částka Kč</th><th>Co prosím dodat</th></tr>
    ${vyplaty.map((t) => `<tr><td>${den(t.booked_on)}</td><td>${esc(t.var_symbol ?? '')}</td><td class="r">${kc(t.amount)}</td><td>vyúčtování z portálu GoPay (PDF nebo CSV)</td></tr>`).join('')}
  </table>
  <p class="hint" style="margin-top:1.5mm">Vyúčtování rozpisuje výplatu na jednotlivé objednávky a poplatky. Bez něj nejde výplatu spárovat s fakturami.</p>` : ''}

  ${poznamky.length ? `<div class="sec-num" style="margin-top:4mm">${vyplaty.length ? '04' : '03'}</div>
  <h2>K <em>vyjasnění</em></h2>
  <div class="card white"><ul class="dash">${poznamky.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}

  <div class="dark slim" style="margin-top:5mm;display:flex;justify-content:space-between;align-items:center;gap:6mm;padding:3mm 6mm">
    <div><h3>Děkuji za <em>doplnění.</em></h3>
    <div class="fine" style="margin-top:0.8mm">Doklady stačí poslat na společný e-mail pro účetnictví nebo nahrát do portálu Kliments, ideálně do 10. dne následujícího měsíce.</div></div>
    <div class="who" style="margin-top:0;white-space:nowrap">Josef Kliment<span>·</span>kliment.josef@email.cz</div>
  </div>
  <footer><span>Kliments. · Josef Kliment · kliments.cz</span><span>Podklady k doplnění · ${esc(mesicSlovem)}</span></footer>
</div></body></html>`

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kliments-chybi-'))
  fs.writeFileSync(path.join(dir, 'chybi.html'), html, 'utf8')
  const ven = arg('--ven') ?? dir
  fs.mkdirSync(ven, { recursive: true })
  const pdf = path.join(ven, `Chybejici_podklady_${k.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '')}_${arg('--mesic')}.pdf`)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${path.join(dir, 'chybi.html').replace(/\\/g, '/')}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }
  console.log(`${k.name}: chybí ${chybi.length} dokladů (${kc(soucet)} Kč), vyúčtování GoPay ${vyplaty.length}, k vyjasnění ${poznamky.length}\n${pdf}`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
