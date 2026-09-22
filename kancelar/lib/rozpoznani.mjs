// Claude přečte e-mail a jeho přílohy: co to je, komu to patří, co je potřeba udělat,
// a z každého dokladu vytěží údaje pro evidenci.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const client = new Anthropic()
const MODEL = 'claude-opus-5'

const Doklad = z.object({
  priloha: z.number().int().describe('Pořadové číslo přílohy (1, 2, ...) podle seznamu příloh'),
  druh: z.enum([
    'received_invoice', 'issued_invoice', 'credit_note', 'receipt', 'advance',
    'bank_statement', 'payment_report', 'contract', 'payroll', 'tax', 'other',
  ]).describe('Druh dokladu z pohledu klienta (přijatá = klient platí, vydaná = klient fakturuje)'),
  ucetni_doklad: z.boolean().describe('Jde o doklad, který se účtuje nebo archivuje v účetnictví'),
  protistrana: z.string(),
  protistrana_ico: z.string(),
  protistrana_dic: z.string(),
  odberatel_ico: z.string().describe('IČO odběratele uvedené na dokladu'),
  dodavatel_ico: z.string().describe('IČO dodavatele uvedené na dokladu'),
  cislo_dokladu: z.string(),
  variabilni_symbol: z.string(),
  cislo_objednavky: z.string(),
  datum_vystaveni: z.string().describe('YYYY-MM-DD'),
  duzp: z.string().describe('Datum uskutečnění zdanitelného plnění, YYYY-MM-DD'),
  datum_splatnosti: z.string().describe('YYYY-MM-DD'),
  mena: z.string().describe('ISO kód, např. CZK, EUR'),
  castka_celkem: z.number().nullable().describe('Celkem k úhradě včetně DPH'),
  castka_dph: z.number().nullable(),
  popis: z.string().describe('Co se kupovalo nebo fakturovalo, česky, konkrétně (pro vyhledávání, např. "lednice Bosch KGN39")'),
  poznamka: z.string().describe('Cokoli nejasného nebo podezřelého, jinak prázdné'),
})

export const Rozpoznani = z.object({
  kategorie: z.enum(['doklad', 'banka', 'urad', 'dotaz', 'marketing', 'ostatni']),
  shrnuti: z.string().describe('Jedna až dvě věty česky: co to je a od koho'),
  akce: z.string().describe('Co má účetní udělat, česky; prázdné když nic'),
  klient_ico: z.string().describe('IČO klienta kanceláře, kterému e-mail patří; jen ze seznamu klientů, jinak prázdné'),
  klient_duvod: z.string().describe('Podle čeho jsi klienta určil'),
  potrebuje_pokyn: z.boolean().describe('true, když e-mail není běžná faktura, účtenka ani výpis a účetní musí rozhodnout, co s ním'),
  otazka: z.string().describe('Když potrebuje_pokyn: konkrétní otázka pro účetního, česky; jinak prázdné'),
  doklady: z.array(Doklad),
})

function system(klienti) {
  return `Jsi asistent účetní kanceláře Kliments. Čteš e-maily ze sběrné schránky, kam klienti a jejich dodavatelé posílají účetní doklady.

Klienti kanceláře (název · IČO):
${klienti.map((k) => `- ${k.name} · ${k.ico}`).join('\n')}

U každého e-mailu:
1. Urči kategorii a stručně česky shrň, co to je a od koho.
2. Napiš, co má účetní udělat (např. "zaúčtovat přijatou fakturu", "odpovědět klientovi na dotaz", "doplnit chybějící přílohu"). Newsletter či reklama: akce prázdná.
3. Urči klienta kanceláře, kterému e-mail patří: podle IČO odběratele nebo dodavatele na dokladu, podle textu e-mailu nebo odesílatele. Vybírej jen ze seznamu. Když si nejsi jistý, nech prázdné.
4. Z každé přílohy, která je dokladem (faktura, účtenka, dobropis, výpis, smlouva, mzdy, daně, vyúčtování platební brány), vytěž údaje. Loga, podpisy a obrázky z patičky vynech. Údaje opisuj přesně z dokladu; textový údaj, který na dokladu není, nech prázdný, částku dej null; nic nedopočítávej ani neodhaduj.
5. Běžné přijaté a vydané faktury, účtenky, zálohové faktury, výpisy a vyúčtování platebních bran se zpracují samy (potrebuje_pokyn = false). Všechno ostatní potřebuje pokyn účetního: smlouvy a dodatky, dopisy a výzvy úřadů (finanční úřad, ČSSZ, zdravotní pojišťovna, soud, exekutor), dotazy a žádosti klienta, upomínky, mzdové změny, cokoli nejasného. Tehdy napiš jednu konkrétní otázku, na kterou stačí krátce odpovědět (např. "Smlouva o nájmu skladu od 1. 10. 2026 za 12 000 Kč měsíčně: mám z ní udělat rozpis nájemného a hlídat úhrady?").`
}

function bloky(mail, prilohy) {
  const obsah = []
  prilohy.forEach((p, i) => {
    const hlavicka = { type: 'text', text: `Příloha ${i + 1}: ${p.filename} (${p.contentType}, ${p.size} B)` }
    if (p.contentType === 'application/pdf') {
      obsah.push(hlavicka, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.content.toString('base64') } })
    } else if (/^image\/(jpeg|png|gif|webp)$/.test(p.contentType)) {
      obsah.push(hlavicka, { type: 'image', source: { type: 'base64', media_type: p.contentType, data: p.content.toString('base64') } })
    } else if (p.text != null) {
      obsah.push({ type: 'text', text: `${hlavicka.text}\n\n${p.text}` })
    } else {
      obsah.push({ type: 'text', text: `${hlavicka.text}: obsah nelze zobrazit, posuď jen podle názvu.` })
    }
  })
  obsah.push({
    type: 'text',
    text: `E-mail
Složka: ${mail.folder}
Od: ${mail.from}
Předmět: ${mail.subject}
Datum: ${mail.date?.toISOString() ?? ''}

${mail.text || '(bez textu)'}`,
  })
  return obsah
}

async function rozpoznejApi(mail, prilohy, klienti) {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: betaZodOutputFormat(Rozpoznani) },
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: 'claude-opus-4-8' }],
    system: system(klienti),
    messages: [{ role: 'user', content: bloky(mail, prilohy) }],
  })
  if (res.stop_reason === 'refusal') throw new Error('Model odmítl zpracovat e-mail')
  if (!res.parsed_output) throw new Error(`Nečitelná odpověď modelu (${res.stop_reason})`)
  return uklid(res.parsed_output, { _usage: res.usage, _model: res.model })
}

const prazdne = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]))
const uklid = (out, meta) => ({ ...prazdne(out), doklady: out.doklady.map(prazdne), ...meta })

// Varianta přes Claude Code (předplatné, žádný API kredit): přílohy se uloží do
// dočasné složky, Claude Code je přečte nástrojem Read a vrátí JSON podle schématu.
const CLAUDE_EXE = process.env.CLAUDE_EXE || path.join(process.env.APPDATA ?? '', 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe')
const { $schema, ...schemaBezHlavicky } = z.toJSONSchema(Rozpoznani)
const SCHEMA = JSON.stringify(schemaBezHlavicky)

async function rozpoznejCli(mail, prilohy, klienti) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kliments-mail-'))
  try {
    const soubory = []
    for (const [i, p] of prilohy.entries()) {
      const ext = (p.filename.match(/\.[A-Za-z0-9]{1,6}$/) ?? [''])[0].toLowerCase()
      const jmeno = `priloha-${i + 1}${ext}`
      await fs.writeFile(path.join(dir, jmeno), p.content)
      soubory.push(`Příloha ${i + 1}: soubor ${jmeno} (původně ${p.filename}, ${p.contentType}, ${p.size} B)`)
    }
    const zadani = `${system(klienti)}

Přílohy jsou v aktuální složce, každou si přečti nástrojem Read (PDF i obrázky umí):
${soubory.join('\n') || '(bez příloh)'}

E-mail
Složka: ${mail.folder}
Od: ${mail.from}
Předmět: ${mail.subject}
Datum: ${mail.date?.toISOString() ?? ''}

${mail.text || '(bez textu)'}

Odpověz jen strukturovaným výstupem podle schématu.`
    const env = { ...process.env }
    delete env.ANTHROPIC_API_KEY // jinak by Claude Code účtoval přes API místo předplatného
    const out = await new Promise((resolve, reject) => {
      const proc = spawn(CLAUDE_EXE, ['-p', '--output-format', 'json', '--json-schema', SCHEMA,
        '--allowedTools', 'Read', '--model', process.env.KLIMENTS_MODEL || 'sonnet', '--max-turns', String(prilohy.length + 8)], { cwd: dir, env })
      let o = '', e = ''
      const casovac = setTimeout(() => { proc.kill(); reject(new Error('Claude Code: vypršel čas')) }, 10 * 60_000)
      proc.stdout.on('data', (d) => (o += d))
      proc.stderr.on('data', (d) => (e += d))
      proc.on('error', reject)
      proc.on('close', (code) => { clearTimeout(casovac); code === 0 ? resolve(o) : reject(new Error(`Claude Code skončil ${code}: ${(e || o).slice(0, 300)}`)) })
      proc.stdin.end(zadani)
    })
    const r = JSON.parse(out)
    if (r.is_error || !r.structured_output) {
      const err = new Error(`Claude Code bez výsledku: ${r.subtype ?? ''} ${String(r.result ?? '').slice(0, 200)}`)
      err.status = r.api_error_status ?? 'cli' // jako výpadek: e-mail se zkusí znovu příště
      throw err
    }
    return uklid(Rozpoznani.parse(r.structured_output), { _cli: { turns: r.num_turns, duration_ms: r.duration_ms, cost_equiv_usd: r.total_cost_usd, model: Object.keys(r.modelUsage ?? {}) } })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

// KLIMENTS_AI=api přepne zpět na Claude API (placený kredit); výchozí je Claude Code
export function rozpoznej(mail, prilohy, klienti) {
  return (process.env.KLIMENTS_AI === 'api' ? rozpoznejApi : rozpoznejCli)(mail, prilohy, klienti)
}
