// Import JSON z pilotního převodníku do účetního jádra (opakovatelný, upsert podle id).
// Použití: node scripts/pilot/import_json.mjs <data.json>
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const [k, ...v] = l.split('='); return [k, v.join('=').replace(/^"|"$/g, '')] }),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))

async function upsert(table, rows, onConflict = 'id') {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict, defaultToNull: false })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`${table}: ${rows.length}`)
}

await upsert('clients', [data.client])
await upsert('bank_accounts', [data.account])
await upsert('bank_transactions', data.tx)
await upsert('documents', data.docs)
await upsert('payment_matches', data.matches, 'bank_transaction_id,document_id')
