// Faktury firsen s.r.o. za vedení účetnictví: spočítá cenu podle ceníku klienta,
// vygeneruje PDF, uloží ho do úložiště, zapíše vyúčtování a založí doklad klientovi
// (ten ho pak vidí v portálu jako přijatou fakturu).
//
//   node faktury.mjs --mesic 2026-08 [--ico 24052477] [--cislo 2026080] [--nahled]
//                    [--vystaveni 2026-10-01] [--splatnost 2026-10-15] [--dpp 1] [--hpp 0]
//                    [--dodavatel firsen|kliment] [--odhad 68] [--polozka "Název|popis|cena bez DPH"]...
//
// Faktura se vystavuje 10. dne následujícího měsíce se splatností podle smlouvy,
// --vystaveni ji vystaví k jinému dni. --dpp/--hpp přidá příplatek za zaměstnance
// podle ceníku. --odhad určí pásmo podle předpokládaného počtu podkladů (když klient ještě
// nedodal doklady a fakturu je potřeba vystavit dřív), --polozka přidá vlastní položku.
// Za fakturou následuje přehled zpracovaných podkladů za měsíc
// (stejný výběr jako kl_podklady_mesic, takže počty sedí na fakturovaný rozsah).
import './lib/env.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { FIRSEN, DODAVATELE } from './lib/firsen.mjs'

// Dodavatel aktuálně vystavované faktury (firsen s.r.o. nebo Josef Kliment)
let D = FIRSEN

const require = createRequire(import.meta.url)               // knihovny z kancelar/
const requirePortal = createRequire(new URL('../package.json', import.meta.url)) // playwright z portálu
const { chromium } = requirePortal('playwright')
const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const NAHLED = args.includes('--nahled')
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const kc = (n) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const den = (s) => new Date(s).toLocaleDateString('cs-CZ')
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Další volné číslo v řadě: nejvyšší vystavené + 1 (řada YYYYnnn)
async function dalsiCislo(rok) {
  const { data } = await db.from('billing_runs').select('detail').not('detail', 'is', null)
  const nase = (data ?? []).map((b) => b.detail?.cislo).filter((c) => c && String(c).startsWith(String(rok)))
  if (nase.length) return String(Math.max(...nase.map(Number)) + 1)
  const { data: d } = await db.from('documents').select('doc_number')
    .eq('counterparty_ico', D.ico).like('doc_number', `${rok}%`).order('doc_number', { ascending: false }).limit(1)
  const posledni = d?.[0]?.doc_number
  if (posledni && /^\d{7}$/.test(posledni)) return String(Number(posledni) + 1)
  throw new Error(`Neznám poslední číslo faktury pro rok ${rok}, zadej --cislo`)
}

const DRUH = {
  received_invoice: ['přijatá faktura', 'přijaté faktury', 'přijatých faktur'],
  issued_invoice: ['vydaná faktura', 'vydané faktury', 'vydaných faktur'],
  receipt: ['účtenka', 'účtenky', 'účtenek'],
  bank_statement: ['bankovní výpis', 'bankovní výpisy', 'bankovních výpisů'],
  credit_note: ['dobropis', 'dobropisy', 'dobropisů'],
  advance_invoice: ['zálohová faktura', 'zálohové faktury', 'zálohových faktur'],
  payroll: ['mzdový doklad', 'mzdové doklady', 'mzdových dokladů'],
  internal: ['interní doklad', 'interní doklady', 'interních dokladů'],
  other: ['ostatní doklad', 'ostatní doklady', 'ostatních dokladů'],
}
const tvar = (n, [a, b, c]) => (n === 1 ? a : n >= 2 && n <= 4 ? b : c)
const druhN = (k, n) => tvar(n, DRUH[k] ?? [k, k, k])
const velke = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const CSS = fs.readFileSync(new URL('./sablony/kliments.css', import.meta.url), 'utf8')
const kc0 = (n) => Math.round(n).toLocaleString('cs-CZ')

// Stejný výběr jako kl_podklady_mesic (0016_vyuctovani.sql)
async function podkladyMesice(clientId, mesic) {
  const od = mesic
  const doo = new Date(Date.UTC(new Date(mesic).getUTCFullYear(), new Date(mesic).getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  const docs = []
  for (let od2 = 0; ; od2 += 1000) {
    const { data, error: e1 } = await db.from('documents')
      .select('kind, status, counterparty_name, counterparty_ico, doc_number, description, taxable_date, issue_date, received_at, amount_czk, amount_total, currency')
      .eq('client_id', clientId).neq('kind', 'contract').not('status', 'in', '(duplicate,rejected)')
      .order('id').range(od2, od2 + 999)
    if (e1) throw new Error(`doklady: ${e1.message}`)
    docs.push(...data)
    if (data.length < 1000) break
  }
  const doklady = docs
    .map((d) => ({ ...d, datum: String(d.taxable_date ?? d.issue_date ?? d.received_at ?? '').slice(0, 10) }))
    .filter((d) => d.datum >= od && d.datum < doo)
  const { data: pohyby, error: e2 } = await db.from('bank_transactions')
    .select('booked_on, amount, counterparty_name, message').eq('client_id', clientId).gte('booked_on', od).lt('booked_on', doo)
  if (e2) throw new Error(`pohyby: ${e2.message}`)
  return { doklady, pohyby }
}

function hlavicka() {
  return `<header>
    <div class="logo">Kliments<span>.</span></div>
    <div class="contact">Josef Kliment · Business architekt<br><a>kliments.cz</a> · kliment.josef@email.cz · Ostrava</div>
  </header>`
}

function stranaFaktura({ f, klient, polozky, zaklad, dph, celkem, qr }) {
  const adresa = esc(klient.address ?? '').replace(/, (\d{3} ?\d{2})/, '<br>$1')
  return `<div class="page">
  ${hlavicka()}
  <div class="inv-head">
    <div><div class="eyebrow">${D.platce ? 'Faktura, daňový doklad' : 'Vydaná faktura'}</div><h1>Faktura <em>č. ${esc(f.cislo)}</em></h1></div>
    <div class="inv-no"><div class="k">K úhradě</div><div class="v">${kc(celkem)} Kč</div></div>
  </div>

  <div class="grid2" style="margin-top:4mm">
    <div class="card white party">
      <div class="k">Dodavatel</div>
      <div class="n">${esc(D.nazev)}</div>
      <p>${esc(D.ulice)}<br>${esc(D.mesto)}</p>
      <p class="ids">IČ ${esc(D.ico)}${D.dic ? ` · DIČ ${esc(D.dic)}` : ''}<br>${D.platce ? 'Plátce DPH' : 'Není plátce DPH'}<br>
        Telefon ${esc(D.telefon)}<br>E-mail ${esc(D.email)}</p>
    </div>
    <div class="card white party buyer">
      <div class="k">Odběratel</div>
      <div class="n">${esc(klient.name)}</div>
      <p>${adresa}</p>
      <p class="ids">IČ ${esc(klient.ico)}${klient.dic ? ` · DIČ ${esc(klient.dic)}` : ''}</p>
    </div>
  </div>

  <div class="facts" style="margin-top:4mm">
    <div class="fact"><div class="l">Datum vystavení</div><div class="v">${den(f.vystaveni)}</div></div>
    <div class="fact"><div class="l">Datum plnění</div><div class="v">${den(f.plneni)}</div></div>
    <div class="fact hl"><div class="l">Datum splatnosti</div><div class="v">${den(f.splatnost)}</div></div>
    <div class="fact"><div class="l">Variabilní symbol</div><div class="v">${esc(f.cislo)}</div></div>
    <div class="fact"><div class="l">Forma úhrady</div><div class="v">Příkazem</div></div>
  </div>

  <div class="sec-num" style="margin-top:6mm">01</div>
  <h2>Předmět <em>fakturace</em></h2>
  <table class="price items">
    ${D.platce
      ? `<tr><th>Označení dodávky</th><th class="r">Základ</th><th class="r">DPH ${D.sazba_dph} %</th><th class="r">Kč celkem</th></tr>
    ${polozky.map((p) => `<tr><td>${esc(p.nazev)}<span class="sub">${esc(p.popis ?? '')}</span></td>
      <td class="r">${kc(p.cena)}</td><td class="r">${kc(Math.round(p.cena * D.sazba_dph) / 100)}</td>
      <td class="r amt">${kc(Math.round(p.cena * (100 + D.sazba_dph)) / 100)}</td></tr>`).join('')}
    <tr class="tot"><td>Celkem k úhradě</td><td class="r">${kc(zaklad)}</td><td class="r">${kc(dph)}</td><td class="r">${kc(celkem)} Kč</td></tr>`
      : `<tr><th>Označení dodávky</th><th class="r">Kč celkem</th></tr>
    ${polozky.map((p) => `<tr><td>${esc(p.nazev)}<span class="sub">${esc(p.popis ?? '')}</span></td>
      <td class="r amt">${kc(p.cena)}</td></tr>`).join('')}
    <tr class="tot"><td>Celkem k úhradě</td><td class="r">${kc(celkem)} Kč</td></tr>`}
  </table>

  <div class="sec-num" style="margin-top:6mm">02</div>
  <h2>Platební <em>údaje</em></h2>
  <div class="pay">
    <div class="card white"><div class="paydata">
      <div class="l">Číslo účtu</div><div class="v">${esc(D.ucet)}</div>
      <div class="l">Banka</div><div class="v">${esc(D.banka)}</div>
      <div class="l">IBAN</div><div class="v">${esc(D.iban.replace(/(.{4})/g, '$1 ').trim())}</div>
      <div class="l">SWIFT</div><div class="v">${esc(D.swift)}</div>
      <div class="l">Variabilní symbol</div><div class="v">${esc(f.cislo)}</div>
      <div class="l">Konstantní symbol</div><div class="v">${esc(D.konstantni_symbol)}</div>
      <div class="l">Částka</div><div class="v">${kc(celkem)} Kč</div>
      <div class="l">Splatnost</div><div class="v">${den(f.splatnost)}</div>
    </div></div>
    <div class="qr">${qr ? `<img src="${qr}">` : ''}<div class="l">QR platba</div></div>
  </div>

  <div class="dark" style="margin-top:4mm">
    <h3>Děkuji za <em>úhradu.</em></h3>
    <p>${esc(D.veta)} Přehled zpracovaných podkladů za fakturované období je na další straně.</p>
    <div class="fine">V případě nedodržení data splatnosti uvedeného na faktuře si dovolujeme účtovat úrok z prodlení v dohodnuté, resp. zákonné výši a smluvní pokutu, byla-li sjednána.</div>
  </div>
  <footer><span>Kliments. · ${esc(D.paticka)} · kliments.cz</span><span>Faktura ${esc(f.cislo)} · 1 / 2</span></footer>
</div>`
}

function stranaPrehled({ f, klient, mesic, v, doklady, pohyby, polozky, zaklad, dph, celkem, zamestnanci, pasmo, smluvni, rozpad, jednotka = 'podkladů' }) {
  const m = new Date(mesic)
  const mesicSlovem = `${MESICE[m.getUTCMonth()]} ${m.getUTCFullYear()}`
  const nazevKratky = esc(klient.name.replace(/,?\s*(s\.\s?r\.\s?o\.|a\.\s?s\.|spol\. s r\. o\.)\s*$/i, ''))
  const castka = (d) => Number(d.amount_czk ?? (d.currency === 'CZK' || !d.currency ? d.amount_total : 0) ?? 0)
  const skup = {}
  for (const d of doklady) {
    skup[d.kind] ??= { n: 0, suma: 0 }
    skup[d.kind].n += 1
    skup[d.kind].suma += castka(d)
  }
  const prijmy = pohyby.filter((t) => Number(t.amount) > 0)
  const vydaje = pohyby.filter((t) => Number(t.amount) < 0)
  const sum = (a) => a.reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  const dodavatelu = new Set(doklady.filter((d) => d.kind === 'received_invoice').map((d) => d.counterparty_name)).size
  const odberatelu = new Set(doklady.filter((d) => d.kind === 'issued_invoice').map((d) => d.counterparty_name)).size
  const poradi = ['received_invoice', 'issued_invoice', 'receipt', 'credit_note', 'advance_invoice', 'payroll', 'internal', 'bank_statement', 'other']
  const druhy = Object.keys(skup).sort((a, b) => poradi.indexOf(a) - poradi.indexOf(b))
  const radkyDoklady = druhy.map((k) => `<li>${skup[k].n} ${druhN(k, skup[k].n)}${['received_invoice', 'issued_invoice', 'receipt', 'credit_note'].includes(k) && skup[k].suma ? ` za ${kc0(skup[k].suma)} Kč` : ''}</li>`).join('')
  const stat4 = zamestnanci.length
    ? `<div class="stat"><div class="v">${zamestnanci.reduce((s, z) => s + z.pocet, 0)}</div><div class="l">Zaměstnanci</div></div>`
    : `<div class="stat"><div class="v">${dodavatelu + odberatelu}</div><div class="l">Obchodní partneři</div></div>`
  const tretiKarta = zamestnanci.length
    ? `<div class="card"><div class="num">03</div><div class="t">Mzdová agenda</div><ul class="dash">
        ${zamestnanci.map((z) => `<li>mzda ${z.pocet} ${z.pocet === 1 ? 'zaměstnance' : 'zaměstnanců'} ${z.text}</li>`).join('')}
        <li>výpočet mzdy, daně a pojistného</li><li>podklady k výplatě</li></ul></div>`
    : `<div class="card"><div class="num">03</div><div class="t">Kontrola a archiv</div><ul class="dash">
        <li>kontrola úplnosti a správnosti podkladů</li><li>doklady uložené v portálu Kliments</li><li>upozornění na chybějící doklady</li></ul></div>`
  return `<div class="page prehled">
  ${hlavicka()}
  <div class="eyebrow">Přehled zpracování</div>
  <h1>Účetnictví ${nazevKratky} <em>${esc(mesicSlovem)}</em></h1>
  <p class="lead">Co se v účetnictví za ${esc(mesicSlovem)} zpracovalo a z čeho vychází fakturovaná cena.</p>
  <div class="chips">
    <div class="chip">Pro <b>${esc(klient.name)}</b></div>
    <div class="chip">IČO <b>${esc(klient.ico)}</b></div>
    <div class="chip">Faktura <b>č. ${esc(f.cislo)}</b></div>
    <div class="chip">Zpracováno <b>${den(f.vystaveni)}</b></div>
  </div>

  <div class="sec-num" style="margin-top:4mm">01</div>
  <h2>Rozsah <em>v číslech</em></h2>
  <div class="grid4">
    ${rozpad
      ? `<div class="stat"><div class="v">${v.jednotek}</div><div class="l">Pohyby podle smlouvy</div></div>
    <div class="stat"><div class="v">${pohyby.length}</div><div class="l">Řádky výpisu</div></div>
    <div class="stat"><div class="v">${rozpad.objednavek}</div><div class="l">Platby přes GoPay</div></div>`
      : `<div class="stat"><div class="v">${doklady.length + pohyby.length}</div><div class="l">Účetní podklady</div></div>
    <div class="stat"><div class="v">${doklady.length}</div><div class="l">Doklady</div></div>
    <div class="stat"><div class="v">${pohyby.length}</div><div class="l">Bankovní pohyby</div></div>`}
    ${stat4}
  </div>

  <div class="sec-num" style="margin-top:4mm">02</div>
  <h2>Co práce <em>zahrnuje</em></h2>
  <div class="grid3">
    <div class="card"><div class="num">01</div><div class="t">Zaúčtování dokladů</div><ul class="dash">${radkyDoklady}</ul></div>
    <div class="card"><div class="num">02</div><div class="t">Banka</div><ul class="dash">
      <li>${pohyby.length} ${tvar(pohyby.length, ['bankovní pohyb', 'bankovní pohyby', 'bankovních pohybů'])}</li>
      ${rozpad ? `<li>${rozpad.vyplat} výplaty GoPay za ${kc0(rozpad.vyplatCastka)} Kč, rozpad na ${rozpad.objednavek} plateb</li>` : ''}
      <li>příjmy ${kc0(sum(prijmy))} Kč (${prijmy.length})</li>
      <li>výdaje ${kc0(sum(vydaje))} Kč (${vydaje.length})</li>
      ${rozpad ? '' : '<li>párování plateb s doklady</li>'}</ul></div>
    ${tretiKarta}
  </div>

  <div class="sec-num" style="margin-top:4mm">03</div>
  <h2>Doklady <em>podle druhu</em></h2>
  <table class="price compact">
    <tr><th>Druh podkladu</th><th class="r">Počet</th><th class="r">Hodnota Kč</th></tr>
    ${druhy.map((k) => `<tr><td>${esc(velke(DRUH[k]?.[1] ?? k))}</td><td class="r">${skup[k].n}</td><td class="r">${['bank_statement', 'other'].includes(k) ? '' : kc0(skup[k].suma)}</td></tr>`).join('')}
    <tr><td>Bankovní pohyby</td><td class="r">${pohyby.length}</td><td class="r"></td></tr>
    ${jednotka === 'pohybů' ? '' : `<tr class="tot"><td>Účetní podklady celkem</td><td class="r">${doklady.length + pohyby.length}</td><td></td></tr>`}
  </table>

  <div class="sec-num" style="margin-top:4mm">04</div>
  <h2>Cena <em>podle smlouvy</em></h2>
  <p class="smluvni">${esc(smluvni)}</p>
  <div class="pricebox">
    <table class="price compact">
      <tr><th>Položka</th><th class="r">Množství</th><th class="r">Sazba</th><th class="r">Cena</th></tr>
      <tr><td>Vedení účetnictví</td>
        <td class="r">${v.jednotek} ${jednotka}</td><td class="r">${esc(pasmo)}</td><td class="r amt">${kc0(polozky[0].cena)} Kč</td></tr>
      ${polozky.slice(1).map((p) => `<tr><td>${esc(p.nazev.replace(/ \d+\/\d{4}$/, ''))}<span class="sub">${esc(p.kratky ?? p.popis ?? '')}</span></td>
        <td class="r">${p.pocet} ×</td><td class="r">${kc0(p.sazba)} Kč</td><td class="r amt">${kc0(p.cena)} Kč</td></tr>`).join('')}
      ${D.platce ? `<tr><td>Základ daně</td><td></td><td></td><td class="r">${kc0(zaklad)} Kč</td></tr>
      <tr><td>DPH ${D.sazba_dph} %</td><td></td><td></td><td class="r">${kc(dph)} Kč</td></tr>
      <tr class="tot"><td>Celkem s DPH</td><td></td><td></td><td class="r">${kc(celkem)} Kč</td></tr>`
      : `<tr class="tot"><td>Celkem</td><td></td><td></td><td class="r">${kc(celkem)} Kč</td></tr>`}
    </table>
    <div class="total">
      <div class="badge">CELKEM</div>
      <div class="k">Účetnictví</div>
      <div class="t">${esc(klient.name)}<br>${esc(mesicSlovem)}</div>
      <div class="p">${kc0(celkem)} Kč</div>
      <div class="s">${D.platce ? 'včetně DPH' : 'konečná cena, dodavatel není plátce DPH'}, splatnost ${den(f.splatnost)}</div>
    </div>
  </div>

  <div class="dark slim" style="margin-top:4mm">
    <div><h3>Děkuji za <em>spolupráci.</em></h3>
    <div class="fine">Příloha k faktuře č. ${esc(f.cislo)}. Počet podkladů vychází z dokladů a bankovních pohybů evidovaných za ${esc(mesicSlovem)}.</div></div>
    <div class="who">Josef Kliment<span>·</span>kliment.josef@email.cz</div>
  </div>
  <footer><span>Kliments. · ${esc(D.paticka)} · kliments.cz</span><span>Faktura ${esc(f.cislo)} · 2 / 2</span></footer>
</div>`
}

function html(d) {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<title>Faktura ${esc(d.f.cislo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS}
  .inv-head { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1.5mm; }
  .inv-no { text-align: right; }
  .inv-no .k { font-size: 6.6pt; letter-spacing: 1.6px; text-transform: uppercase; color: var(--muted); }
  .inv-no .v { font-family: 'Lora', serif; font-size: 16pt; }
  .party .k { font-size: 6.6pt; letter-spacing: 1.6px; text-transform: uppercase; color: var(--rose-deep); }
  .party .n { font-family: 'Lora', serif; font-size: 13pt; margin: 0.8mm 0 1.2mm; }
  .party p { font-size: 8.4pt; line-height: 1.55; color: var(--ink-soft); }
  .party .ids { margin-top: 1.6mm; padding-top: 1.6mm; border-top: 1px solid var(--line); }
  .party.buyer { border: 1.5px solid var(--rose); }
  .facts { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; }
  .fact { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 2.4mm 3mm; }
  .fact .l { font-size: 6pt; letter-spacing: 0.7px; white-space: nowrap; text-transform: uppercase; color: var(--muted); }
  .fact .v { font-family: 'Lora', serif; font-size: 12pt; margin-top: 0.6mm; white-space: nowrap; }
  .fact.hl { border-color: var(--rose); }
  .fact.hl .v { color: var(--rose-deep); }
  table.items td { font-size: 9pt; padding: 3mm; }
  table.items tr.tot td { font-size: 9.4pt; }
  table.price.compact td { padding: 1.05mm 3mm; }
  table.price.compact th { padding: 1.8mm 3mm 1.2mm; }
  table.items td { padding: 2.4mm 3mm; }
  .party p { font-size: 8pt; }
  .page h1 { font-size: 21pt; }
  .stat .v { font-size: 16pt; }
  .smluvni { font-size: 7.9pt; color: var(--ink-soft); margin: -0.6mm 0 2mm; line-height: 1.45; }
  .prehled .sec-num { margin-top: 2.6mm !important; }
  .prehled h2 { font-size: 13pt; margin-bottom: 1.4mm; }
  .prehled .lead { margin-top: 1.6mm; }
  .prehled .chips { margin-top: 2.4mm; }
  .prehled .stat { padding: 1.7mm 3.5mm; }
  .prehled .card { padding: 2.4mm 3.2mm; }
  .prehled table.price.compact td { padding: 0.75mm 3mm; }
  .prehled .total { padding: 3mm 4mm; }
  .prehled .total .p { font-size: 22pt; }
  .prehled .dark.slim { margin-top: 3mm !important; }  .recap { font-size: 7pt; color: var(--muted); margin-top: 1.4mm; }
  .pay { display: grid; grid-template-columns: 1fr 44mm; gap: 3.5mm; align-items: stretch; }
  .paydata { display: grid; grid-template-columns: 30mm 1fr; row-gap: 1.3mm; font-size: 8.4pt; }
  .paydata .l { color: var(--muted); }
  .paydata .v { font-weight: 500; }
  .qr { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 3mm;
        display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .qr img { width: 34mm; height: 34mm; }
  .qr .l { font-size: 6.4pt; letter-spacing: 1.4px; text-transform: uppercase; color: var(--rose-deep); margin-top: 1.2mm; }
  .dark.slim { padding: 3mm 6mm; display: flex; justify-content: space-between; align-items: center; gap: 6mm; }
  .dark.slim .fine { margin-top: 0.8mm; }
  .dark.slim .who { margin-top: 0; white-space: nowrap; }
  /* víc položek (příplatky, vlastní položky): hustší řádky, ať se obě strany vejdou */
  .husta table.items td { padding: 1.3mm 3mm; }
  .husta .page .sec-num { margin-top: 3.4mm !important; }
  .husta .prehled .sec-num { margin-top: 1.6mm !important; }
  .husta .prehled .card { padding: 1.8mm 3mm; }
  .husta .prehled table.price td { padding: 0.9mm 3mm; }
  .husta .prehled .total .p { font-size: 18pt; }
  .husta .prehled .stat { padding: 1.2mm 3.5mm; }
  .husta .paydata { row-gap: 0.7mm; }
  .husta .qr img { width: 28mm; height: 28mm; }
  .husta .party p { line-height: 1.4; }
  .husta .grid2 { margin-top: 3mm !important; }
  .husta .facts { margin-top: 3mm !important; }
  .husta .prehled ul.dash li { margin-bottom: 0.4mm; }
  .husta .prehled .stat .v { font-size: 13pt; }
  .husta .prehled table.price th { padding: 1mm 3mm; }
</style></head><body${d.polozky.length > 2 ? ' class="husta"' : ''}>
${stranaFaktura(d)}
${stranaPrehled(d)}
</body></html>`
}


async function qrKod(castka, vs) {
  try {
    const { toDataURL } = require('qrcode')
    const spd = `SPD*1.0*ACC:${D.iban}*AM:${castka.toFixed(2)}*CC:CZK*X-VS:${vs}*X-KS:${D.konstantni_symbol}*MSG:FAKTURA ${vs}`
    return await toDataURL(spd, { margin: 0, width: 300 })
  } catch {
    return null // bez QR kódu, když knihovna chybí
  }
}

export async function vystavFakturu({ ico, mesic, cislo, nahled = false, vystaveni, splatnost, dpp = 0, hpp = 0, dodavatel = 'firsen', odhad = null, extra = [] }) {
  D = DODAVATELE[dodavatel]
  if (!D) throw new Error(`neznámý dodavatel ${dodavatel}, možnosti: ${Object.keys(DODAVATELE).join(', ')}`)
  const { data: k } = await db.from('clients').select('*').eq('ico', ico).single()
  if (!k?.pricing) throw new Error(`${ico}: klient nemá ceník`)
  const { data: v } = await db.rpc('kl_vyuctovani', { p_client: k.id, p_mesic: mesic })
  if (!v) throw new Error(`${ico}: nelze spočítat vyúčtování`)
  if (v.cena == null) throw new Error(`${k.name}: ${v.jednotek} podkladů, ${v.poznamka}`)

  const rok = Number(mesic.slice(0, 4))
  const pricteDny = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
  const plneni = new Date(Date.UTC(new Date(mesic).getFullYear(), new Date(mesic).getMonth() + 1, 0)).toISOString().slice(0, 10)
  const f = {
    cislo: cislo ?? (await dalsiCislo(rok)),
    vystaveni: vystaveni ?? v.vystavit,
    splatnost: splatnost ?? (vystaveni ? pricteDny(vystaveni, Number(k.pricing.splatnost_dni ?? 7)) : v.splatnost),
    plneni,
  }
  const obdobi = new Date(mesic).toLocaleDateString('cs-CZ', { month: 'numeric', year: 'numeric' })
  const polozky = [{
    nazev: `Vedení účetnictví ${obdobi}`,
    popis: k.pricing.model === 'pausal'
      ? `${v.zaklad_nazev}${k.vat_payer ? ', včetně příplatku za plátcovství DPH' : ''}`
      : `${v.zaklad_nazev}: ${v.jednotek} (doklady ${v.podklady.dokladu}, bankovní pohyby ${v.podklady.pohybu})`,
    cena: Number(v.cena),
  }]
  const pri = k.pricing.priplatky ?? {}
  const zamestnanci = []
  for (const [druh, pocet, sazba, text] of [['DPP', dpp, pri.dpp, 'dohoda o provedení práce'], ['HPP', hpp, pri.hpp, 'pracovní poměr']]) {
    if (!pocet) continue
    if (sazba == null) throw new Error(`${k.name}: ceník nemá příplatek za ${druh}`)
    polozky.push({ nazev: `Mzdová agenda ${obdobi}`, popis: `zaměstnanec, ${text}`, cena: Number(sazba) * pocet, pocet, sazba: Number(sazba) })
    zamestnanci.push({ pocet, text: druh === 'DPP' ? 'na dohodu o provedení práce' : 'v pracovním poměru' })
  }

  const nacteno = await podkladyMesice(k.id, mesic)
  // faktura se nepočítá sama do sebe (při opakovaném vystavení už je mezi doklady klienta)
  const vlastni = (d) => d.counterparty_ico === D.ico && d.doc_number === f.cislo
  const doklady = nacteno.doklady.filter((d) => !vlastni(d))
  const pohyby = nacteno.pohyby
  const bezSebe = nacteno.doklady.length - doklady.length
  if (bezSebe) {
    v.jednotek = Number(v.jednotek) - bezSebe
    v.podklady = { ...v.podklady, dokladu: Number(v.podklady.dokladu) - bezSebe }
    if (k.pricing.model !== 'pausal') {
      const p = (k.pricing.pasma ?? []).map((x) => ({ do: Number(x.do), cena: Number(x.cena) })).sort((x, y) => x.do - y.do).find((x) => v.jednotek <= x.do)
      if (!p) throw new Error(`${k.name}: ${v.jednotek} podkladů je nad rámec ceníku`)
      v.cena = p.cena
      polozky[0].cena = p.cena
      polozky[0].popis = `${v.zaklad_nazev}: ${v.jednotek} (doklady ${v.podklady.dokladu}, bankovní pohyby ${v.podklady.pohybu})`
    }
  }
  const skutecne = Number(v.jednotek)
  if (odhad != null) {
    const p = (k.pricing.pasma ?? []).map((x) => ({ do: Number(x.do), cena: Number(x.cena) })).sort((x, y) => x.do - y.do).find((x) => odhad <= x.do)
    if (!p) throw new Error(`${k.name}: odhad ${odhad} podkladů je nad rámec ceníku`)
    v.jednotek = odhad
    v.cena = p.cena
    polozky[0].cena = p.cena
  }
  if (odhad == null && doklady.length + pohyby.length !== Number(v.jednotek) && !String(v.zaklad_nazev).match(/bankovních pohybů/i)) {
    throw new Error(`${k.name}: přehled (${doklady.length + pohyby.length}) nesedí na vyúčtování (${v.jednotek})`)
  }
  // Výplata z platební brány se podle dohody s klientem počítá po jednotlivých
  // objednávkách zaplacených kartou (v účetnictví se likviduje každá zvlášť).
  let rozpad = null
  if (k.pricing.gopay_rozpad) {
    const vyplaty = pohyby.filter((t) => Number(t.amount) > 0 && /gopay|vyuctovani/i.test(`${t.counterparty_name ?? ''} ${t.message ?? ''}`))
    const objednavky = doklady.filter((d) => d.kind === 'issued_invoice' && /online platba|google pay|apple pay|kart/i.test(d.description ?? ''))
    rozpad = {
      vyplat: vyplaty.length, vyplatCastka: vyplaty.reduce((s, t) => s + Number(t.amount), 0),
      objednavek: objednavky.length, objednavekCastka: objednavky.reduce((s, d) => s + Number(d.amount_total ?? 0), 0),
      ostatnich: pohyby.length - vyplaty.length,
    }
    v.jednotek = rozpad.ostatnich + rozpad.objednavek
    const p = (k.pricing.pasma ?? []).map((x) => ({ do: Number(x.do), cena: Number(x.cena) })).sort((x, y) => x.do - y.do).find((x) => v.jednotek <= x.do)
    if (!p) throw new Error(`${k.name}: ${v.jednotek} pohybů je nad rámec ceníku`)
    v.cena = p.cena
    polozky[0].cena = p.cena
  }
  const jednotka = /bankovních pohybů/i.test(v.zaklad_nazev ?? '') ? 'pohybů' : 'podkladů'
  const pasma =(k.pricing.pasma ?? []).map((x) => Number(x.do)).sort((x, y) => x - y)
  const horni = pasma.find((x) => Number(v.jednotek) <= x)
  const dolni = horni != null ? (pasma[pasma.indexOf(horni) - 1] ?? -1) + 1 : null
  const pasmo = k.pricing.model === 'pausal' ? 'paušál' : horni != null ? `pásmo ${dolni} až ${horni}` : 'dohodou'

  // odvolání na smlouvu: do kterého pásma paušálu rozsah spadá
  const smlouva = k.pricing.smlouva_clanek ? `čl. ${k.pricing.smlouva_clanek} Smlouvy o vedení účetnictví` : 'Smlouvy o vedení účetnictví'
  const mesicText = `${MESICE[new Date(mesic).getUTCMonth()]} ${new Date(mesic).getUTCFullYear()}`
  let smluvni
  if (k.pricing.model === 'pausal') {
    smluvni = `Podle ${smlouva} se účtuje pevný měsíční paušál ${kc0(polozky[0].cena)} Kč${D.platce ? ' bez DPH' : ''}.`
  } else {
    polozky[0].popis = `měsíční paušál podle ${smlouva}: ${odhad != null ? 'přibližně ' : ''}${v.jednotek} ${jednotka}, ${pasmo}`
    if (jednotka === 'pohybů') {
      smluvni = `Podle ${smlouva} se paušál odvíjí od počtu bankovních pohybů v měsíci, tedy každé jednotlivé transakce na bankovním účtu. `
        + (rozpad ? `Výplaty z GoPay se podle dohody počítají po jednotlivých objednávkách. Za ${mesicText} jde o ${rozpad.ostatnich} bankovních pohybů a ${rozpad.objednavek} plateb přes GoPay, celkem ${v.jednotek} pohybů. ` : `Za ${mesicText} bylo na účtu ${v.jednotek} pohybů. `)
        + `To je pásmo ${dolni} až ${horni} pohybů s paušálem ${kc0(polozky[0].cena)} Kč${D.platce ? ' bez DPH' : ''}.`
    } else {
      smluvni = `Podle ${smlouva} se výše měsíčního paušálu odvíjí od počtu zpracovaných účetních podkladů v kalendářním měsíci. `
        + (odhad != null
          ? `Za ${mesicText} je na účtu ${pohyby.length} bankovních pohybů a k nim odpovídající doklady a podklady ke mzdám, předpokládaný rozsah je přibližně ${odhad} podkladů (k datu vystavení zpracováno ${skutecne}). Rozsah spadá do pásma ${dolni} až ${horni} podkladů s měsíčním paušálem ${kc0(polozky[0].cena)} Kč${D.platce ? ' bez DPH' : ''}.`
          : `Za ${mesicText} bylo zpracováno ${v.jednotek} podkladů, rozsah tedy spadá do pásma ${dolni} až ${horni} podkladů s měsíčním paušálem ${kc0(polozky[0].cena)} Kč${D.platce ? ' bez DPH' : ''}.`)
    }
  }
  for (const p of polozky.slice(1)) {
    p.kratky = p.popis
    p.popis = `${p.pocet} × ${p.popis.replace(/^zaměstnanec, /, '')}, ${kc0(p.sazba)} Kč za osobu podle ${smlouva}`
    smluvni += ` Mzdy (${p.kratky.replace(/^zaměstnanec, /, '')}) se účtují ${kc0(p.sazba)} Kč za osobu a měsíc.`
  }
  for (const e of extra) {
    const [nazev, popis, cena] = e.split('|').map((x) => x.trim())
    if (!nazev || !(Number(cena) > 0)) throw new Error(`--polozka "${e}": čekám "název|popis|cena"`)
    polozky.push({ nazev, popis, kratky: popis, cena: Number(cena), pocet: 1, sazba: Number(cena) })
  }
  const zaklad = polozky.reduce((s, p) => s + p.cena, 0)
  const dph = Math.round(zaklad * D.sazba_dph) / 100
  const celkem = zaklad + dph
  const qr = await qrKod(celkem, f.cislo)

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kliments-faktura-'))
  const htmlPath = path.join(dir, 'faktura.html')
  const pdfPath = path.join(dir, `${f.cislo}.pdf`)
  await fs.promises.writeFile(htmlPath, html({ f, klient: k, mesic, v, doklady, pohyby, polozky, zaklad, dph, celkem, qr, zamestnanci, pasmo, smluvni, rozpad, jednotka }), 'utf8')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }

  if (nahled) return { ...f, klient: k.name, zaklad, dph, celkem, jednotek: v.jednotek, pdf: pdfPath }

  const cesta = `${D === FIRSEN ? 'firsen' : 'kliment'}/faktury/${rok}/${f.cislo}-${slug(k.name)}.pdf`
  const { error: se } = await db.storage.from('documents').upload(cesta, await fs.promises.readFile(pdfPath), { contentType: 'application/pdf', upsert: true })
  if (se) throw new Error(`úložiště: ${se.message}`)

  // doklad pro klienta: přijatá faktura od firsen
  // opakované vystavení téhož čísla přepíše existující doklad, nezakládá nový
  const { data: puvodni } = await db.from('documents').select('id')
    .eq('client_id', k.id).eq('counterparty_ico', D.ico).eq('doc_number', f.cislo).limit(1)
  const zaznam = {
    ...(puvodni?.[0] ? { id: puvodni[0].id } : {}),
    client_id: k.id, kind: 'received_invoice', source: 'generated', status: 'reviewed',
    storage_path: cesta, file_name: `${f.cislo}.pdf`, mime_type: 'application/pdf',
    counterparty_name: D.nazev, counterparty_ico: D.ico, counterparty_dic: D.dic,
    customer_ico: k.ico, doc_number: f.cislo, var_symbol: f.cislo,
    issue_date: f.vystaveni, taxable_date: f.plneni, due_date: f.splatnost,
    currency: 'CZK', amount_total: celkem, amount_vat: dph, amount_czk: celkem,
    vat_breakdown: D.platce ? [{ sazba: D.sazba_dph, zaklad, dph }] : null, vat_regime: D.platce ? 'tuzemsko' : 'neplatce',
    items: polozky.map((p) => ({ nazev: p.nazev, mnozstvi: 1, mj: 'měsíc', cena_bez_dph: p.cena, sazba_dph: D.sazba_dph, cena_s_dph: Math.round(p.cena * (100 + D.sazba_dph)) / 100 })),
    suggested_account: '518', suggested_vat_class: k.vat_payer ? 'UD' : 'UN',
    supplier_bank_account: D.ucet,
    description: polozky[0].popis, extraction_method: 'generated',
    note: `Faktura za vedení účetnictví vystavená kanceláří Kliments (${D.nazev})`,
  }
  const { data: doklad, error: de } = await db.from('documents').upsert(zaznam, { onConflict: 'id' }).select('id').single()
  if (de) throw new Error(`doklad: ${de.message}`)

  const { error: be } = await db.from('billing_runs').upsert({
    client_id: k.id, period: mesic, basis: v.zaklad_nazev, units: v.jednotek, amount: celkem,
    detail: { cislo: f.cislo, zaklad, dph, podklady: v.podklady, polozky, cesta },
    invoice_document_id: doklad.id, status: 'issued',
  }, { onConflict: 'client_id,period' })
  if (be) throw new Error(`vyúčtování: ${be.message}`)

  return { ...f, klient: k.name, zaklad, dph, celkem, jednotek: v.jednotek, cesta }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const mesic = `${arg('--mesic')}-01`
  const ica = arg('--ico') ? [arg('--ico')] : (await db.from('clients').select('ico').not('pricing', 'is', null)).data.map((c) => c.ico)
  for (const ico of ica) {
    try {
      const f = await vystavFakturu({
        ico, mesic, cislo: arg('--cislo'), nahled: NAHLED, vystaveni: arg('--vystaveni'), splatnost: arg('--splatnost'),
        dodavatel: arg('--dodavatel') ?? 'firsen',
        dpp: Number(arg('--dpp') ?? 0), hpp: Number(arg('--hpp') ?? 0),
        odhad: arg('--odhad') != null ? Number(arg('--odhad')) : null,
        extra: args.flatMap((a, i) => (a === '--polozka' ? [args[i + 1]] : [])),
      })
      console.log(`${f.klient}: faktura ${f.cislo}, ${f.jednotek} podkladů, ${kc(f.celkem)} Kč s DPH, splatnost ${den(f.splatnost)}${f.pdf ? ` (náhled: ${f.pdf})` : ''}`)
    } catch (e) {
      console.error(`${ico}: ${e.message}`)
    }
  }
}
