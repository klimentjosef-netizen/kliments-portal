// Fronta úloh pro Pohoda agenta (tabulka pohoda_jobs). Agent na počítači s Pohodou si
// úlohy bere sám a výsledek vrací zpět.
//
//   node pohoda-fronta.mjs --ico 09244476 --id <uuid,uuid>       doklady z evidence
//   node pohoda-fronta.mjs --ico 24051705 --soubor export.xml    hotový dataPack
//   node pohoda-fronta.mjs --stav [--limit 10]                   přehled úloh
//
// Databáze účetní jednotky je StwPh_<IČO>_2025 (tak jsou pojmenované na iPodniku),
// jinou lze zadat přes --databaze.
import './lib/env.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'
import { exportujDoPohody } from './pohoda-export.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

export async function zaradDoFronty({ ico, ids, soubor, popis, databaze, kontrolaDuplicity = true }) {
  const { data: k, error } = await db.from('clients').select('id, name').eq('ico', ico).single()
  if (error) throw new Error(`klient ${ico}: ${error.message}`)
  let xml = soubor
  if (!xml) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pohoda-'))
    const s = await exportujDoPohody({ ico, ids, slozka: dir, nazev: 'davka' })
    if (!s.dokladu) throw new Error('žádný doklad k odeslání')
    xml = s.soubor
    popis ??= `${k.name}: ${s.dokladu} dokladů (přijaté ${s.prijate}, vydané ${s.vydane})`
  }
  const bajty = fs.readFileSync(xml)
  const { data, error: e2 } = await db.from('pohoda_jobs').insert({
    client_id: k.id, ico, database: databaze ?? `StwPh_${ico}_2025`,
    description: popis ?? `${k.name}: ${path.basename(xml)}`,
    xml_b64: bajty.toString('base64'), doc_ids: ids ?? [],
    check_duplicity: kontrolaDuplicity, timeout_sec: 900,
  }).select('id, description').single()
  if (e2) throw new Error(`fronta: ${e2.message}`)
  return data
}

async function stav(limit) {
  const { data, error } = await db.from('pohoda_jobs')
    .select('id, created_at, finished_at, status, database, description, summary, error')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  const { data: agenti } = await db.from('pohoda_agents').select('name, last_seen_at, last_host')
  for (const a of agenti ?? []) console.log(`agent ${a.name} | naposledy ${a.last_seen_at ? new Date(a.last_seen_at).toLocaleString('cs-CZ') : 'nikdy'} | ${a.last_host ?? ''}`)
  for (const j of data) {
    const s = j.summary ? ` | položek ${j.summary.polozek}, ok ${j.summary.ok}, chyb ${j.summary.chyb}` : ''
    console.log(`${new Date(j.created_at).toLocaleString('cs-CZ')} | ${j.status.padEnd(7)} | ${j.database} | ${j.description}${s}${j.error ? ` | ${j.error}` : ''}`)
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const beh = args.includes('--stav')
    ? stav(Number(arg('--limit') ?? 10))
    : zaradDoFronty({ ico: arg('--ico'), ids: arg('--id')?.split(','), soubor: arg('--soubor'), popis: arg('--popis'), databaze: arg('--databaze') })
      .then((j) => console.log(`Ve frontě: ${j.description} (${j.id})`))
  beh.catch((e) => { console.error(e.message); process.exit(1) })
}
