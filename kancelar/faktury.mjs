// Faktury firsen s.r.o. za vedení účetnictví: spočítá cenu podle ceníku klienta,
// vygeneruje PDF, uloží ho do úložiště, zapíše vyúčtování a založí doklad klientovi
// (ten ho pak vidí v portálu jako přijatou fakturu).
//
//   node faktury.mjs --mesic 2026-08 [--ico 24052477] [--cislo 2026080] [--nahled]
//                    [--vystaveni 2026-10-01] [--dpp 1] [--hpp 0]
//
// Faktura se vystavuje 10. dne následujícího měsíce se splatností podle smlouvy,
// --vystaveni ji vystaví k jinému dni. --dpp/--hpp přidá příplatek za zaměstnance
// podle ceníku. Za fakturou následuje přehled zpracovaných podkladů za měsíc
// (stejný výběr jako kl_podklady_mesic, takže počty sedí na fakturovaný rozsah).
import './lib/env.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { FIRSEN } from './lib/firsen.mjs'

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
    .eq('counterparty_ico', FIRSEN.ico).like('doc_number', `${rok}%`).order('doc_number', { ascending: false }).limit(1)
  const posledni = d?.[0]?.doc_number
  if (posledni && /^\d{7}$/.test(posledni)) return String(Number(posledni) + 1)
  throw new Error(`Neznám poslední číslo faktury pro rok ${rok}, zadej --cislo`)
}

const DRUH = {
  received_invoice: 'Přijatá faktura', issued_invoice: 'Vydaná faktura', receipt: 'Účtenka',
  bank_statement: 'Bankovní výpis', credit_note: 'Dobropis', advance_invoice: 'Zálohová faktura',
  payroll: 'Mzdový doklad', internal: 'Interní doklad', other: 'Ostatní doklad',
}

// Stejný výběr jako kl_podklady_mesic (0016_vyuctovani.sql)
async function podkladyMesice(clientId, mesic) {
  const od = mesic
  const doo = new Date(Date.UTC(new Date(mesic).getUTCFullYear(), new Date(mesic).getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  const docs = []
  for (let od2 = 0; ; od2 += 1000) {
    const { data, error: e1 } = await db.from('documents')
      .select('kind, status, counterparty_name, doc_number, taxable_date, issue_date, received_at, amount_czk, amount_total, currency')
      .eq('client_id', clientId).neq('kind', 'contract').not('status', 'in', '(duplicate,rejected)')
      .order('id').range(od2, od2 + 999)
    if (e1) throw new Error(`doklady: ${e1.message}`)
    docs.push(...data)
    if (data.length < 1000) break
  }
  const doklady = docs
    .map((d) => ({ ...d, datum: String(d.taxable_date ?? d.issue_date ?? d.received_at ?? '').slice(0, 10) }))
    .filter((d) => d.datum >= od && d.datum < doo)
    .sort((a, b) => a.datum.localeCompare(b.datum) || String(a.kind).localeCompare(String(b.kind)))
  const { data: pohyby, error: e2 } = await db.from('bank_transactions')
    .select('booked_on, amount, counterparty_name, var_symbol, message')
    .eq('client_id', clientId).gte('booked_on', od).lt('booked_on', doo).order('booked_on')
  if (e2) throw new Error(`pohyby: ${e2.message}`)
  return { doklady, pohyby }
}

function prehled({ obdobi, doklady, pohyby, zamestnanci }) {
  const souhrn = {}
  for (const d of doklady) souhrn[d.kind] = (souhrn[d.kind] ?? 0) + 1
  const radkySouhrnu = Object.entries(souhrn).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<tr><td>${esc(DRUH[k] ?? k)}</td><td class="cislice">${n}</td></tr>`).join('')
  const castka = (d) => d.amount_czk ?? (d.currency === 'CZK' || !d.currency ? d.amount_total : null)
  return `
  <div class="zlom"></div>
  <div class="hlava">
    <div><div class="znacka"><b>firsen</b> s.r.o.</div><div class="pozn">Příloha k faktuře</div></div>
    <div class="cislo">Přehled zpracovaných podkladů<br><b>${esc(obdobi)}</b></div>
  </div>
  <table class="souhrn levy">
    ${radkySouhrnu}
    <tr><td>Bankovní pohyby</td><td class="cislice">${pohyby.length}</td></tr>
    <tr class="celkem"><td>Účetní podklady celkem</td><td class="cislice">${doklady.length + pohyby.length}</td></tr>
  </table>
  ${zamestnanci.length ? `<p class="pozn">Mzdová agenda: ${esc(zamestnanci.join(', '))}.</p>` : ''}
  <h3>Doklady (${doklady.length})</h3>
  <table class="polozky male">
    <thead><tr><th>Datum</th><th>Druh</th><th>Protistrana</th><th>Číslo dokladu</th><th class="cislice">Částka Kč</th></tr></thead>
    <tbody>${doklady.map((d) => `<tr><td>${den(d.datum)}</td><td>${esc(DRUH[d.kind] ?? d.kind)}</td><td>${esc(d.counterparty_name ?? '')}</td><td>${esc(d.doc_number ?? '')}</td><td class="cislice">${castka(d) != null ? kc(Number(castka(d))) : esc(d.currency ?? '')}</td></tr>`).join('')}</tbody>
  </table>
  <h3>Bankovní pohyby (${pohyby.length})</h3>
  <table class="polozky male">
    <thead><tr><th>Datum</th><th>Protistrana</th><th>VS</th><th>Zpráva</th><th class="cislice">Částka Kč</th></tr></thead>
    <tbody>${pohyby.map((t) => `<tr><td>${den(t.booked_on)}</td><td>${esc(t.counterparty_name ?? '')}</td><td>${esc(t.var_symbol ?? '')}</td><td>${esc(String(t.message ?? '').slice(0, 60))}</td><td class="cislice">${kc(Number(t.amount))}</td></tr>`).join('')}</tbody>
  </table>`
}

function html({ f, klient, polozky, zaklad, dph, celkem, qr, priloha = '' }) {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f1a18; font-size: 10.5pt; margin: 0; }
  .hlava { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f1a18; padding-bottom: 10px; }
  .znacka { font-size: 20pt; font-weight: 300; letter-spacing: .01em; }
  .znacka b { font-weight: 600; }
  .tecka { color: #c97b84; }
  .cislo { text-align: right; font-size: 13pt; }
  .cislo b { font-size: 16pt; }
  .strany { display: flex; gap: 24px; margin-top: 18px; }
  .strana { flex: 1; }
  .popisek { font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: #8a807c; margin-bottom: 4px; }
  .nazev { font-weight: 600; font-size: 11.5pt; }
  table { width: 100%; border-collapse: collapse; }
  .udaje td { padding: 2px 0; font-size: 9.5pt; }
  .udaje td:first-child { color: #6b625e; padding-right: 12px; }
  .polozky { margin-top: 22px; }
  .polozky th { text-align: left; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: #8a807c; border-bottom: 1px solid #ddd6d2; padding: 6px 8px 6px 0; font-weight: 400; }
  .polozky td { padding: 8px 8px 8px 0; border-bottom: 1px solid #f0eae6; vertical-align: top; }
  .cislice { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .souhrn { margin-top: 14px; margin-left: auto; width: 62%; }
  .souhrn td { padding: 3px 0; font-size: 10pt; }
  .souhrn .celkem td { border-top: 2px solid #1f1a18; padding-top: 8px; font-size: 13pt; font-weight: 600; }
  .paticka { margin-top: 26px; display: flex; justify-content: space-between; gap: 20px; align-items: flex-end; }
  .pozn { font-size: 8pt; color: #6b625e; line-height: 1.45; }
  .qr { text-align: center; font-size: 7.5pt; color: #6b625e; }
  .qr img { width: 96px; height: 96px; }
  .zlom { page-break-before: always; }
  .souhrn.levy { margin-left: 0; width: 45%; margin-top: 18px; }
  h3 { font-size: 10pt; letter-spacing: .06em; text-transform: uppercase; color: #6b625e; margin: 22px 0 0; font-weight: 600; }
  .polozky.male { margin-top: 6px; }
  .polozky.male td { font-size: 8.5pt; padding: 4px 8px 4px 0; }
  .polozky.male th { font-size: 7pt; }
  </style></head><body>
  <div class="hlava">
    <div>
      <div class="znacka"><b>firsen</b> s.r.o.</div>
      <div class="pozn">${esc(FIRSEN.rejstrik)}</div>
    </div>
    <div class="cislo">Faktura, daňový doklad<br><b>č. ${esc(f.cislo)}</b></div>
  </div>

  <div class="strany">
    <div class="strana">
      <div class="popisek">Dodavatel</div>
      <div class="nazev">${esc(FIRSEN.nazev)}</div>
      <div>${esc(FIRSEN.ulice)}<br>${esc(FIRSEN.mesto)}</div>
      <table class="udaje"><tr><td>IČ</td><td>${esc(FIRSEN.ico)}</td></tr>
      <tr><td>DIČ</td><td>${esc(FIRSEN.dic)}</td></tr>
      <tr><td>Telefon</td><td>${esc(FIRSEN.telefon)}</td></tr>
      <tr><td>E-mail</td><td>${esc(FIRSEN.email)}</td></tr></table>
    </div>
    <div class="strana">
      <div class="popisek">Odběratel</div>
      <div class="nazev">${esc(klient.name)}</div>
      <div>${esc(klient.address ?? '')}</div>
      <table class="udaje"><tr><td>IČ</td><td>${esc(klient.ico)}</td></tr>
      ${klient.dic ? `<tr><td>DIČ</td><td>${esc(klient.dic)}</td></tr>` : ''}</table>
    </div>
    <div class="strana">
      <div class="popisek">Platební údaje</div>
      <table class="udaje">
        <tr><td>Číslo účtu</td><td><b>${esc(FIRSEN.ucet)}</b></td></tr>
        <tr><td>Variabilní symbol</td><td><b>${esc(f.cislo)}</b></td></tr>
        <tr><td>Konstantní symbol</td><td>${esc(FIRSEN.konstantni_symbol)}</td></tr>
        <tr><td>Forma úhrady</td><td>Převodem</td></tr>
        <tr><td>Datum vystavení</td><td>${den(f.vystaveni)}</td></tr>
        <tr><td>Datum plnění</td><td>${den(f.plneni)}</td></tr>
        <tr><td>Splatnost</td><td><b>${den(f.splatnost)}</b></td></tr>
      </table>
    </div>
  </div>

  <table class="polozky">
    <thead><tr><th style="width:52%">Označení dodávky</th><th class="cislice">Cena bez DPH</th><th class="cislice">DPH</th><th class="cislice">Celkem</th></tr></thead>
    <tbody>
      ${polozky.map((p) => `<tr>
        <td><b>${esc(p.nazev)}</b>${p.popis ? `<div class="pozn">${esc(p.popis)}</div>` : ''}</td>
        <td class="cislice">${kc(p.cena)}</td>
        <td class="cislice">${FIRSEN.sazba_dph} % · ${kc(p.cena * FIRSEN.sazba_dph / 100)}</td>
        <td class="cislice">${kc(p.cena * (1 + FIRSEN.sazba_dph / 100))}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <table class="souhrn">
    <tr><td>Základ daně</td><td class="cislice">${kc(zaklad)} Kč</td></tr>
    <tr><td>DPH ${FIRSEN.sazba_dph} %</td><td class="cislice">${kc(dph)} Kč</td></tr>
    <tr class="celkem"><td>Celkem k úhradě</td><td class="cislice">${kc(celkem)} Kč</td></tr>
  </table>

  <div class="paticka">
    <div class="pozn">
      Vystavil: ${esc(FIRSEN.vystavil)}<br>
      ${esc(FIRSEN.banka)} · IBAN ${esc(FIRSEN.iban)} · SWIFT ${esc(FIRSEN.swift)}<br>
      Při nedodržení splatnosti účtujeme úrok z prodlení v zákonné výši.
    </div>
    ${qr ? `<div class="qr"><img src="${qr}"><div>QR platba</div></div>` : ''}
  </div>
  ${priloha}
  </body></html>`
}

async function qrKod(castka, vs) {
  try {
    const { toDataURL } = require('qrcode')
    const spd = `SPD*1.0*ACC:${FIRSEN.iban}*AM:${castka.toFixed(2)}*CC:CZK*X-VS:${vs}*X-KS:${FIRSEN.konstantni_symbol}*MSG:FAKTURA ${vs}`
    return await toDataURL(spd, { margin: 0, width: 300 })
  } catch {
    return null // bez QR kódu, když knihovna chybí
  }
}

export async function vystavFakturu({ ico, mesic, cislo, nahled = false, vystaveni, dpp = 0, hpp = 0 }) {
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
    splatnost: vystaveni ? pricteDny(vystaveni, Number(k.pricing.splatnost_dni ?? 7)) : v.splatnost,
    plneni,
  }
  const obdobi = new Date(mesic).toLocaleDateString('cs-CZ', { month: 'numeric', year: 'numeric' })
  const polozky = [{
    nazev: `Vedení účetnictví ${obdobi}`,
    popis: k.pricing.model === 'pausal'
      ? `${v.zaklad_nazev}${k.vat_payer ? ', včetně příplatku za plátcovství DPH' : ''}`
      : `${v.zaklad_nazev}: ${v.jednotek} (doklady ${v.podklady.dokladu}, bankovní pohyby ${v.podklady.pohybu}), rozpis v příloze`,
    cena: Number(v.cena),
  }]
  const pri = k.pricing.priplatky ?? {}
  const zamestnanci = []
  for (const [druh, pocet, sazba, text] of [['DPP', dpp, pri.dpp, 'dohoda o provedení práce'], ['HPP', hpp, pri.hpp, 'pracovní poměr']]) {
    if (!pocet) continue
    if (sazba == null) throw new Error(`${k.name}: ceník nemá příplatek za ${druh}`)
    polozky.push({ nazev: `Mzdová agenda ${obdobi}`, popis: `Zaměstnanec (${text}): ${pocet} × ${kc(Number(sazba))} Kč`, cena: Number(sazba) * pocet })
    zamestnanci.push(`${pocet} ${druh === 'DPP' ? 'zaměstnanec na dohodu o provedení práce' : 'zaměstnanec v pracovním poměru'}`)
  }

  const { doklady, pohyby } = await podkladyMesice(k.id, mesic)
  if (doklady.length + pohyby.length !== Number(v.jednotek) && !String(v.zaklad_nazev).match(/bankovních pohybů/i)) {
    throw new Error(`${k.name}: přehled (${doklady.length + pohyby.length}) nesedí na vyúčtování (${v.jednotek})`)
  }
  const priloha = prehled({ obdobi, doklady, pohyby, zamestnanci })
  const zaklad = polozky.reduce((s, p) => s + p.cena, 0)
  const dph = Math.round(zaklad * FIRSEN.sazba_dph) / 100
  const celkem = zaklad + dph
  const qr = await qrKod(celkem, f.cislo)

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'kliments-faktura-'))
  const htmlPath = path.join(dir, 'faktura.html')
  const pdfPath = path.join(dir, `${f.cislo}.pdf`)
  await fs.promises.writeFile(htmlPath, html({ f, klient: k, polozky, zaklad, dph, celkem, qr, priloha }), 'utf8')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' })
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true })
  } finally {
    await browser.close()
  }

  if (nahled) return { ...f, klient: k.name, zaklad, dph, celkem, jednotek: v.jednotek, pdf: pdfPath }

  const cesta = `firsen/faktury/${rok}/${f.cislo}-${slug(k.name)}.pdf`
  const { error: se } = await db.storage.from('documents').upload(cesta, await fs.promises.readFile(pdfPath), { contentType: 'application/pdf', upsert: true })
  if (se) throw new Error(`úložiště: ${se.message}`)

  // doklad pro klienta: přijatá faktura od firsen
  const { data: doklad, error: de } = await db.from('documents').upsert({
    client_id: k.id, kind: 'received_invoice', source: 'generated', status: 'reviewed',
    storage_path: cesta, file_name: `${f.cislo}.pdf`, mime_type: 'application/pdf',
    counterparty_name: FIRSEN.nazev, counterparty_ico: FIRSEN.ico, counterparty_dic: FIRSEN.dic,
    customer_ico: k.ico, doc_number: f.cislo, var_symbol: f.cislo,
    issue_date: f.vystaveni, taxable_date: f.plneni, due_date: f.splatnost,
    currency: 'CZK', amount_total: celkem, amount_vat: dph, amount_czk: celkem,
    vat_breakdown: [{ sazba: FIRSEN.sazba_dph, zaklad, dph }], vat_regime: 'tuzemsko',
    items: polozky.map((p) => ({ nazev: p.nazev, mnozstvi: 1, mj: 'měsíc', cena_bez_dph: p.cena, sazba_dph: FIRSEN.sazba_dph, cena_s_dph: Math.round(p.cena * (100 + FIRSEN.sazba_dph)) / 100 })),
    suggested_account: '518', suggested_vat_class: k.vat_payer ? 'UD' : 'UN',
    supplier_bank_account: FIRSEN.ucet,
    description: polozky[0].popis, extraction_method: 'generated',
    note: 'Faktura za vedení účetnictví vystavená kanceláří Kliments',
  }, { onConflict: 'client_id,file_sha256', ignoreDuplicates: false }).select('id').single()
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
        ico, mesic, cislo: arg('--cislo'), nahled: NAHLED, vystaveni: arg('--vystaveni'),
        dpp: Number(arg('--dpp') ?? 0), hpp: Number(arg('--hpp') ?? 0),
      })
      console.log(`${f.klient}: faktura ${f.cislo}, ${f.jednotek} podkladů, ${kc(f.celkem)} Kč s DPH, splatnost ${den(f.splatnost)}${f.pdf ? ` (náhled: ${f.pdf})` : ''}`)
    } catch (e) {
      console.error(`${ico}: ${e.message}`)
    }
  }
}
