// Vydané faktury a dobropisy z e-shopu na Athena CMS (Maliiisa) do evidence.
// Administrace nemá API; přihlásíme se jako uživatel a stáhneme tentýž export pro Pohodu,
// který nabízí tlačítko „Export XML“ v sekci Doklady. Přihlášení je ve Správci
// přihlašovacích údajů Windows.
//
//   node athena.mjs --ico 24051705 [--od 2026-03-01] [--nasucho]
import './lib/env.mjs'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { cred } from './lib/cred.mjs'

const { XMLParser } = createRequire(import.meta.url)('fast-xml-parser')
const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

// E-shop jede na IČO klienta až od data „od“ (Maliiisa: do února 2026 běžel na jiné IČO)
const ESHOPY = {
  '24051705': { url: 'https://cms.maliiisa.cz', cred: 'maliiisa-cms', od: '2026-03-01' },
}

// Stejné ID jako scripts/pilot/pohoda_fv_to_json.py (uuid5), aby se faktury nezdvojily
const UID_NS = '6f1d8a52-9d0e-4c55-9a8b-2a6f0c1e7c11'
function uuid5(name) {
  const h = crypto.createHash('sha1').update(Buffer.from(UID_NS.replace(/-/g, ''), 'hex')).update(name, 'utf8').digest()
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}
const pole = (x) => (x == null ? [] : Array.isArray(x) ? x : [x])
const num = (x) => (x == null || x === '' ? 0 : Number(typeof x === 'object' ? x['#text'] : x))
const txt = (x) => (x == null ? null : String(typeof x === 'object' ? x['#text'] ?? '' : x).trim() || null)
const czDatum = (iso) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}` }

class Relace {
  constructor(base) { this.base = base; this.jar = new Map() }
  cookie() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
  uloz(r) { for (const h of r.headers.getSetCookie?.() ?? []) { const [kv] = h.split(';'); const i = kv.indexOf('='); this.jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)) } }
  async req(path, opt = {}) {
    let r = await fetch(new URL(path, this.base), { ...opt, headers: { ...opt.headers, cookie: this.cookie() }, redirect: 'manual' })
    this.uloz(r)
    for (let i = 0; i < 5 && r.status >= 300 && r.status < 400; i++) {
      r = await fetch(new URL(r.headers.get('location'), this.base), { headers: { cookie: this.cookie() }, redirect: 'manual' })
      this.uloz(r)
    }
    return r
  }
  async prihlas({ user, pass }) {
    await this.req('/jmAdmin/login')
    const r = await fetch(new URL('/jmAdmin/login', this.base), {
      method: 'POST', redirect: 'manual',
      body: new URLSearchParams({ email: user, password: pass, submitLogin: '' }),
      headers: { cookie: this.cookie(), 'content-type': 'application/x-www-form-urlencoded' },
    })
    this.uloz(r)
    const html = await (await this.req('/jmAdmin/dashboard')).text()
    if (/loginform/.test(html)) throw new Error('přihlášení do administrace e-shopu se nepovedlo')
  }
  // typ: pohoda-invoice | pohoda-creditNote
  async export(typ, od, doDne) {
    const byDate = typ === 'pohoda-creditNote' ? 'creditCreated' : 'invoiceCreated'
    const q = new URLSearchParams({ pageLimit: 'all', byDate, dateFrom: czDatum(od), dateTo: czDatum(doDne), search: '', export: '' })
    const html = await (await this.req(`/jmAdmin/invoices/invoices-list?${q}`)).text()
    const requestsUrl = html.match(/const requestsUrl = "([^"]+)"/)?.[1]
    const csrfToken = html.match(/const csrfToken = "([^"]+)"/)?.[1]
    const ordersList = html.match(/class="[^"]*js-ordersList[^"]*"[^>]*value="([^"]*)"/)?.[1]
      ?? html.match(/value="([^"]*)"[^>]*class="[^"]*js-ordersList/)?.[1] ?? ''
    if (!requestsUrl || !csrfToken) throw new Error('stránka Doklady nemá očekávanou podobu (requestsUrl/csrfToken)')
    if (!ordersList) return ''
    const r = await fetch(new URL(requestsUrl, this.base), {
      method: 'POST',
      body: new URLSearchParams({ requestName: 'export', module: 'pohoda', response: 'dom', 'data[type]': typ, 'data[ordersList]': ordersList, csrfToken }),
      headers: { cookie: this.cookie(), 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' },
    })
    const xml = await r.text()
    if (!xml.includes('dataPack')) throw new Error(`export ${typ} nevrátil XML: ${xml.slice(0, 80)}`)
    return xml
  }
}

// Pohoda dataPack z e-shopu → doklady v evidenci
function doklady(xml, klientId, ico) {
  const p = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false })
  const items = pole(p.parse(xml)?.dataPack?.dataPackItem)
  const vystup = []
  for (const it of items) {
    const inv = it.invoice
    if (!inv) continue
    const h = inv.invoiceHeader
    const typ = txt(h.invoiceType)
    if (!['issuedInvoice', 'issuedCreditNotice'].includes(typ)) continue
    const cislo = txt(h.number?.numberRequested)
    const s = inv.invoiceSummary?.homeCurrency ?? {}
    const zaklad = num(s.priceNone) + num(s.priceLow) + num(s.priceHigh) + num(s.price3)
    const dph = num(s.priceLowVAT) + num(s.priceHighVAT) + num(s.price3VAT)
    const castka = Math.round((zaklad + dph + num(s.round?.priceRound)) * 100) / 100
    const polozky = pole(inv.invoiceDetail?.invoiceItem)
    const adresa = h.partnerIdentity?.address ?? {}
    const obj = txt(h.numberOrder)
    const dobropis = typ === 'issuedCreditNotice'
    const znamenko = dobropis && castka > 0 ? -1 : 1
    vystup.push({
      id: uuid5(`fv|${ico}|${cislo}`), client_id: klientId,
      kind: dobropis ? 'credit_note' : 'issued_invoice', source: 'import', status: 'reviewed',
      counterparty_name: txt(adresa.company) ?? txt(adresa.name), counterparty_ico: txt(adresa.ico),
      doc_number: cislo, var_symbol: txt(h.symVar),
      order_number: obj ? obj.replace(/^0+/, '') : null,
      issue_date: txt(h.date), taxable_date: txt(h.dateTax) ?? txt(h.date), due_date: txt(h.dateDue),
      currency: 'CZK',
      amount_total: znamenko * castka, amount_vat: znamenko * Math.round(dph * 100) / 100, amount_czk: znamenko * castka,
      description: polozky.map((x) => txt(x.text)).filter(Boolean).join(', ').slice(0, 500),
      extraction_method: 'import',
      note: 'Vydaná faktura z e-shopu (automatický export z administrace)',
      updated_at: new Date().toISOString(),
    })
  }
  return vystup
}

export async function synchronizujAthena({ ico, od, nasucho = false, log = console.log }) {
  const e = ESHOPY[ico]
  if (!e) return null
  const { data: k, error } = await db.from('clients').select('id, name').eq('ico', ico).single()
  if (error) throw error
  const zacatek = od && od > e.od ? od : e.od
  const zitra = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const rel = new Relace(e.url)
  await rel.prihlas(cred(e.cred))

  const stazene = []
  for (const typ of ['pohoda-invoice', 'pohoda-creditNote']) {
    const xml = await rel.export(typ, zacatek, zitra)
    if (xml) stazene.push(...doklady(xml, k.id, ico))
  }
  // e-shop filtruje podle data vytvoření; do evidence jen doklady vystavené od začátku
  const mapa = new Map()
  for (const d of stazene) if (d.issue_date >= zacatek && d.doc_number) mapa.set(d.id, d)
  const nove = [...mapa.values()]

  const stavajici = []
  for (let i = 0; ; i += 1000) {
    const { data, error: e1 } = await db.from('documents').select('id, doc_number, amount_czk, amount_total')
      .eq('client_id', k.id).in('kind', ['issued_invoice', 'credit_note']).gte('issue_date', zacatek)
      .lt('issue_date', new Date().toISOString().slice(0, 10)).order('id').range(i, i + 999)
    if (e1) throw e1
    stavajici.push(...data)
    if (data.length < 1000) break
  }
  const byId = new Map((stavajici ?? []).map((x) => [x.id, x]))
  const stav = {
    klient: k.name, faktur: nove.filter((x) => x.kind === 'issued_invoice').length,
    dobropisu: nove.filter((x) => x.kind === 'credit_note').length,
    celkem: nove.reduce((s, x) => s + x.amount_czk, 0),
    pridano: nove.filter((x) => !byId.has(x.id)).length,
    zmeneno: nove.filter((x) => byId.has(x.id) && Math.abs(Number(byId.get(x.id).amount_czk ?? byId.get(x.id).amount_total) - x.amount_czk) >= 0.01).length,
    navicVEvidenci: (stavajici ?? []).filter((x) => !mapa.has(x.id)).map((x) => x.doc_number),
  }
  if (!nasucho) {
    for (let i = 0; i < nove.length; i += 500) {
      const { error: e2 } = await db.from('documents').upsert(nove.slice(i, i + 500), { onConflict: 'id', defaultToNull: false })
      if (e2) throw new Error(`zápis dokladů: ${e2.message}`)
    }
  }
  if (stav.navicVEvidenci.length) log(`  v evidenci, ale ne v e-shopu: ${stav.navicVEvidenci.join(', ')}`)
  return stav
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  synchronizujAthena({ ico: arg('--ico') ?? '24051705', od: arg('--od'), nasucho: args.includes('--nasucho') })
    .then((s) => console.log(`${s.klient}: faktur ${s.faktur}, dobropisů ${s.dobropisu}, celkem ${s.celkem.toFixed(2)} Kč, nově ${s.pridano}, změněno ${s.zmeneno}${args.includes('--nasucho') ? ' (NANEČISTO)' : ''}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
