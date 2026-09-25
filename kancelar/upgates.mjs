// Vydané faktury z e-shopu Upgates (Salibandy) do evidence.
// Administrace nemá API modul, takže se přihlásíme jako uživatel a stáhneme
// ke každé faktuře ISDOC (obsahuje sazby DPH, položky i měnu). Přihlašovací
// údaje jsou ve Správci přihlašovacích údajů Windows (upgates-<ičo>).
//
//   node upgates.mjs --ico 09244476 --od 2026-01-01 [--limit 50]
import './lib/env.mjs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { cred } from './lib/cred.mjs'

const require = createRequire(new URL('../package.json', import.meta.url))
const { chromium } = require('playwright')
const { XMLParser } = createRequire(import.meta.url)('fast-xml-parser')

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const ADMIN = 'https://salibandy.admin.s18.upgates.com'

function uuidZ(text) {
  const h = crypto.createHash('sha1').update(text).digest()
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}
const pole = (x) => (x == null ? [] : Array.isArray(x) ? x : [x])
const cislo = (x) => (x == null || x === '' ? null : Number(x))

// ISDOC → doklad v evidenci
function zIsdoc(xml, klientId, ico) {
  const p = new XMLParser({ ignoreAttributes: false, parseTagValue: false })
  const f = p.parse(xml)?.Invoice
  if (!f) return null
  const dobropis = String(f.DocumentType) === '2'
  const partner = f.AccountingCustomerParty?.Party
  const adresa = partner?.PostalAddress
  const kurz = cislo(f.CurrRate) ?? 1
  const cizi = f.ForeignCurrencyCode && f.ForeignCurrencyCode !== f.LocalCurrencyCode
  // pole s příponou Curr jsou v cizí měně, bez přípony v korunách
  const c = (x, y) => cislo(cizi ? x : y) ?? 0
  const sazby = pole(f.TaxTotal?.TaxSubTotal).map((t) => ({
    sazba: cislo(t.TaxCategory?.Percent) ?? 0,
    zaklad: c(t.TaxableAmountCurr, t.TaxableAmount),
    dph: c(t.TaxAmountCurr, t.TaxAmount),
  })).filter((x) => x.zaklad !== 0 || x.dph !== 0)
  const celkem = c(f.LegalMonetaryTotal?.TaxInclusiveAmountCurr, f.LegalMonetaryTotal?.TaxInclusiveAmount)
  const celkemCzk = cislo(f.LegalMonetaryTotal?.TaxInclusiveAmount) ?? 0
  const dphCelkem = c(f.TaxTotal?.TaxAmountCurr, f.TaxTotal?.TaxAmount)
  const polozky = pole(f.InvoiceLines?.InvoiceLine).map((r) => ({
    nazev: String(r.Item?.Description ?? r.Note ?? '').replace(/\s+/g, ' ').slice(0, 200),
    mnozstvi: cislo(r.InvoicedQuantity?.['#text'] ?? r.InvoicedQuantity) ?? 1,
    mj: String(r.InvoicedQuantity?.['@_unitCode'] ?? 'ks'),
    cena_bez_dph: c(r.LineExtensionAmountCurr, r.LineExtensionAmount),
    sazba_dph: cislo(r.ClassifiedTaxCategory?.Percent) ?? 0,
    cena_s_dph: c(r.LineExtensionAmountTaxInclusiveCurr, r.LineExtensionAmountTaxInclusive),
  }))
  const znamenko = dobropis ? -1 : 1

  return {
    id: uuidZ(`upgates|${ico}|${f.ID}`),
    client_id: klientId, kind: dobropis ? 'credit_note' : 'issued_invoice',
    source: 'import', status: 'reviewed',
    counterparty_name: partner?.PartyName?.Name ?? null,
    counterparty_ico: partner?.PartyIdentification?.ID ? String(partner.PartyIdentification.ID) : null,
    counterparty_dic: partner?.PartyTaxScheme?.CompanyID ? String(partner.PartyTaxScheme.CompanyID) : null,
    doc_number: String(f.ID), var_symbol: String(f.ID).replace(/\D/g, '') || null,
    order_number: f.OrderReference?.SalesOrderID ? String(f.OrderReference.SalesOrderID) : null,
    issue_date: f.IssueDate ?? null, taxable_date: f.TaxPointDate ?? f.IssueDate ?? null,
    due_date: f.PaymentMeans?.Payment?.PaymentDueDate ?? null,
    currency: (cizi ? f.ForeignCurrencyCode : f.LocalCurrencyCode) ?? 'CZK',
    amount_total: znamenko * celkem,
    amount_czk: znamenko * celkemCzk,
    amount_vat: znamenko * dphCelkem,
    vat_breakdown: sazby.map((x) => ({ ...x, zaklad: znamenko * x.zaklad, dph: znamenko * x.dph })),
    // bez DPH pro zahraničního odběratele = osvobozené dodání do EU, jinak tuzemsko
    vat_regime: dphCelkem > 0 ? 'tuzemsko' : (cizi || (partner?.PartyIdentification?.ID && !/^\d{8}$/.test(String(partner.PartyIdentification.ID))) ? 'osvobozeno' : null),
    items: polozky,
    description: polozky.map((x) => x.nazev).filter(Boolean).slice(0, 8).join(', ').slice(0, 500),
    suggested_account: null, suggested_vat_class: dphCelkem > 0 ? 'UD' : 'UN',
    extraction_method: 'upgates',
    note: `Vydaná faktura z e-shopu Upgates${cizi ? `, kurz ${kurz}` : ''}`,
    extracted: { isdoc_id: f.ID, uuid: f.UUID, kurz, mena_ciza: f.ForeignCurrencyCode ?? null, zaplaceno: f.PaymentMeans?.Payment?.PaidAmount ?? null },
    updated_at: new Date().toISOString(),
  }
}

export async function stahniUpgates({ ico, od, limit = Infinity, log = console.log }) {
  const { data: k } = await db.from('clients').select('id, name, ico').eq('ico', ico).single()
  const c = cred(`upgates-${k.name.toLowerCase().split(',')[0].trim().replace(/\s+/g, '-')}`)
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const stav = { klient: k.name, faktur: 0, dobropisu: 0, preskoceno: 0, chyb: 0 }
  try {
    const page = await ctx.newPage()
    await page.goto(`${ADMIN}/login/`, { waitUntil: 'domcontentloaded' })
    await page.fill('#frmloginForm-email', c.user)
    await page.fill('#frmloginForm-password', c.pass)
    await page.click('#frmloginForm-login')
    await page.waitForTimeout(4000)
    if (!/upgates\.com\/?$/.test(page.url()) && !page.url().includes('/orders')) throw new Error('přihlášení do Upgates se nepovedlo')

    const najdene = []
    for (let strana = 1; strana <= 200; strana++) {
      const url = strana === 1 ? `${ADMIN}/orders/default/default/invoices/` : `${ADMIN}/orders/default/default/invoices/?invoicesGrid-page=${strana}&do=invoicesGrid-paginate`
      const html = await (await ctx.request.get(url)).text()
      const radky = [...html.matchAll(/preview-isdoc\/\?order_id=(\d+)&amp;invoice_id=(\d+)/g)].map((m) => ({ order: m[1], invoice: m[2] }))
      const datumy = [...html.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].map((m) => `${m[3]}-${m[2]}-${m[1]}`)
      if (!radky.length) break
      najdene.push(...radky)
      const nejstarsi = datumy.sort()[0]
      log(`  strana ${strana}: ${radky.length} faktur, nejstarší datum ${nejstarsi}`)
      if (nejstarsi && nejstarsi < od) break
      if (najdene.length >= limit) break
    }

    const davka = []
    for (const r of najdene.slice(0, limit === Infinity ? undefined : limit)) {
      try {
        const xml = await (await ctx.request.get(`${ADMIN}/orders/default/preview-isdoc/?order_id=${r.order}&invoice_id=${r.invoice}`)).text()
        const doklad = zIsdoc(xml, k.id, ico)
        if (!doklad || !doklad.issue_date) { stav.chyb++; continue }
        if (doklad.issue_date < od) { stav.preskoceno++; continue }
        davka.push(doklad)
        doklad.kind === 'credit_note' ? stav.dobropisu++ : stav.faktur++
      } catch (e) {
        stav.chyb++
        log(`  CHYBA faktura ${r.invoice}: ${e.message.slice(0, 80)}`)
      }
      if (davka.length >= 100) { await uloz(davka.splice(0)) }
    }
    if (davka.length) await uloz(davka)
  } finally {
    await browser.close()
  }
  return stav
}

async function uloz(davka) {
  const { error } = await db.from('documents').upsert(davka, { onConflict: 'id' })
  if (error) throw new Error(`zápis dokladů: ${error.message}`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  stahniUpgates({ ico: arg('--ico') ?? '09244476', od: arg('--od') ?? '2026-01-01', limit: Number(arg('--limit') ?? Infinity) })
    .then((s) => console.log(`${s.klient}: faktur ${s.faktur}, dobropisů ${s.dobropisu}, přeskočeno ${s.preskoceno}, chyb ${s.chyb}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
