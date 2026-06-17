// Read-only výpis souborů ve storage bucketu 'documents' pro TechCars.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TC_ID = '4b2ee6f5-6d1a-4a37-9f61-3275ec7cb43a'

async function listRec(prefix, depth = 0) {
  const { data, error } = await supa.storage.from('documents').list(prefix, { limit: 1000 })
  if (error) { console.log('  '.repeat(depth) + 'ERR ' + prefix + ': ' + error.message); return }
  for (const e of data || []) {
    const isFolder = e.id === null
    const path = prefix ? `${prefix}/${e.name}` : e.name
    if (isFolder) {
      console.log('  '.repeat(depth) + '📁 ' + e.name + '/')
      await listRec(path, depth + 1)
    } else {
      const kb = e.metadata?.size ? (e.metadata.size / 1024).toFixed(1) + ' KB' : '?'
      console.log('  '.repeat(depth) + '📄 ' + e.name + '  (' + kb + ')')
    }
  }
}

console.log('=== Storage documents/ (root) ===')
await listRec('')
console.log(`\n=== TechCars složka (${TC_ID}) ===`)
await listRec(TC_ID)
