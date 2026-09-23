// Zaúčtování do deníku: z dokladů a bankovních pohybů vytvoří podvojné zápisy.
//
//   node uctovani.mjs --ico 07858680 --od 2026-08-01 --do 2026-08-31 [--nasucho]
//   node uctovani.mjs --ico 07858680 --rok 2026
//
// Zápisy vznikají jako rozpracované (draft) a účetní je potvrdí. Opakované
// spuštění zápisy přepíše, dokud nejsou potvrzené (posted).
//
// Účtový rozvrh (základ):
//   311 odběratelé · 321 dodavatelé · 221 banka · 211 pokladna
//   343 DPH · 341 daň z příjmů · 342 srážková daň · 331 zaměstnanci
//   365 závazky ke společníkům · 461 bankovní úvěry
//   5xx náklady (518 služby, 501 materiál, ...) · 602/604 výnosy · 648 ostatní výnosy
import './lib/env.mjs'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

const U = {
  odberatele: '311', dodavatele: '321', banka: '221', pokladna: '211',
  dph: '343', dan_prijmu: '341', srazkova_dan: '342', zamestnanci: '331',
  spolecnici: '365', uver: '461', prevody: '261',
  vynosy: '602', zbozi: '604', ostatni_vynosy: '648', ostatni_naklady: '548',
  bankovni_poplatky: '568', pokuty: '545', naklad_default: '518',
}
const r2 = (n) => Math.round(n * 100) / 100
const czk = (d) => d.amount_czk ?? (d.currency === 'CZK' ? d.amount_total : null)
// poměr přepočtu do CZK (u cizí měny se DPH i základ přepočítá stejným kurzem)
const kurz = (d) => (d.currency === 'CZK' || !d.amount_total ? 1 : (d.amount_czk ?? d.amount_total) / d.amount_total)

async function vse(dotaz) {
  const out = []
  for (let od = 0; ; od += 1000) {
    const { data, error } = await dotaz().range(od, od + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

// Zápis deníku: hlavička + řádky MD/D
function zapis(series, datum, popis, radky, { doklad = null, pohyb = null } = {}) {
  return { series, entry_date: datum, description: popis, document_id: doklad, bank_transaction_id: pohyb, radky: radky.filter((x) => x && Math.abs(x.amount) >= 0.01) }
}
const radek = (md, dal, castka, text, { sazba = null, cleneni = null, danove = true } = {}) =>
  ({ account_debit: md, account_credit: dal, amount: r2(castka), text, vat_rate: sazba, vat_class: cleneni, tax_deductible: danove })

// --- doklady -------------------------------------------------------------
function zauctujDoklad(d, k, nast) {
  const platce = k.vat_payer
  const celkem = czk(d)
  if (celkem == null) return null
  const kurzD = kurz(d)
  const sazby = (d.vat_breakdown ?? []).map((s) => ({ sazba: Number(s.sazba), zaklad: r2(Number(s.zaklad) * kurzD), dph: r2(Number(s.dph) * kurzD) }))
  const dphCelkem = r2(sazby.reduce((s, x) => s + x.dph, 0))
  const zakladCelkem = r2(celkem - dphCelkem)
  const naklad = d.suggested_account && /^\d{3}$/.test(d.suggested_account) ? d.suggested_account : U.naklad_default
  const samovymereni = ['reverse_charge', 'pdp_stavebnictvi'].includes(d.vat_regime ?? '')
  const popis = `${d.counterparty_name ?? 'bez protistrany'} · ${d.doc_number ?? d.file_name ?? ''}`.trim()

  if (d.kind === 'received_invoice' || d.kind === 'receipt' || d.kind === 'credit_note') {
    const znamenko = d.kind === 'credit_note' ? -1 : 1
    const radky = []
    if (platce && samovymereni) {
      // náklad v plné výši, daň se přizná i odečte (§ 108 zákona o DPH)
      radky.push(radek(naklad, U.dodavatele, znamenko * celkem, popis, { cleneni: d.vat_regime === 'pdp_stavebnictvi' ? 'PD' : 'RCH' }))
      const dan = r2(celkem * 0.21)
      radky.push(radek(U.dph, U.dph, znamenko * dan, `Samovyměření DPH 21 % · ${popis}`, { sazba: 21, cleneni: d.vat_regime === 'pdp_stavebnictvi' ? 'PD' : 'RCH' }))
    } else if (platce && dphCelkem > 0) {
      for (const s of sazby) radky.push(radek(naklad, U.dodavatele, znamenko * s.zaklad, `${popis} · základ ${s.sazba} %`, { sazba: s.sazba, cleneni: d.suggested_vat_class ?? 'UD' }))
      for (const s of sazby) radky.push(radek(U.dph, U.dodavatele, znamenko * s.dph, `${popis} · DPH ${s.sazba} %`, { sazba: s.sazba, cleneni: d.suggested_vat_class ?? 'UD' }))
      const zbytek = r2(celkem - zakladCelkem - dphCelkem)
      if (Math.abs(zbytek) >= 0.01) radky.push(radek(naklad, U.dodavatele, znamenko * zbytek, `${popis} · zaokrouhlení`))
    } else {
      radky.push(radek(naklad, U.dodavatele, znamenko * celkem, popis, { cleneni: d.suggested_vat_class ?? 'UN' }))
    }
    return zapis(d.kind === 'receipt' ? 'PD' : 'FP', d.taxable_date ?? d.issue_date, `${d.kind === 'credit_note' ? 'Dobropis' : 'Přijatý doklad'}: ${popis}`, radky, { doklad: d.id })
  }

  if (d.kind === 'issued_invoice') {
    const ucetVynosu = nast?.ucet_vynosu ?? U.vynosy
    const radky = []
    if (platce && dphCelkem > 0) {
      for (const s of sazby) radky.push(radek(U.odberatele, ucetVynosu, s.zaklad, `${popis} · základ ${s.sazba} %`, { sazba: s.sazba, cleneni: 'UD' }))
      for (const s of sazby) radky.push(radek(U.odberatele, U.dph, s.dph, `${popis} · DPH ${s.sazba} %`, { sazba: s.sazba, cleneni: 'UD' }))
      const zbytek = r2(celkem - zakladCelkem - dphCelkem)
      if (Math.abs(zbytek) >= 0.01) radky.push(radek(U.odberatele, ucetVynosu, zbytek, `${popis} · zaokrouhlení`))
    } else {
      radky.push(radek(U.odberatele, ucetVynosu, celkem, popis, { cleneni: 'UN' }))
    }
    return zapis('FV', d.taxable_date ?? d.issue_date, `Vydaná faktura: ${popis}`, radky, { doklad: d.id })
  }
  return null // zálohy, smlouvy, mzdové a ostatní doklady zatím ručně
}

// --- banka ---------------------------------------------------------------
function zauctujPohyb(t, parovani, doklady, smlouvy) {
  const castka = Math.abs(Number(t.amount))
  const vydaj = Number(t.amount) < 0
  const popis = `${t.counterparty_name ?? t.counterparty_account ?? ''} · ${t.message ?? ''}`.trim().slice(0, 120)
  const parovane = parovani.filter((m) => m.bank_transaction_id === t.id)

  if (parovane.length) {
    const radky = []
    for (const m of parovane) {
      const d = doklady.get(m.document_id)
      const castkaM = Math.abs(Number(m.amount))
      if (!d) continue
      if (d.kind === 'contract') {
        const ucet = d.extracted?.naklad ? (d.extracted?.ucet ?? U.naklad_default) : U.uver
        radky.push(radek(ucet, U.banka, castkaM, `${d.counterparty_name ?? 'smlouva'} · ${d.doc_number ?? ''}`))
      } else if (d.kind === 'issued_invoice') {
        radky.push(radek(U.banka, U.odberatele, castkaM, `Úhrada vydané faktury ${d.doc_number ?? ''}`))
      } else {
        radky.push(radek(U.dodavatele, U.banka, castkaM, `Úhrada přijatého dokladu ${d.doc_number ?? ''}`))
      }
    }
    const zbytek = r2(castka - parovane.reduce((s, m) => s + Math.abs(Number(m.amount)), 0))
    if (Math.abs(zbytek) >= 0.01) radky.push(radek(vydaj ? U.ostatni_naklady : U.ostatni_vynosy, vydaj ? U.banka : U.banka, zbytek, 'Rozdíl proti dokladu'))
    return zapis('BV', t.booked_on, `Banka: ${popis}`, radky, { pohyb: t.id })
  }

  // bez dokladu: podle zařazení pohybu
  const podle = {
    tax: () => {
      const p = (t.counterparty_account ?? '').split('-')[0]
      const ucet = p === '705' ? U.dph : p === '7704' ? U.dan_prijmu : ['7712', '7720', '713'].includes(p) ? U.srazkova_dan : U.pokuty
      return vydaj ? radek(ucet, U.banka, castka, `Platba úřadu · ${popis}`) : radek(U.banka, ucet, castka, `Vratka od úřadu · ${popis}`)
    },
    payroll: () => radek(U.zamestnanci, U.banka, castka, `Mzdová agenda · ${popis}`),
    loan: () => {
      const uver = /jistin|úvěr|uver/i.test(`${t.note ?? ''} ${popis}`)
      const ucet = uver ? U.uver : U.spolecnici
      return vydaj ? radek(ucet, U.banka, castka, `Splátka půjčky · ${popis}`) : radek(U.banka, ucet, castka, `Přijatá půjčka · ${popis}`)
    },
    bank_fee: () => radek(U.bankovni_poplatky, U.banka, castka, `Bankovní poplatek · ${popis}`),
    bank_expense: () => radek(U.naklad_default, U.banka, castka, `Náklad bez dokladu · ${popis}`),
    bank_income: () => radek(U.banka, U.ostatni_vynosy, castka, `Příjem bez dokladu · ${popis}`),
    refund: () => (vydaj ? radek(U.odberatele, U.banka, castka, `Vrácení přeplatku · ${popis}`) : radek(U.banka, U.odberatele, castka, `Přeplatek od odběratele · ${popis}`)),
  }[t.category]

  if (podle) return zapis('BV', t.booked_on, `Banka: ${popis}`, [podle()], { pohyb: t.id })
  return null // bez dokladu a bez zařazení: čeká na doklad
}

export async function zauctuj({ ico, od, do: doDne, nasucho = false }) {
  const { data: k } = await db.from('clients').select('*').eq('ico', ico).single()
  const nast = k.settings ?? {}
  const doklady = await vse(() => db.from('documents').select('*').eq('client_id', k.id).not('status', 'in', '(duplicate,rejected)'))
  const vObdobi = doklady.filter((d) => {
    const den = d.taxable_date ?? d.issue_date
    return den && den >= od && den <= doDne
  })
  const pohyby = await vse(() => db.from('bank_transactions').select('*').eq('client_id', k.id).gte('booked_on', od).lte('booked_on', doDne))
  const parovani = await vse(() => db.from('payment_matches').select('bank_transaction_id, document_id, amount').eq('client_id', k.id))
  const vsechnyDoklady = new Map((await vse(() => db.from('documents').select('id, kind, doc_number, counterparty_name, extracted').eq('client_id', k.id))).map((d) => [d.id, d]))

  const zapisy = []
  for (const d of vObdobi) { const z = zauctujDoklad(d, k, nast); if (z?.radky.length) zapisy.push(z) }
  for (const t of pohyby) { const z = zauctujPohyb(t, parovani, vsechnyDoklady, null); if (z?.radky.length) zapisy.push(z) }

  const stav = { klient: k.name, zapisu: zapisy.length, radku: zapisy.reduce((s, z) => s + z.radky.length, 0), nezauctovano: pohyby.length + vObdobi.length - zapisy.length }
  if (nasucho) return { ...stav, ukazka: zapisy.slice(0, 5) }

  // staré rozpracované zápisy v období smazat (potvrzené zůstávají)
  const { data: stare } = await db.from('journal_entries').select('id').eq('client_id', k.id)
    .gte('entry_date', od).lte('entry_date', doDne).eq('status', 'draft')
  if (stare?.length) await db.from('journal_entries').delete().in('id', stare.map((x) => x.id))

  const cisla = new Map()
  for (const z of zapisy) {
    const mesic = z.entry_date.slice(0, 7).replace('-', '')
    const klic = `${z.series}${mesic}`
    const poradi = (cisla.get(klic) ?? 0) + 1
    cisla.set(klic, poradi)
    const { data: e, error } = await db.from('journal_entries').insert({
      client_id: k.id, series: z.series, entry_number: `${klic}${String(poradi).padStart(4, '0')}`,
      entry_date: z.entry_date, description: z.description, document_id: z.document_id,
      bank_transaction_id: z.bank_transaction_id, status: 'draft',
    }).select('id').single()
    if (error) throw new Error(`zápis: ${error.message}`)
    const radky = z.radky.map((l, i) => ({ ...l, entry_id: e.id, client_id: k.id, line_no: i + 1 }))
    const { error: le } = await db.from('journal_lines').insert(radky)
    if (le) throw new Error(`řádky: ${le.message}`)
  }
  return stav
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const rok = arg('--rok')
  const od = arg('--od') ?? (rok ? `${rok}-01-01` : null)
  const doDne = arg('--do') ?? (rok ? `${rok}-12-31` : null)
  zauctuj({ ico: arg('--ico'), od, do: doDne, nasucho: args.includes('--nasucho') })
    .then((s) => {
      console.log(`${s.klient}: zápisů ${s.zapisu}, řádků ${s.radku}, nezaúčtováno ${s.nezauctovano}`)
      if (s.ukazka) for (const z of s.ukazka) console.log(`  ${z.series} ${z.entry_date} ${z.description}\n${z.radky.map((l) => `    MD ${l.account_debit} / D ${l.account_credit}  ${l.amount}  ${l.text}`).join('\n')}`)
    })
    .catch((e) => { console.error(e); process.exit(1) })
}
