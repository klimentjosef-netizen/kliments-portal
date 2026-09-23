// Znovu přečte už uložené doklady (soubory v úložišti) podle aktuálního zadání:
// doplní rozpis DPH, režim, položky, účet dodavatele, návrh předkontace.
// Údaje, které už v evidenci jsou, přepíše jen tehdy, když je doklad nese.
//
//   node precti-znovu.mjs --ico 07858680 [--od 2026-01-01] [--limit 50] [--soubezne 5] [--vse]
//   --vse  znovu přečte i doklady, které rozpis DPH už mají
import './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { rozpoznej } from './lib/rozpoznani.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const LIMIT = Number(arg('--limit') ?? Infinity)
const SOUBEZNE = Number(arg('--soubezne') ?? 5)
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const datum = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)

export async function prectiZnovu({ ico, od, vse = false, limit = LIMIT, soubezne = SOUBEZNE, log = console.log }) {
  const { data: k } = await db.from('clients').select('id, name, ico').eq('ico', ico).single()
  const { data: klienti } = await db.from('clients').select('id, name, ico').eq('active', true)
  const { data: pamet } = await db.from('v_supplier_memory')
    .select('counterparty_ico, counterparty_name, ucet, cleneni_dph, rezim_dph, dokladu')
    .eq('client_id', k.id).order('dokladu', { ascending: false }).limit(60)

  let dotaz = db.from('documents')
    .select('id, file_name, mime_type, storage_path, issue_date, taxable_date, counterparty_name, amount_total')
    .eq('client_id', k.id).not('storage_path', 'is', null).not('status', 'in', '(duplicate,rejected)')
  if (!vse) dotaz = dotaz.is('vat_breakdown', null)
  if (od) dotaz = dotaz.or(`issue_date.gte.${od},issue_date.is.null`)
  const { data: doklady, error } = await dotaz.order('issue_date', { ascending: false, nullsFirst: false }).limit(limit)
  if (error) throw error

  const stav = { celkem: doklady.length, hotovo: 0, chyb: 0 }
  const fronta = [...doklady]
  const worker = async () => {
    while (fronta.length) {
      const d = fronta.shift()
      try {
        const { data: soubor, error: se } = await db.storage.from('documents').download(d.storage_path)
        if (se) throw new Error(`stažení: ${se.message}`)
        const obsah = Buffer.from(await soubor.arrayBuffer())
        const priloha = { filename: d.file_name ?? 'doklad', contentType: d.mime_type ?? 'application/pdf', size: obsah.length, content: obsah, text: null }
        const info = { folder: k.name, from: '', subject: d.file_name ?? '', date: d.issue_date ? new Date(d.issue_date) : null, text: `Doklad klienta ${k.name} (IČO ${k.ico}) už evidovaný v účetnictví, čte se znovu kvůli doplnění DPH, položek a předkontace.` }
        const ai = await rozpoznej(info, [priloha], klienti, pamet ?? [])
        const x = ai.doklady?.[0]
        if (!x) throw new Error('model nevrátil doklad')
        const zmena = {
          vat_breakdown: x.sazby_dph?.length ? x.sazby_dph : null,
          vat_regime: x.rezim_dph && x.rezim_dph !== 'neuvedeno' ? x.rezim_dph : null,
          items: x.polozky?.length ? x.polozky : null,
          suggested_account: x.navrh_uctu || null,
          suggested_vat_class: x.navrh_cleneni_dph || null,
          supplier_bank_account: x.ucet_dodavatele || null,
          amount_vat: x.castka_dph ?? undefined,
          taxable_date: datum(x.duzp) ?? undefined,
          extracted: x,
          updated_at: new Date().toISOString(),
        }
        for (const klic of Object.keys(zmena)) if (zmena[klic] === undefined) delete zmena[klic]
        const { error: ue } = await db.from('documents').update(zmena).eq('id', d.id)
        if (ue) throw new Error(`zápis: ${ue.message}`)
        stav.hotovo++
        if (stav.hotovo % 10 === 0 || stav.hotovo === stav.celkem) log(`  přečteno ${stav.hotovo} z ${stav.celkem}`)
      } catch (e) {
        stav.chyb++
        log(`  CHYBA ${d.file_name}: ${e.message.slice(0, 120)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(soubezne, doklady.length) }, worker))
  return stav
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  prectiZnovu({ ico: arg('--ico'), od: arg('--od'), vse: args.includes('--vse') })
    .then((s) => console.log(`Hotovo: ${s.hotovo} dokladů, chyb ${s.chyb}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
