// Import bankovních pohybů z CSV exportu banky do evidence (bank_transactions).
// Opakovatelný: stejný pohyb se nezaeviduje dvakrát (otisk řádku + pořadí shod).
//
//   node banka-csv.mjs --ico 07858680 --ucet 2601577488/2010 --soubor vypis.csv [--nasucho]
//
// Formáty: Fio "Pohyby na účtu" (Datum;Objem;Měna;Protiúčet;Kód banky;Zpráva
// pro příjemce;Poznámka;Typ) a Fio se sloupci VS/KS/SS/ID pohybu, pokud jsou.
import './lib/env.mjs'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

function csv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"') q = true
    else if (c === ';') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}

const cislo = (s) => (s ? Number(String(s).replace(/\s/g, '').replace(',', '.')) : null)
const datum = (s) => { const [d, m, y] = s.split('.'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
const prazdne = (s) => (s && s.trim() ? s.trim() : null)

// Kategorie jen z jednoznačných znaků
function kategorie(typ, zprava) {
  if (/karetn/i.test(typ ?? '')) return 'card'
  if (/poplatek|vedení účtu/i.test(`${typ} ${zprava}`)) return 'bank_fee'
  return null
}

export async function importujCsv({ ico, ucet, soubor, nasucho = false }) {
  const { data: klient } = await db.from('clients').select('id, name').eq('ico', ico).single()
  if (!klient) throw new Error(`Klient ${ico} není v evidenci`)
  const { data: acc, error: ae } = await db.from('bank_accounts')
    .upsert({ client_id: klient.id, number: ucet, currency: 'CZK', name: ucet.endsWith('/2010') ? 'Fio banka' : null }, { onConflict: 'client_id,number' })
    .select('id').single()
  if (ae) throw ae

  const [hlavicka, ...radky] = csv(fs.readFileSync(soubor, 'utf8').replace(/^﻿/, ''))
  const i = (nazev) => hlavicka.findIndex((h) => h.trim().toLowerCase() === nazev)
  const col = {
    datum: i('datum'), objem: i('objem'), mena: i('měna'), protiucet: i('protiúčet'), kod: i('kód banky'),
    zprava: i('zpráva pro příjemce'), poznamka: i('poznámka'), typ: i('typ'),
    vs: i('vs'), ks: i('ks'), ss: i('ss'), id: i('id pohybu'), nazev: i('název protiúčtu'),
  }
  if (col.datum < 0 || col.objem < 0) throw new Error(`Nerozpoznaný formát CSV: ${hlavicka.join(';')}`)

  const poradi = new Map()
  const tx = radky.map((r) => {
    const g = (k) => (col[k] >= 0 ? prazdne(r[col[k]]) : null)
    const protiucet = g('protiucet') ? `${g('protiucet')}${g('kod') ? `/${g('kod')}` : ''}` : null
    const zprava = [g('zprava'), g('poznamka')].filter((x, n, a) => x && a.indexOf(x) === n).join(' · ') || null
    const otisk = crypto.createHash('sha1').update([g('datum'), g('objem'), protiucet, g('zprava'), g('poznamka'), g('typ')].join('|')).digest('hex').slice(0, 16)
    poradi.set(otisk, (poradi.get(otisk) ?? 0) + 1)
    return {
      client_id: klient.id, account_id: acc.id,
      booked_on: datum(g('datum')), amount: cislo(g('objem')),
      counterparty_account: protiucet, counterparty_name: g('nazev') ?? (protiucet ? g('poznamka') : null),
      var_symbol: g('vs'), const_symbol: g('ks'), spec_symbol: g('ss'),
      message: zprava, tx_type: g('typ'), bank_tx_id: g('id'),
      dedup_key: g('id') ? `fio:${g('id')}` : `csv:${otisk}:${poradi.get(otisk)}`,
      category: kategorie(g('typ'), zprava),
      raw: Object.fromEntries(hlavicka.map((h, n) => [h, r[n]])),
    }
  })
  const souhrn = {
    pohybu: tx.length,
    prijmy: tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    vydaje: -tx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0),
    od: tx.map((t) => t.booked_on).sort()[0], do: tx.map((t) => t.booked_on).sort().at(-1),
  }
  if (nasucho) return souhrn
  for (let n = 0; n < tx.length; n += 500) {
    const { error } = await db.from('bank_transactions').upsert(tx.slice(n, n + 500), { onConflict: 'account_id,dedup_key', ignoreDuplicates: true })
    if (error) throw error
  }
  return souhrn
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  importujCsv({ ico: arg('--ico'), ucet: arg('--ucet'), soubor: arg('--soubor'), nasucho: args.includes('--nasucho') })
    .then((s) => console.log(`Pohybů ${s.pohybu} (${s.od} až ${s.do}), příjmy ${s.prijmy.toFixed(2)}, výdaje ${s.vydaje.toFixed(2)}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
