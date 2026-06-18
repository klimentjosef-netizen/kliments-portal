// Vloží do TechCars reportu blok "Stav nasazení + co dodat" (na začátek Přehledu).
// Idempotentní (přepíše bloky s id 'onb-*'). Záloha před zápisem. Bez deploye.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const REPORT_ID = 'cd2556ba-3480-42cb-934b-f98944fdd97b'

const { data: report, error } = await admin.from('reports').select('id, data').eq('id', REPORT_ID).single()
if (error) { console.error('load:', error.message); process.exit(1) }
const d = report.data

// záloha
mkdirSync(new URL('../backups/', import.meta.url), { recursive: true })
const backup = new URL(`../backups/report-${REPORT_ID}-before-onboarding-block.json`, import.meta.url)
writeFileSync(backup, JSON.stringify(report, null, 2))
console.log('Záloha:', backup.pathname)

const C = (status, note) => (note ? { status, note } : { status })
const cols = ['2024', '2025', '2026']

const onboardingBlocks = [
  { id: 'onb-h', type: 'heading', level: 2, eyebrow: 'Stav nasazení', text: 'Portál je živý · a teď ho rozsvítíme naživo', sub: 'Co je hotové, co od vás ještě potřebujeme a jak půjdeme do ostrého provozu.' },

  { id: 'onb-done', type: 'callout', intent: 'success', title: 'Hotové a napojené',
    body: 'Roky 2024 a 2025 jsou kompletně zpracované a striktně oddělené jako historie. Máte hotový finanční obraz · hospodaření po letech, tok hotovosti (cash bridge), rizika i plán ozdravení. NOVĚ je v portálu napojený AI poradce „CFO Klimentík" · rozumí číslům vaší firmy, sám upozorní na to podstatné a odpoví na dotazy typu „co kdyby zvednu hodinovku o 10 %". Najdete ho vpravo dole na záložce CFO.' },

  { id: 'onb-wait', type: 'callout', intent: 'info', title: 'Než přepneme na živý měsíční režim',
    body: 'Zbývají dvě věci. (1) Spustit data za rok 2026 · po uzávěrce každého měsíce stačí v záložce „Doplnit data" zadat tři čísla (tržby, materiál a díly, mzdy a režie) a portál se rozsvítí naživo. (2) Pár podkladů níže, ať model sedí na korunu. Projděte prosím seznam a napište nám, co z toho máte po ruce.' },

  { id: 'onb-need', type: 'data-completeness', title: 'Co od vás ještě potřebujeme · seřazeno dle důležitosti', columns: cols,
    summary: 'Bez bankovních výpisů jedeme jen z pokladny · proto je to priorita číslo jedna.',
    rows: [
      { label: '1. Bankovní výpisy (běžný účet)', cells: [C('missing'), C('missing'), C('missing', 'průběžně')] },
      { label: '2. Přiznání k DPH', cells: [C('missing'), C('missing'), C('missing')] },
      { label: '3. Měsíční obratová předvaha (účty 5xx)', cells: [C('partial', 'máme roční'), C('partial', 'máme roční'), C('missing')] },
      { label: '4. Splátkové kalendáře úvěrů a leasingů', cells: [C('missing'), C('missing'), C('missing')] },
      { label: '5. Rozpad tržeb: práce vs díly', cells: [C('missing', 'teď odhad 40 %'), C('missing'), C('missing')] },
      { label: '6. Knihy faktur za 2024', cells: [C('missing'), C('complete'), C('missing')] },
    ] },

  { id: 'onb-have', type: 'data-completeness', title: 'Co už máme zpracované', columns: cols,
    summary: '2024 a 2025 hotové · prázdný sloupec 2026 je přesně to, co teď spolu rozsvítíme.',
    rows: [
      { label: 'Výkaz zisku a ztráty', cells: [C('complete'), C('complete'), C('missing')] },
      { label: 'Rozvaha (aktiva i pasiva)', cells: [C('complete'), C('complete'), C('missing')] },
      { label: 'Mzdová rekapitulace', cells: [C('complete'), C('complete'), C('missing')] },
      { label: 'Pokladní deník', cells: [C('complete'), C('complete'), C('missing')] },
      { label: 'Open pohledávky / závazky', cells: [C('missing'), C('complete'), C('missing')] },
      { label: 'Daňové přiznání (DPPO)', cells: [C('complete'), C('complete'), C('missing')] },
    ] },

  { id: 'onb-steps', type: 'step-list', title: 'Další kroky', layout: 'timeline',
    items: [
      { num: '1', title: 'Projděte seznam „Co potřebujeme" a napište, co máte', desc: 'Stačí krátká odpověď u každé položky · mám / nemám / dohledám.' },
      { num: '2', title: 'Pošlete bankovní výpisy 2024 a 2025', desc: 'Priorita · odemknou reálný tok peněz, ne jen pokladnu.', deadline: 'Priorita' },
      { num: '3', title: 'Po uzávěrce každého měsíce 2026 doplňte tři čísla', desc: 'Záložka „Doplnit data" · tím portál přejde z historie do živého režimu.' },
    ] },
]

const existing = (d.blocks_overview || d.blocks || []).filter((b) => !(b.id || '').startsWith('onb-'))
d.blocks_overview = [...onboardingBlocks, ...existing]

const { error: upErr } = await admin.from('reports').update({ data: d }).eq('id', REPORT_ID)
if (upErr) { console.error('update:', upErr.message); process.exit(1) }
console.log('Hotovo · vloženo', onboardingBlocks.length, 'bloků na začátek Přehledu. blocks_overview má teď', d.blocks_overview.length, 'bloků.')
