// Nahraje surové dokumenty TechCars do Supabase storage (bucket 'documents')
// jako archiv klienta. Cesta = {userId}/{slug}/{rok_asciiNazev}.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const supa = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TC_ID = '4b2ee6f5-6d1a-4a37-9f61-3275ec7cb43a'
const BASE = 'C:/Users/klime/OneDrive/Plocha/Projekty/Tech cars - Kliments portal'
const DRY = process.argv.includes('--dry')

function ascii(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}
function folderFor(name) {
  const n = name.toLowerCase()
  if (/^dppdp9|priznani/.test(n)) return 'danove-priznani'
  if (/faktur|^open_/.test(n)) return 'faktury'
  if (/denik|hk_obrat|vykaz|výkaz|rozvaha|mzrek/.test(n)) return 'ucetni-podklady'
  return 'ostatni'
}
function ctype(name) {
  const e = name.toLowerCase().split('.').pop()
  return { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel', pdf: 'application/pdf' }[e] || 'application/octet-stream'
}

const plan = []
for (const year of ['2024', '2025', '2026']) {
  let files
  try { files = readdirSync(`${BASE}/${year}`) } catch { continue }
  for (const fn of files) {
    const full = `${BASE}/${year}/${fn}`
    if (!statSync(full).isFile()) continue
    const slug = folderFor(fn)
    const target = `${TC_ID}/${slug}/${year}_${ascii(fn)}`
    plan.push({ full, target, slug, ctype: ctype(fn) })
  }
}

console.log(`Plán: ${plan.length} souborů${DRY ? ' (DRY RUN)' : ''}`)
let ok = 0, fail = 0
for (const p of plan) {
  console.log(`  ${p.slug.padEnd(16)} <- ${p.target.split('/').pop()}`)
  if (DRY) continue
  const buf = readFileSync(p.full)
  const { error } = await supa.storage.from('documents').upload(p.target, buf, { contentType: p.ctype, upsert: true })
  if (error) { console.log('     !! CHYBA: ' + error.message); fail++ } else ok++
}
if (!DRY) console.log(`\nHotovo: nahráno ${ok}, chyb ${fail}`)
