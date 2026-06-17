// Read-only inspekce stavu klienta TechCars v Supabase.
// Tajné klíče se čtou z .env.local a NIKDY se nevypisují.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)

const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// 1) Najdi profil(y) TechCars
const { data: profiles, error: pErr } = await supa
  .from('profiles')
  .select('id,email,name,role,service,active')
if (pErr) { console.error('profiles error:', pErr.message); process.exit(1) }

const tc = profiles.filter(
  (p) => /techcar/i.test(p.name || '') || /techcar/i.test(p.email || '')
)
console.log('=== Profily celkem:', profiles.length, '| TechCars match:', tc.length, '===')
for (const p of tc) {
  console.log(`  • ${p.name} <${p.email}> role=${p.role} service=${p.service} active=${p.active} id=${p.id}`)
}

const targetIds = tc.map((p) => p.id)
if (targetIds.length === 0) {
  console.log('\n!! Nenašel jsem TechCars podle jména/emailu. Všechny klientské profily:')
  for (const p of profiles.filter((p) => p.role === 'client')) {
    console.log(`  • ${p.name} <${p.email}> id=${p.id}`)
  }
  process.exit(0)
}

// 2) Reporty TechCars
const { data: reports, error: rErr } = await supa
  .from('reports')
  .select('id,client_id,type,title,data,created_at')
  .in('client_id', targetIds)
if (rErr) { console.error('reports error:', rErr.message); process.exit(1) }

console.log('\n=== Reporty TechCars:', reports.length, '===')
for (const r of reports) {
  const d = r.data || {}
  const keys = Object.keys(d)
  const ledger = d.ledger || {}
  const months = Array.isArray(ledger.months) ? ledger.months : []
  console.log(`\n  ▸ [${r.type}] "${r.title}"  (id=${r.id}, vytvořeno ${r.created_at})`)
  console.log(`     data keys: ${keys.join(', ') || '(prázdné)'}`)
  if (d.ledger) {
    console.log(`     ledger: bank_balance=${ledger.bank_balance}, months=${months.length}`)
    if (months.length) {
      const labels = months.map((m) => m.label || m.month || '?')
      console.log(`     ledger měsíce: ${labels.join(', ')}`)
    }
  }
  if (Array.isArray(d.cashflow_months)) console.log(`     cashflow_months: ${d.cashflow_months.length}`)
  if (d.monthly_pnl) console.log(`     monthly_pnl: revenues=${d.monthly_pnl.revenues?.length||0}, costs=${d.monthly_pnl.costs?.length||0}`)
  if (Array.isArray(d.kpis)) console.log(`     kpis: ${d.kpis.length}`)
  if (Array.isArray(d.steps)) console.log(`     steps: ${d.steps.length}`)
}

// 3) Storage dokumenty (bucket) – kolik souborů má TechCars nahráno
const buckets = await supa.storage.listBuckets()
console.log('\n=== Storage buckety:', (buckets.data||[]).map(b=>b.name).join(', ') || '(žádné)', '===')
