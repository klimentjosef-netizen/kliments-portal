// Klíče z .env.local portálu (Supabase, Anthropic). Nic se nevypisuje.
import fs from 'node:fs'

const file = new URL('../../.env.local', import.meta.url)
for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

export function need(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Chybí proměnná ${name}`)
  return v
}
