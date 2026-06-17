// Ověří, zda KLIENT smí upravit svůj report (RLS UPDATE). Neintruzivní: zapíše
// zpět stejnou hodnotu whatif_base. Mintne klientskou session přes magic link.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SRK = env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_EMAIL = 'autoservis@techcars.cz'
const REPORT_ID = 'cd2556ba-3480-42cb-934b-f98944fdd97b'

const admin = createClient(SUPA_URL, SRK, { auth: { persistSession: false } })

// 1) magic link → token_hash
const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: CLIENT_EMAIL })
if (e1) { console.error('generateLink:', e1.message); process.exit(1) }
const tokenHash = link.properties?.hashed_token
if (!tokenHash) { console.error('chybí token_hash'); process.exit(1) }

// 2) verifyOtp anon klientem → session
const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: ses, error: e2 } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
if (e2) { console.error('verifyOtp:', e2.message); process.exit(1) }
console.log('Klientská session OK pro', ses.user?.email, '(role v JWT app_metadata:', JSON.stringify(ses.user?.app_metadata || {}), ')')

// 3) klient čte svůj report
const asClient = createClient(SUPA_URL, ANON, { global: { headers: { Authorization: `Bearer ${ses.session.access_token}` } }, auth: { persistSession: false } })
const { data: rd, error: e3 } = await asClient.from('reports').select('id,data').eq('id', REPORT_ID).single()
console.log('SELECT vlastního reportu klientem:', e3 ? 'BLOKOVÁNO (' + e3.message + ')' : 'OK')
if (e3) process.exit(0)

// 4) klient zkusí UPDATE (no-op: zapíše zpět stejné whatif_base)
const { data: up, error: e4, count } = await asClient.from('reports')
  .update({ data: rd.data }).eq('id', REPORT_ID).select('id')
if (e4) console.log('UPDATE klientem: ❌ BLOKOVÁNO RLS —', e4.message)
else if (!up || up.length === 0) console.log('UPDATE klientem: ⚠ neproběhl (0 řádků) — RLS politika UPDATE pravděpodobně chybí')
else console.log('UPDATE klientem: ✅ POVOLENO — klient může editovat a ukládat')
