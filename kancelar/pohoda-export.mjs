// Export dokladů do Pohody (dataPack XML, Windows-1250).
// Vygeneruje soubor, který se v Pohodě naimportuje: Soubor → Datová komunikace → XML import.
// Doklady se posílají bez předkontace (doplní účetní), s členěním DPH a rozpisem sazeb.
//
//   node pohoda-export.mjs --ico 07858680 --od 2026-08-01 --do 2026-08-31 [--slozka C:\...]
//
// Pozn.: číslo dokladu si přiděluje Pohoda z řady, číslo od dodavatele jde do
// variabilního symbolu (dohodnuto dřív u vytěžovače faktur).
import './lib/env.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import iconv from 'iconv-lite'
import { need } from './lib/env.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const cislo = (n) => (Math.round(Number(n ?? 0) * 100) / 100).toFixed(2)

// Členění DPH v Pohodě podle režimu a plátcovství
function cleneni(d, platce) {
  if (d.suggested_vat_class) return d.suggested_vat_class
  if (!platce) return 'UN'
  if (d.vat_regime === 'pdp_stavebnictvi') return 'PD'
  if (d.vat_regime === 'reverse_charge') return 'RCH'
  const dph = (d.vat_breakdown ?? []).reduce((s, x) => s + Number(x.dph ?? 0), 0)
  return dph > 0 ? 'UD' : 'UN'
}

// Rozpis částek podle sazeb: 0 % → priceNone, 12 % → priceLow, 21 % → priceHigh
function ceny(d, prefix) {
  const kurz = d.currency === 'CZK' || !d.amount_total ? 1 : (d.amount_czk ?? d.amount_total) / d.amount_total
  const s = { none: 0, low: 0, lowVat: 0, high: 0, highVat: 0 }
  for (const x of d.vat_breakdown ?? []) {
    const zaklad = Number(x.zaklad) * kurz
    const dph = Number(x.dph) * kurz
    if (Number(x.sazba) >= 20) { s.high += zaklad; s.highVat += dph }
    else if (Number(x.sazba) > 0) { s.low += zaklad; s.lowVat += dph }
    else s.none += zaklad
  }
  const celkem = d.amount_czk ?? d.amount_total ?? 0
  const soucet = s.none + s.low + s.lowVat + s.high + s.highVat
  if (Math.abs(celkem - soucet) >= 0.01) s.none += celkem - soucet // bez rozpisu nebo zaokrouhlení
  return `<${prefix}:homeCurrency>
        <typ:priceNone>${cislo(s.none)}</typ:priceNone>
        <typ:priceLow>${cislo(s.low)}</typ:priceLow>
        <typ:priceLowVAT>${cislo(s.lowVat)}</typ:priceLowVAT>
        <typ:priceHigh>${cislo(s.high)}</typ:priceHigh>
        <typ:priceHighVAT>${cislo(s.highVat)}</typ:priceHighVAT>
      </${prefix}:homeCurrency>`
}

function partner(d) {
  // do pole IČO patří jen české osmičíslí, zahraniční identifikace jde do DIČ
  const ico = /^\d{8}$/.test(String(d.counterparty_ico ?? '')) ? d.counterparty_ico : null
  const dic = d.counterparty_dic ?? (ico ? null : d.counterparty_ico)
  return `<inv:partnerIdentity>
        <typ:address>
          <typ:company>${esc(d.counterparty_name ?? '')}</typ:company>
          ${ico ? `<typ:ico>${esc(ico)}</typ:ico>` : ''}
          ${dic ? `<typ:dic>${esc(dic)}</typ:dic>` : ''}
        </typ:address>
      </inv:partnerIdentity>`
}

const zahranicni = (d) => !!d.counterparty_ico && !/^\d{8}$/.test(String(d.counterparty_ico))

function faktura(d, poradi, platce) {
  const prijata = d.kind !== 'issued_invoice'
  const typ = d.kind === 'credit_note' ? (prijata ? 'receivedCreditNotice' : 'issuedCreditNotice') : (prijata ? 'receivedInvoice' : 'issuedInvoice')
  const datum = d.taxable_date ?? d.issue_date
  return `  <dat:dataPackItem id="${prijata ? 'FP' : 'FV'}-${poradi}" version="2.0">
    <inv:invoice version="2.0">
      <inv:invoiceHeader>
        <inv:invoiceType>${typ}</inv:invoiceType>
        ${d.var_symbol || d.doc_number ? `<inv:symVar>${esc(String(d.var_symbol ?? d.doc_number).replace(/\D/g, '').slice(0, 20))}</inv:symVar>` : ''}
        <inv:date>${d.issue_date ?? datum}</inv:date>
        <inv:dateTax>${datum}</inv:dateTax>
        ${d.due_date ? `<inv:dateDue>${d.due_date}</inv:dateDue>` : ''}
        <inv:classificationVAT><typ:ids>${cleneni(d, platce)}</typ:ids></inv:classificationVAT>
        <inv:text>${esc((d.description ?? d.file_name ?? 'Doklad').slice(0, 240))}</inv:text>
        ${partner(d)}
        <inv:note>${esc(`Kliments: ${d.doc_number ?? ''}${zahranicni(d) ? ' | PROVĚŘIT členění DPH (zahraniční plnění)' : ''} ${d.note ?? ''}`.trim().slice(0, 240))}</inv:note>
      </inv:invoiceHeader>
      <inv:invoiceSummary>
        ${ceny(d, 'inv')}
      </inv:invoiceSummary>
    </inv:invoice>
  </dat:dataPackItem>`
}

export async function exportujDoPohody({ ico, od, do: doDne, slozka }) {
  const { data: k } = await db.from('clients').select('*').eq('ico', ico).single()
  const { data: doklady, error } = await db.from('documents')
    .select('*').eq('client_id', k.id).not('status', 'in', '(duplicate,rejected)')
    .in('kind', ['received_invoice', 'issued_invoice', 'credit_note', 'receipt'])
    .or(`taxable_date.gte.${od},and(taxable_date.is.null,issue_date.gte.${od})`)
    .order('taxable_date', { ascending: true })
  if (error) throw error
  const vObdobi = doklady.filter((d) => {
    const den = d.taxable_date ?? d.issue_date
    return den && den >= od && den <= doDne && (d.amount_czk ?? d.amount_total) != null
  })

  const polozky = vObdobi.map((d, i) => faktura(d, i + 1, k.vat_payer)).join('\n')
  const xml = `<?xml version="1.0" encoding="windows-1250"?>
<dat:dataPack xmlns:dat="http://www.stormware.cz/schema/version_2/data.xsd"
  xmlns:typ="http://www.stormware.cz/schema/version_2/type.xsd"
  xmlns:inv="http://www.stormware.cz/schema/version_2/invoice.xsd"
  version="2.0" id="kliments-${od}" ico="${esc(k.ico)}" application="Kliments" note="Export z evidence Kliments ${od} až ${doDne}">
${polozky}
</dat:dataPack>`

  const dir = slozka ?? path.join(process.env.USERPROFILE ?? '.', 'Downloads', 'pohoda')
  fs.mkdirSync(dir, { recursive: true })
  const soubor = path.join(dir, `${k.ico}-${od}-${doDne}.xml`)
  fs.writeFileSync(soubor, iconv.encode(xml, 'win1250'))

  const souhrn = {
    klient: k.name, soubor, dokladu: vObdobi.length,
    prijate: vObdobi.filter((d) => d.kind !== 'issued_invoice').length,
    vydane: vObdobi.filter((d) => d.kind === 'issued_invoice').length,
    celkem: vObdobi.reduce((s, d) => s + Number(d.amount_czk ?? d.amount_total ?? 0), 0),
    preskoceno: doklady.length - vObdobi.length,
  }
  return souhrn
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  exportujDoPohody({ ico: arg('--ico'), od: arg('--od'), do: arg('--do'), slozka: arg('--slozka') })
    .then((s) => console.log(`${s.klient}: ${s.dokladu} dokladů (přijaté ${s.prijate}, vydané ${s.vydane}), celkem ${s.celkem.toFixed(2)} Kč\n${s.soubor}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
