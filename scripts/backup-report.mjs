// Záloha CFO reportu TechCars do lokálního (gitignorovaného) souboru = restore point.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const REPORT_ID = process.argv[2] || 'cd2556ba-3480-42cb-934b-f98944fdd97b'
const stamp = process.argv[3] || 'manual'

const { data, error } = await supa.from('reports').select('*').eq('id', REPORT_ID).single()
if (error) { console.error('Backup FAILED:', error.message); process.exit(1) }

mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
const file = new URL(`../backups/report-${REPORT_ID}-${stamp}.json`, import.meta.url)
writeFileSync(file, JSON.stringify(data, null, 2))
console.log('Záloha uložena:', file.pathname.replace(/^\//, ''))
console.log('  type=' + data.type + ' title="' + data.title + '" ledger_months=' + (data.data?.ledger?.months?.length ?? 0))
