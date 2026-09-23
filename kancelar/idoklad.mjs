// Vydané faktury z iDokladu do evidence (documents, kind issued_invoice).
// Opakovatelné: stabilní id podle iDoklad Id, změny v iDokladu se přepíšou.
// Klíče API: Správce přihlašovacích údajů Windows, položka idoklad-<IČO>.
//
//   node idoklad.mjs --ico 07858680 [--od 2026-01-01] [--nasucho]
import './lib/env.mjs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { cred } from './lib/cred.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const API = 'https://api.idoklad.cz/v3'

// UUID odvozené z textu (v5-like), aby opakovaný import přepsal stejný řádek
function uuidZ(text) {
  const h = crypto.createHash('sha1').update(text).digest()
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}
const den = (s) => (s && !s.startsWith('1753') ? s.slice(0, 10) : null)

async function token(ico) {
  const c = cred(`idoklad-${ico}`)
  const r = await fetch('https://identity.idoklad.cz/server/connect/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.user, client_secret: c.pass, scope: 'idoklad_api' }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`iDoklad: přihlášení selhalo (${j.error ?? r.status})`)
  return j.access_token
}

async function vse(h, cesta, filtr) {
  const out = []
  for (let page = 1; ; page++) {
    const r = await fetch(`${API}/${cesta}?page=${page}&pageSize=100&filter=${encodeURIComponent(filtr)}`, { headers: h })
    const j = await r.json()
    if (!j.IsSuccess) throw new Error(`iDoklad ${cesta}: ${j.Message ?? r.status}`)
    out.push(...j.Data.Items)
    if (page >= j.Data.TotalPages) return out
  }
}

export async function synchronizujIdoklad({ ico, od = '2026-01-01', nasucho = false }) {
  const { data: k } = await db.from('clients').select('id, name').eq('ico', ico).single()
  const h = { Authorization: `Bearer ${await token(ico)}` }
  const meny = Object.fromEntries((await vse(h, 'Currencies', 'Id~gte~0')).map((c) => [c.Id, c.Code]))
  const faktury = await vse(h, 'IssuedInvoices', `DateOfIssue~gte~${od}`)
  const dobropisy = await vse(h, 'CreditNotes', `DateOfIssue~gte~${od}`)

  const radek = (f, druh) => ({
    id: uuidZ(`idoklad|${ico}|${druh}|${f.Id}`),
    client_id: k.id, kind: druh, source: 'import', status: 'reviewed',
    counterparty_name: f.PartnerAddress?.NickName || null,
    counterparty_ico: f.PartnerAddress?.IdentificationNumber || null,
    counterparty_dic: f.PartnerAddress?.VatIdentificationNumber || null,
    customer_ico: f.PartnerAddress?.IdentificationNumber || null,
    doc_number: f.DocumentNumber, var_symbol: f.VariableSymbol || null, order_number: f.OrderNumber || null,
    issue_date: den(f.DateOfIssue), taxable_date: den(f.DateOfTaxing), due_date: den(f.DateOfMaturity),
    currency: meny[f.CurrencyId] ?? 'CZK',
    amount_total: f.Prices.TotalWithVat, amount_vat: f.Prices.TotalVat, amount_czk: f.Prices.TotalWithVatHc,
    description: [f.Description, ...(f.Items ?? []).map((i) => i.Name)].filter((x, i, a) => x && a.indexOf(x) === i).join(', '),
    // rozpis DPH a položky přímo z iDokladu (přesné, bez čtení PDF)
    vat_breakdown: (f.Prices.VatRateSummary ?? []).map((v) => ({ sazba: v.VatRate, zaklad: v.TotalWithoutVatHc, dph: v.TotalVatHc })),
    vat_regime: f.HasVatRegimeOss ? 'oss' : f.VatReverseChargeCodeId ? 'pdp_stavebnictvi' : f.Prices.TotalVat > 0 ? 'tuzemsko' : null,
    items: (f.Items ?? []).map((i) => ({
      nazev: i.Name, mnozstvi: i.Amount, mj: i.Unit ?? '',
      cena_bez_dph: i.Prices?.TotalWithoutVatHc ?? i.Prices?.TotalWithoutVat ?? 0,
      sazba_dph: i.VatRate ?? 0,
      cena_s_dph: i.Prices?.TotalWithVatHc ?? i.Prices?.TotalWithVat ?? 0,
    })),
    extraction_method: 'idoklad', note: 'Vydaná faktura z iDokladu',
    extracted: { idoklad_id: f.Id, stav_uhrady: f.PaymentStatus, uhrazeno: f.Prices.TotalPaidHc, datum_uhrady: den(f.DateOfPayment) },
    updated_at: new Date().toISOString(),
  })
  const rows = [...faktury.map((f) => radek(f, 'issued_invoice')), ...dobropisy.map((f) => radek(f, 'credit_note'))]
  const souhrn = {
    klient: k.name, faktur: faktury.length, dobropisu: dobropisy.length,
    celkem: faktury.reduce((s, f) => s + f.Prices.TotalWithVatHc, 0),
    bezDph: faktury.reduce((s, f) => s + f.Prices.TotalWithoutVatHc, 0),
    dph: faktury.reduce((s, f) => s + f.Prices.TotalVatHc, 0),
  }
  if (!nasucho) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from('documents').upsert(rows.slice(i, i + 200), { onConflict: 'id' })
      if (error) throw error
    }
  }
  return souhrn
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  synchronizujIdoklad({ ico: arg('--ico'), od: arg('--od') ?? '2026-01-01', nasucho: args.includes('--nasucho') })
    .then((s) => console.log(`${s.klient}: vydaných faktur ${s.faktur}, dobropisů ${s.dobropisu}; celkem ${s.celkem.toFixed(2)} Kč (bez DPH ${s.bezDph.toFixed(2)}, DPH ${s.dph.toFixed(2)})`))
    .catch((e) => { console.error(e); process.exit(1) })
}
