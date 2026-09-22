// Claude přečte e-mail a jeho přílohy: co to je, komu to patří, co je potřeba udělat,
// a z každého dokladu vytěží údaje pro evidenci.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

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

export async function rozpoznej(mail, prilohy, klienti) {
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
  const prazdne = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === '' ? null : v]))
  const out = res.parsed_output
  return { ...prazdne(out), doklady: out.doklady.map(prazdne), _usage: res.usage, _model: res.model }
}
