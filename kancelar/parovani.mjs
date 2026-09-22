// Párování bankovních pohybů s doklady (bez AI, podle pravidel).
//
//   node parovani.mjs --ico 07858680 [--nasucho]
//
// Pořadí pravidel (od nejjistějšího):
//   1. symbol   VS pohybu nebo číslo dokladu / VS ve zprávě + stejná částka    → potvrzeno
//   2. měna     kartová platba: původní částka a měna ze zprávy = doklad,
//               datum do 20 dnů od vystavení                                  → potvrzeno
//   3. částka   stejná částka v CZK, jediný doklad v časovém okně             → návrh k potvrzení
// Doklad i pohyb se párují nejvýš jednou (1:1); částečné úhrady zatím ručně.
import './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const VYDAJ = new Set(['received_invoice', 'receipt', 'advance'])
const PRIJEM = new Set(['issued_invoice'])
const DEN = 86_400_000
const dny = (a, b) => (new Date(a) - new Date(b)) / DEN
const norm = (s) => (s ?? '').replace(/\s/g, '').replace(/^0+/, '').toUpperCase()
const kc = (d) => d.amount_czk ?? (d.currency === 'CZK' ? d.amount_total : null)
const blizko = (a, b, tol = 0.5) => a != null && b != null && Math.abs(Math.abs(a) - Math.abs(b)) <= tol

// "částka  35.00 USD" z popisu kartové platby Fio
function puvodni(t) {
  const m = (t.message ?? '').match(/částka\s+([\d\s.,]+)\s+([A-Z]{3})/)
  if (m) return { castka: Number(m[1].replace(/\s/g, '').replace(',', '.')), mena: m[2] }
  if (t.original_amount && t.original_currency) return { castka: Math.abs(t.original_amount), mena: t.original_currency }
  return null
}

async function vse(dotaz) {
  const out = []
  for (let od = 0; ; od += 1000) {
    const { data, error } = await dotaz().range(od, od + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

export async function sparuj({ ico, nasucho = false }) {
  const { data: k } = await db.from('clients').select('id, name').eq('ico', ico).single()
  const tx = await vse(() => db.from('bank_transactions').select('id, booked_on, amount, var_symbol, message, counterparty_name, original_amount, original_currency, no_document_needed').eq('client_id', k.id))
  const docs = await vse(() => db.from('documents').select('id, kind, doc_number, var_symbol, issue_date, taxable_date, due_date, amount_total, amount_czk, currency, counterparty_name, status').eq('client_id', k.id).not('status', 'in', '(duplicate,rejected)'))
  const matches = await vse(() => db.from('payment_matches').select('bank_transaction_id, document_id').eq('client_id', k.id))

  const txHotove = new Set(matches.map((m) => m.bank_transaction_id))
  const docHotove = new Set(matches.map((m) => m.document_id))
  const volneTx = tx.filter((t) => !txHotove.has(t.id) && !t.no_document_needed)
  const nove = []
  const pouzij = (t, d, method, confirmed) => {
    txHotove.add(t.id); docHotove.add(d.id)
    nove.push({ client_id: k.id, bank_transaction_id: t.id, document_id: d.id, amount: Math.abs(t.amount), method, confirmed })
  }
  const kandidati = (t) => docs.filter((d) => !docHotove.has(d.id) && (t.amount < 0 ? VYDAJ : PRIJEM).has(d.kind))

  // 1. symbol
  for (const t of volneTx) {
    if (txHotove.has(t.id)) continue
    const text = norm(`${t.var_symbol ?? ''} ${t.message ?? ''}`)
    const vs = norm(t.var_symbol)
    const hit = kandidati(t).filter((d) => blizko(kc(d), t.amount, 1) && [d.var_symbol, d.doc_number].some((s) => {
      const n = norm(s)
      return n.length >= 4 && (n === vs || text.includes(n))
    }))
    if (hit.length === 1) pouzij(t, hit[0], 'var_symbol', true)
  }
  // 2. původní měna u kartových plateb
  for (const t of volneTx) {
    if (txHotove.has(t.id)) continue
    const p = puvodni(t)
    if (!p || p.mena === 'CZK') continue
    const hit = kandidati(t).filter((d) => d.currency === p.mena && blizko(d.amount_total, p.castka, 0.01) &&
      Math.abs(dny(t.booked_on, d.taxable_date ?? d.issue_date ?? t.booked_on)) <= 20)
    if (hit.length === 1) pouzij(t, hit[0], 'amount', true)
  }
  // 3. stejná částka v CZK v časovém okně, jediný kandidát
  for (const t of volneTx) {
    if (txHotove.has(t.id)) continue
    const hit = kandidati(t).filter((d) => {
      if (!blizko(kc(d), t.amount)) return false
      const vys = d.issue_date ?? d.taxable_date
      if (!vys) return false
      const konec = Math.max(dny(d.due_date ?? vys, vys), 0) + 45
      const r = dny(t.booked_on, vys)
      return r >= -7 && r <= konec
    })
    if (hit.length === 1) pouzij(t, hit[0], 'amount', false)
  }

  if (!nasucho && nove.length) {
    const { error } = await db.from('payment_matches').upsert(nove, { onConflict: 'bank_transaction_id,document_id', ignoreDuplicates: true })
    if (error) throw error
  }
  const vydaje = volneTx.filter((t) => t.amount < 0)
  return {
    klient: k.name, pohybu: tx.length, dokladu: docs.length,
    nove: nove.length, jiste: nove.filter((m) => m.confirmed).length, navrhy: nove.filter((m) => !m.confirmed).length,
    vydajuBezDokladu: vydaje.filter((t) => !txHotove.has(t.id)).length,
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  sparuj({ ico: arg('--ico'), nasucho: args.includes('--nasucho') })
    .then((s) => console.log(`${s.klient}: pohybů ${s.pohybu}, dokladů ${s.dokladu}; nově spárováno ${s.nove} (jistě ${s.jiste}, k potvrzení ${s.navrhy}); výdajů bez dokladu ${s.vydajuBezDokladu}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
