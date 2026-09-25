// Bankovní výpis v PDF (nebo fotce) → pohyby v evidenci.
// Výpisy, které přijdou do sběrné schránky, jsou v evidenci jako doklad druhu
// bank_statement. Tenhle program je přečte Claudem a založí z nich pohyby.
//
//   node banka-pdf.mjs --ico 24007986 [--doklad <uuid>] [--nasucho]
//
// Kontrola: součet příjmů a výdajů musí sedět na součty uvedené ve výpisu,
// jinak se pohyby nezaloží a výpis zůstane k ručnímu projití.
import './lib/env.mjs'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { need } from './lib/env.mjs'

const args = process.argv.slice(2)
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const NASUCHO = args.includes('--nasucho')
const db = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const CLAUDE_EXE = process.env.CLAUDE_EXE || path.join(process.env.APPDATA ?? '', 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe')

const Vypis = z.object({
  ucet: z.string().describe('Číslo účtu klienta ve tvaru číslo/kód banky'),
  banka: z.string(),
  obdobi_od: z.string().describe('YYYY-MM-DD'),
  obdobi_do: z.string().describe('YYYY-MM-DD'),
  pocatecni_zustatek: z.number().nullable(),
  konecny_zustatek: z.number().nullable(),
  soucet_prijmu: z.number().nullable().describe('Součet příchozích plateb uvedený ve výpisu'),
  soucet_vydaju: z.number().nullable().describe('Součet odchozích plateb uvedený ve výpisu, kladné číslo'),
  pohyby: z.array(z.object({
    datum: z.string().describe('Datum zaúčtování, YYYY-MM-DD'),
    castka: z.number().describe('Kladná u příjmu, záporná u výdaje'),
    protiucet: z.string(),
    nazev_protiuctu: z.string(),
    variabilni_symbol: z.string(),
    konstantni_symbol: z.string(),
    zprava: z.string().describe('Zpráva pro příjemce, popis platby nebo obchodník u karty'),
    typ: z.string().describe('Typ transakce podle výpisu'),
    puvodni_castka: z.number().nullable().describe('Částka v cizí měně u karetních plateb'),
    puvodni_mena: z.string(),
  })),
})
const { $schema, ...SCHEMA_OBJ } = z.toJSONSchema(Vypis)
const SCHEMA = JSON.stringify(SCHEMA_OBJ)
const r2 = (n) => Math.round(Number(n) * 100) / 100
const prazdne = (s) => (s && String(s).trim() ? String(s).trim() : null)

async function prectiVypis(soubor, nazev) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kliments-vypis-'))
  try {
    const cesta = path.join(dir, nazev)
    await fs.writeFile(cesta, soubor)
    const zadani = `Přečti bankovní výpis v souboru ${nazev} v aktuální složce (nástroj Read).
Vypiš VŠECHNY pohyby na účtu, žádný nevynechej, v pořadí jak jsou ve výpisu.
Částky opisuj přesně: příjem kladně, výdaj záporně. Co ve výpisu není, nech prázdné.
U karetních plateb dej do pole zprava jméno obchodníka a místo.
Součty příjmů a výdajů opiš z výpisu, ne z vlastního sčítání.`
    const env = { ...process.env }
    delete env.ANTHROPIC_API_KEY
    const out = await new Promise((resolve, reject) => {
      const p = spawn(CLAUDE_EXE, ['-p', '--output-format', 'json', '--json-schema', SCHEMA,
        '--allowedTools', 'Read', '--model', process.env.KLIMENTS_MODEL || 'sonnet', '--max-turns', '30'], { cwd: dir, env })
      let o = '', e = ''
      const cas = setTimeout(() => { p.kill(); reject(new Error('Claude Code: vypršel čas')) }, 15 * 60_000)
      p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => (e += d))
      p.on('error', reject)
      p.on('close', (code) => { clearTimeout(cas); code === 0 ? resolve(o) : reject(new Error(`Claude Code ${code}: ${(e || o).slice(0, 200)}`)) })
      p.stdin.end(zadani)
    })
    const r = JSON.parse(out)
    if (r.is_error || !r.structured_output) throw new Error(`nečitelný výpis: ${String(r.result ?? '').slice(0, 150)}`)
    return Vypis.parse(r.structured_output)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

export async function nactiVypisyZDokladu({ ico, doklad, nasucho = NASUCHO, log = console.log }) {
  const { data: k } = await db.from('clients').select('id, name').eq('ico', ico).single()
  let dotaz = db.from('documents').select('id, file_name, storage_path, mime_type, extracted')
    .eq('client_id', k.id).eq('kind', 'bank_statement').not('storage_path', 'is', null)
  if (doklad) dotaz = dotaz.eq('id', doklad)
  const { data: vypisy, error } = await dotaz
  if (error) throw error

  const stav = { klient: k.name, vypisu: 0, pohybu: 0, preskoceno: 0, chyb: 0 }
  for (const v of vypisy) {
    if (v.extracted?.vypis_nacten && !doklad) { stav.preskoceno++; continue }
    try {
      const { data: soubor, error: se } = await db.storage.from('documents').download(v.storage_path)
      if (se) throw new Error(se.message)
      const data = await prectiVypis(Buffer.from(await soubor.arrayBuffer()), v.file_name ?? 'vypis.pdf')

      const prijmy = r2(data.pohyby.filter((p) => p.castka > 0).reduce((s, p) => s + p.castka, 0))
      const vydaje = r2(-data.pohyby.filter((p) => p.castka < 0).reduce((s, p) => s + p.castka, 0))
      const sedi = (a, b) => a == null || Math.abs(r2(a) - b) < 1
      if (!sedi(data.soucet_prijmu, prijmy) || !sedi(data.soucet_vydaju, vydaje)) {
        throw new Error(`součty nesedí: výpis uvádí ${data.soucet_prijmu} / ${data.soucet_vydaju}, sečteno ${prijmy} / ${vydaje}`)
      }

      const { data: ucet, error: ue } = await db.from('bank_accounts').upsert(
        { client_id: k.id, number: data.ucet, currency: 'CZK', name: data.banka },
        { onConflict: 'client_id,number' }).select('id').single()
      if (ue) throw new Error(ue.message)

      const poradi = new Map()
      const pohyby = data.pohyby.map((p) => {
        const otisk = crypto.createHash('sha1').update([p.datum, p.castka, p.protiucet, p.variabilni_symbol, p.zprava].join('|')).digest('hex').slice(0, 16)
        poradi.set(otisk, (poradi.get(otisk) ?? 0) + 1)
        return {
          client_id: k.id, account_id: ucet.id, booked_on: p.datum, amount: r2(p.castka),
          counterparty_account: prazdne(p.protiucet), counterparty_name: prazdne(p.nazev_protiuctu) ?? prazdne(p.zprava),
          var_symbol: prazdne(p.variabilni_symbol), const_symbol: prazdne(p.konstantni_symbol),
          message: prazdne(p.zprava), tx_type: prazdne(p.typ),
          original_amount: p.puvodni_castka, original_currency: prazdne(p.puvodni_mena),
          dedup_key: `pdf:${otisk}:${poradi.get(otisk)}`,
          statement_document_id: v.id,
          category: /kart|internet/i.test(p.typ ?? '') ? 'card' : /poplat/i.test(`${p.typ} ${p.zprava}`) ? 'bank_fee' : null,
          raw: p,
        }
      })
      if (!nasucho) {
        for (let i = 0; i < pohyby.length; i += 500) {
          const { error: pe } = await db.from('bank_transactions').upsert(pohyby.slice(i, i + 500), { onConflict: 'account_id,dedup_key', ignoreDuplicates: true })
          if (pe) throw new Error(pe.message)
        }
        await db.from('documents').update({ extracted: { ...(v.extracted ?? {}), vypis_nacten: true, ucet: data.ucet, obdobi: [data.obdobi_od, data.obdobi_do], pohybu: pohyby.length } }).eq('id', v.id)
      }
      stav.vypisu++; stav.pohybu += pohyby.length
      log(`  ${v.file_name}: ${data.ucet}, ${data.obdobi_od} až ${data.obdobi_do}, ${pohyby.length} pohybů (příjmy ${prijmy}, výdaje ${vydaje})`)
    } catch (e) {
      stav.chyb++
      log(`  CHYBA ${v.file_name}: ${e.message.slice(0, 160)}`)
    }
  }
  return stav
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  nactiVypisyZDokladu({ ico: arg('--ico'), doklad: arg('--doklad') })
    .then((s) => console.log(`${s.klient}: výpisů ${s.vypisu}, pohybů ${s.pohybu}, přeskočeno ${s.preskoceno}, chyb ${s.chyb}`))
    .catch((e) => { console.error(e); process.exit(1) })
}
