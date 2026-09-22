// Přepočet dokladů v cizí měně do CZK kurzem ČNB (denní kurz platný k DUZP,
// jinak k datu vystavení). Plní documents.amount_czk a kurz zapíše do poznámky
// v extracted._kurz. Doklady bez data zůstanou bez přepočtu (a v přehledu se
// ukážou jako "bez kurzu").
//   node kurzy.mjs
import './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const cache = new Map()

async function kurz(datum, mena) {
  if (!cache.has(datum)) {
    const r = await fetch(`https://api.cnb.cz/cnbapi/exrates/daily?date=${datum}&lang=EN`)
    if (!r.ok) throw new Error(`ČNB ${datum}: ${r.status}`)
    cache.set(datum, (await r.json()).rates)
  }
  const k = cache.get(datum).find((x) => x.currencyCode === mena)
  return k ? { rate: k.rate / k.amount, validFor: k.validFor } : null
}

export async function prepocitejKurzy() {
  const { data, error } = await db.from('documents')
    .select('id, currency, amount_total, taxable_date, issue_date, extracted')
    .neq('currency', 'CZK').is('amount_czk', null).not('amount_total', 'is', null)
  if (error) throw error
  let hotovo = 0
  for (const d of data) {
    const datum = d.taxable_date ?? d.issue_date
    if (!datum) continue
    const k = await kurz(datum, d.currency)
    if (!k) continue
    const { error: e } = await db.from('documents').update({
      amount_czk: Math.round(d.amount_total * k.rate * 100) / 100,
      extracted: { ...(d.extracted ?? {}), _kurz: { zdroj: 'ČNB', mena: d.currency, kurz: k.rate, platny_k: k.validFor } },
    }).eq('id', d.id)
    if (e) throw e
    hotovo++
  }
  return { hotovo, celkem: data.length }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  prepocitejKurzy().then((v) => console.log(`Přepočteno kurzem ČNB: ${v.hotovo} z ${v.celkem}`)).catch((e) => { console.error(e); process.exit(1) })
}
