/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// CFO kecálek · živý průvodce klienta jeho vlastní firmou.
// Uzemněný VÝHRADNĚ v datech reportu klienta (žádné vymýšlení čísel).
// Důsledně odděluje uzavřené roky (informativní posouzení) od živé verze.
// Model: claude-opus-4-8, adaptivní thinking, streamovaná odpověď.

export const runtime = 'nodejs'
export const maxDuration = 60

type Msg = { role: 'user' | 'assistant'; content: string }

const fmtKc = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Kč'

function val(it: { status?: string; amount_actual?: number; amount_expected?: number }) {
  return it.status === 'paid' || it.status === 'confirmed'
    ? (it.amount_actual ?? 0)
    : (it.amount_expected ?? 0)
}

// Per-rok P&L z ledgeru · stejná logika jako záložka Hospodaření.
function ledgerPnl(ledger: any): string {
  const months: any[] = ledger?.months?.filter((m: any) => m.items?.length > 0) || []
  if (months.length === 0) return 'Žádná uzavřená data hospodaření v ledgeru.'
  const years = Array.from(new Set(months.map((m) => String(m.month).slice(0, 4)))).sort()
  const lines: string[] = []
  for (const y of years) {
    const items = months.filter((m) => String(m.month).startsWith(y)).flatMap((m) => m.items)
    const trzby = items.filter((i: any) => i.category === 'revenue').reduce((s: number, i: any) => s + val(i), 0)
    const material = Math.abs(items.filter((i: any) => /materiál/i.test(i.description)).reduce((s: number, i: any) => s + val(i), 0))
    const rezie = Math.abs(items.filter((i: any) => /mzd|režie/i.test(i.description)).reduce((s: number, i: any) => s + val(i), 0))
    const zisk = trzby - material - rezie
    const matPct = trzby > 0 ? Math.round((material / trzby) * 100) : 0
    const mCount = months.filter((m) => String(m.month).startsWith(y) && m.items.length > 0).length
    lines.push(
      `  Rok ${y} (${mCount} měsíců): tržby ${fmtKc(trzby)}, materiál a díly ${fmtKc(material)} (${matPct} % tržeb), mzdy+režie ${fmtKc(rezie)}, provozní zisk ${fmtKc(zisk)}.`
    )
  }
  return lines.join('\n')
}

// Bloky drží ověřený CFO obraz (cash bridge, předlužení, plán, rizika).
// Serializace na čitelný text · zdroj pravdy pro odpovědi.
function serializeBlocks(blocks: any[], label: string): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return ''
  const out: string[] = [`## ${label}`]
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        out.push(`### ${b.text}${b.sub ? ` — ${b.sub}` : ''}`)
        break
      case 'text':
        if (b.body) out.push(b.body)
        break
      case 'callout':
        out.push(`[${(b.intent || 'info').toUpperCase()}] ${b.title ? b.title + ': ' : ''}${b.body || ''}`)
        break
      case 'kpi':
        out.push(`- ${b.label}: ${b.value}${b.sub ? ` (${b.sub})` : ''}`)
        break
      case 'kpi-grid':
        for (const it of b.items || []) out.push(`- ${it.label}: ${it.value}${it.sub ? ` (${it.sub})` : ''}`)
        break
      case 'table':
        if (b.title) out.push(`Tabulka: ${b.title}`)
        out.push((b.headers || []).join(' | '))
        for (const r of b.rows || []) out.push((r || []).join(' | '))
        if (b.footer) out.push(`(${b.footer})`)
        break
      case 'yoy-comparison':
        out.push(`Meziroční srovnání ${b.title || ''} [roky: ${(b.years || []).join(', ')}]`)
        for (const r of b.rows || []) out.push(`- ${r.label}: ${(r.values || []).join(', ')}`)
        if (b.note) out.push(`(${b.note})`)
        break
      case 'risk-list':
        out.push(`Rizika${b.title ? ` (${b.title})` : ''}:`)
        for (const it of b.items || []) out.push(`- [${it.level}] ${it.title}${it.desc ? ': ' + it.desc : ''}`)
        break
      case 'step-list':
        out.push(`Plán / kroky${b.title ? ` (${b.title})` : ''}:`)
        for (const it of b.items || []) out.push(`- ${it.num ? it.num + '. ' : ''}${it.title}${it.deadline ? ` [${it.deadline}]` : ''}${it.desc ? ': ' + it.desc : ''}`)
        break
      case 'strengths-weaknesses':
        out.push('Silné stránky: ' + (b.strengths || []).join('; '))
        out.push('Slabé stránky: ' + (b.weaknesses || []).join('; '))
        break
      case 'cashflow-chart':
        out.push(`Cashflow graf ${b.title || ''} po měsících (${(b.months || []).length} měsíců).`)
        break
      default:
        break
    }
  }
  return out.join('\n')
}

function buildContext(d: any, clientName: string): string {
  const bp = d.business_profile || {}
  const wb = d.whatif_base || {}
  const cy = new Date().getFullYear()

  const profileLines = [
    `Firma: ${clientName || d.subtitle || 'klient'}`,
    bp.industry && `Obor: ${bp.industry}`,
    bp.entity_type && `Forma: ${bp.entity_type}`,
    typeof bp.vat_payer === 'boolean' && `Plátce DPH: ${bp.vat_payer ? 'ano' : 'ne'}`,
    bp.employees && `Zaměstnanci: ${bp.employees}`,
  ].filter(Boolean).join(' · ')

  const whatifLines = Object.keys(wb).length
    ? [
        `Roční tržby (model): ${fmtKc(wb.annual_revenue || 0)}`,
        `Materiálová náročnost: ${wb.material_pct ?? '?'} %`,
        `Ostatní výnosy: ${fmtKc(wb.other_income || 0)}`,
        `Fixní náklady vč. odpisů (rok): ${fmtKc(wb.fixed_annual || 0)}`,
        `Odpisy (rok): ${fmtKc(wb.depreciation_annual || 0)}`,
      ].join('\n')
    : 'Model Co kdyby zatím nenastaven.'

  return [
    `# KONTEXT FIRMY (jediný zdroj pravdy — neuváděj čísla, která zde nejsou)`,
    profileLines,
    '',
    `## ČASOVÝ KONTEXT`,
    `Dnešní rok je ${cy}. Uzavřené roky jsou historické, informativní (posouzení minulosti). Rok ${cy} je živá verze — pokud pro něj v datech nejsou měsíce, znamená to, že klient zatím letošní data nedodal; nikdy si je nevymýšlej ani neodhaduj jako fakt.`,
    '',
    `## HOSPODAŘENÍ PO LETECH (skutečnost z ledgeru)`,
    ledgerPnl(d.ledger || {}),
    '',
    `## VÝCHOZÍ ČÍSLA PRO MODEL „CO KDYBY“`,
    whatifLines,
    '',
    serializeBlocks(d.blocks_overview || d.blocks || [], 'PŘEHLED — analýza a plán ozdravení'),
    '',
    serializeBlocks(d.blocks_cash || [], 'PENÍZE — tok hotovosti / cash bridge'),
    '',
    serializeBlocks(d.blocks_pnl || [], 'HOSPODAŘENÍ — charakter příjmů a nákladů'),
  ].filter((s) => s !== '').join('\n')
}

const SYSTEM_INTRO = `Jsi „CFO průvodce“ — špičkový finanční ředitel a klidný, srozumitelný parťák majitele firmy v portálu Kliments. Mluvíš česky, lidsky, bez žargonu; cizí termín hned vysvětlíš.

Tvoje role:
· Pomáháš majiteli zorientovat se v jeho VLASTNÍ firmě na základě dat níže.
· Odpovídáš stručně a k věci. Vede tě závěr, ne dlouhý výčet. Když má smysl doporučení, dej jedno jasné, ne přehlídku možností.
· Čísla bereš VÝHRADNĚ z kontextu níže. Nikdy si nevymýšlej ani neodhaduj částky. Když odpověď v datech není, řekni to rovně a navrhni, kde ji v portálu doplnit (záložky: Přehled, Hospodaření, Peníze, Co kdyby, Doplnit data).
· Důsledně odděluj UZAVŘENÉ roky (minulost, informativní posouzení) od ŽIVÉ verze letošního roku. Když pro letošek nejsou data, jasně řekni, že jde o historický obraz, ne o aktuální stav.
· U modelových výpočtů („co kdyby zvednu sazbu o X“) vždy připomeň, že jde o scénář, ne o realitu, a odkaž na záložku Co kdyby.

Styl psaní:
· Začni odpovědí na otázku, pak teprve detail.
· Žádné pomlčky „—“ ani „–“; místo nich používej tečku oddělovač „·“, dvojtečku nebo lomítko. Mínus „−“ jen u záporných čísel.
· Krátké odstavce, případně odrážky. Maximálně pár vět, pokud uživatel nechce víc.
· Buď upřímný: když firma má problém (např. ztráta, předlužení), pojmenuj ho věcně a nabídni další krok.

Nikdy nepředstírej přístup k živým bankovním účtům ani k datům, která nejsou v kontextu.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      'Kecálek zatím není aktivní · chybí klíč k AI. Doplň ho v nastavení portálu a zkuste to znovu.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
  }

  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { clientId?: string; messages?: Msg[] }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const messages = (body.messages || []).filter((m) => m && m.content?.trim()).slice(-12)
  if (messages.length === 0) return new Response('Bad request', { status: 400 })

  // Cílový klient · admin smí přes ?client=, jinak vlastní report. RLS hlídá přístup.
  let targetId = user.id
  let clientName = ''
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'admin' && body.clientId) {
    targetId = body.clientId
    const { data: cp } = await supabase.from('profiles').select('name').eq('id', body.clientId).single()
    if (cp) clientName = cp.name
  }

  const { data: report } = await supabase
    .from('reports').select('data').eq('client_id', targetId).eq('type', 'cfo')
    .order('created_at', { ascending: false }).limit(1).single()

  if (!report) return new Response('Report nenalezen', { status: 404 })

  const context = buildContext(report.data, clientName)
  const system = [
    { type: 'text' as const, text: SYSTEM_INTRO },
    { type: 'text' as const, text: context, cache_control: { type: 'ephemeral' as const } },
  ]

  const client = new Anthropic()
  const anthropicMessages = messages.map((m) => ({ role: m.role, content: m.content }))

  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system,
    messages: anthropicMessages,
  })

  const encoder = new TextEncoder()
  const rs = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (e) {
        console.error('[cfo-assistant] stream error:', e)
        controller.enqueue(encoder.encode('\n\n[Omlouvám se · spojení se přerušilo. Zkuste prosím dotaz znovu.]'))
      }
      controller.close()
    },
  })

  return new Response(rs, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
