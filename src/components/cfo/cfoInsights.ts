/* eslint-disable @typescript-eslint/no-explicit-any */
// Deterministické postřehy a výpočty pro CFO Klimentíka.
// Žádný LLM · čistá matematika nad daty reportu. Sdíleno mezi API routou
// (proaktivní postřehy + injekce scénářů do kontextu) a klientem.

import { type WhatIfBase, TECHCARS_BASE, calcWhatIfAuto, breakEvenRevenue, ZERO_LEVERS } from './calcWhatIfAuto'

const nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 })
export const kc = (n: number) => nf.format(Math.round(n)) + ' Kč'

export type Insight = {
  id: string
  title: string
  detail: string
  severity: 'good' | 'info' | 'warn' | 'critical'
  prompt: string // co se pošle Klimentíkovi po kliknutí
}

function val(it: any) {
  return it.status === 'paid' || it.status === 'confirmed' ? (it.amount_actual ?? 0) : (it.amount_expected ?? 0)
}

type YearAgg = { year: string; months: number; trzby: number; material: number; marketing?: number; logistika?: number; rezie: number; zisk: number; matPct: number }

export function ledgerByYear(d: any): YearAgg[] {
  const months: any[] = d?.ledger?.months?.filter((m: any) => m.items?.length > 0) || []
  const years = Array.from(new Set(months.map((m) => String(m.month).slice(0, 4)))).sort()
  return years.map((y) => {
    const ms = months.filter((m) => String(m.month).startsWith(y))
    const items = ms.flatMap((m) => m.items)
    const trzby = items.filter((i: any) => i.category === 'revenue' && !i.manualCash).reduce((s: number, i: any) => s + val(i), 0)
    // náklad → kbelík (autoservis materiál/režie i e-shop zboží/marketing/logistika); osobní a keš mimo provoz
    const op = items.filter((i: any) => i.category !== 'revenue' && i.kind !== 'osobni' && !i.manualCash)
    const material = Math.abs(op.filter((i: any) => /zboží|zbozi|materiál|material|díly|dily/i.test(i.description)).reduce((s: number, i: any) => s + val(i), 0))
    const marketing = Math.abs(op.filter((i: any) => /marketing|reklam/i.test(i.description)).reduce((s: number, i: any) => s + val(i), 0))
    const logistika = Math.abs(op.filter((i: any) => /logistik|balné|balne|doprav|přeprav|preprav|brán|brany/i.test(i.description)).reduce((s: number, i: any) => s + val(i), 0))
    const rezie = Math.abs(op.reduce((s: number, i: any) => s + val(i), 0)) - material - marketing - logistika
    const zisk = trzby - material - marketing - logistika - rezie
    return { year: y, months: ms.length, trzby, material, marketing, logistika, rezie, zisk, matPct: trzby > 0 ? (material / trzby) * 100 : 0 }
  })
}

function industryString(d: any): string {
  return `${d?.business_profile?.industry || ''} ${d?.subtitle || ''} ${d?.title || ''}`.toLowerCase()
}

// Orientační pásma materiálové náročnosti podle oboru (materiál/díly jako % tržeb).
type Bands = { goodMax: number; healthyMax: number; edgeMax: number; label: string }
function materialBands(d: any): Bands {
  const s = industryString(d)
  if (/servis|auto|pneu|mechan|díln/.test(s)) return { goodMax: 50, healthyMax: 58, edgeMax: 63, label: 'autoservis' }
  if (/eshop|e-shop|ecommerce|retail|obchod|velkoobchod|prodej zbož/.test(s)) return { goodMax: 60, healthyMax: 72, edgeMax: 78, label: 'e-commerce / retail' }
  if (/gastro|restaur|kavár|bistro|jídl|kuchy|hospod|pivnic/.test(s)) return { goodMax: 28, healthyMax: 35, edgeMax: 42, label: 'gastro' }
  if (/výrob|manufakt|produkc|truhlář|kovo|strojír/.test(s)) return { goodMax: 45, healthyMax: 60, edgeMax: 68, label: 'výroba' }
  if (/služ|konzult|agentur|marketing|softwar|\bit\b|vývoj|advok|projekč/.test(s)) return { goodMax: 15, healthyMax: 30, edgeMax: 42, label: 'služby' }
  return { goodMax: 40, healthyMax: 55, edgeMax: 65, label: '' }
}
function materialVerdict(matPct: number, b: Bands): { sev: Insight['severity']; word: string } {
  if (matPct <= b.goodMax) return { sev: 'good', word: 'výborná' }
  if (matPct <= b.healthyMax) return { sev: 'info', word: 'zdravá' }
  if (matPct <= b.edgeMax) return { sev: 'warn', word: 'na hraně' }
  return { sev: 'critical', word: 'vysoká' }
}

const SEV_RANK: Record<Insight['severity'], number> = { critical: 0, warn: 1, info: 2, good: 3 }

// Hlavní proaktivní postřehy · seřazené dle závažnosti, max 4.
export function buildInsights(d: any): Insight[] {
  const cy = new Date().getFullYear()
  const years = ledgerByYear(d)
  const out: Insight[] = []

  // 1) Nudge na živá data, když letošek nemá nic
  const hasCurrent = years.some((y) => Number(y.year) >= cy && y.months > 0)
  if (!hasCurrent) {
    out.push({
      id: 'nudge-live',
      title: `Letošní rok ${cy} zatím nemá živá data`,
      detail: 'Vidíme jen uzavřené roky (historie). Doplňte poslední uzavřený měsíc v záložce „Doplnit data" · stačí tři čísla a uvidíte aktuální stav, ne jen minulost.',
      severity: 'info',
      prompt: `Letos zatím nemám data. Co mi říká poslední uzavřený rok a na co si mám letos dát pozor?`,
    })
  }

  const closed = years.filter((y) => Number(y.year) < cy)
  const last = closed[closed.length - 1] || years[years.length - 1]

  // 2) Ziskovost posledního uzavřeného roku
  if (last) {
    if (last.zisk < 0) {
      out.push({
        id: 'loss',
        title: `Firma byla ve ztrátě (${last.year})`,
        detail: `Provozní výsledek ${kc(last.zisk)} při tržbách ${kc(last.trzby)}. To je hlavní věc k řešení.`,
        severity: 'critical',
        prompt: `Proč byla firma v roce ${last.year} ve ztrátě a co konkrétně s tím můžu udělat?`,
      })
    } else {
      out.push({
        id: 'profit',
        title: `Provozní zisk ${kc(last.zisk)} (${last.year})`,
        detail: `Při tržbách ${kc(last.trzby)}. Zisková marže ${Math.round((last.zisk / last.trzby) * 100)} %.`,
        severity: 'good',
        prompt: `Jak hodnotíš ziskovost firmy v roce ${last.year} a kde je prostor ji zlepšit?`,
      })
    }

    // 3) Materiálová náročnost vs benchmark oboru
    if (last.matPct > 0) {
      const bands = materialBands(d)
      const v = materialVerdict(last.matPct, bands)
      const bench = ` Zdravé pásmo${bands.label ? ` pro ${bands.label}` : ''} je zhruba ${bands.goodMax} až ${bands.healthyMax} % (orientačně).`
      out.push({
        id: 'material',
        title: `Materiálová náročnost ${Math.round(last.matPct)} % · ${v.word}`,
        detail: `Materiál a díly spolknou ${Math.round(last.matPct)} % tržeb (${last.year}).${bench}`,
        severity: v.sev,
        prompt: `Materiálová náročnost je ${Math.round(last.matPct)} %. Je to moc? Jak ji snížit a co to udělá se ziskem?`,
      })
    }
  }

  // 4) Break-even vs realita (pokud máme model)
  const base = scenarioBase(d)
  if (base && last) {
    const be = breakEvenRevenue(base, ZERO_LEVERS)
    if (isFinite(be)) {
      const gap = last.trzby - be
      if (gap < 0) {
        out.push({
          id: 'breakeven',
          title: `Tržby pod hranicí rentability`,
          detail: `Na nulu firma potřebuje ~${kc(be)} tržeb, loni měla ${kc(last.trzby)} · chybělo ~${kc(Math.abs(gap))}.`,
          severity: 'warn',
          prompt: `Kolik potřebuju tržeb nebo o kolik snížit náklady, abych byl na nule a pak v zisku?`,
        })
      }
    }
  }

  // 5) ŽIVÉ ALERTY · jen když letošní rok má data (rozsvítí se samy po doplnění)
  const cur = years.find((y) => Number(y.year) >= cy && y.months > 0)
  if (cur) {
    if (cur.zisk < 0) {
      out.push({
        id: 'live-loss',
        title: `Letos jsi zatím ve ztrátě (${cur.months}/12 měsíců)`,
        detail: `Provozní výsledek ${kc(cur.zisk)} za ${cur.months} měsíců ${cy}. Stojí za to zabrzdit hned, ne až na konci roku.`,
        severity: 'critical',
        prompt: `Letos jsem zatím ve ztrátě. Co ji žene a co s tím udělat teď?`,
      })
    }
    if (base) {
      const planMonthZisk = ((base.annual_revenue + base.other_income) - base.annual_revenue * base.material_pct / 100 - base.fixed_annual) / 12
      const actualMonthZisk = cur.zisk / cur.months
      if (planMonthZisk > 0 && actualMonthZisk < planMonthZisk * 0.8) {
        out.push({
          id: 'live-vs-plan',
          title: `Letošní zisk pod plánem`,
          detail: `Vycházíš na ~${kc(actualMonthZisk)}/měsíc, plán je ~${kc(planMonthZisk)}/měsíc. Zaostáváš o ~${Math.round((1 - actualMonthZisk / planMonthZisk) * 100)} %.`,
          severity: 'warn',
          prompt: `Letošní zisk za měsíc je pod plánem. Kde to ztrácím a jak to dohnat?`,
        })
      }
      if (cur.matPct - base.material_pct >= 3) {
        out.push({
          id: 'live-material',
          title: `Letošní materiálová náročnost roste`,
          detail: `Letos ${Math.round(cur.matPct)} %, model počítá s ${base.material_pct} %. Každý bod navíc ukrajuje z marže.`,
          severity: 'warn',
          prompt: `Materiálová náročnost mi letos roste proti modelu. Co s tím?`,
        })
      }
    }
  }

  // 6) Trend materiálové náročnosti mezi roky
  if (closed.length >= 2) {
    const a = closed[closed.length - 2], b = closed[closed.length - 1]
    const diff = b.matPct - a.matPct
    if (Math.abs(diff) >= 2) {
      out.push({
        id: 'mat-trend',
        title: `Materiálová náročnost ${diff > 0 ? 'roste' : 'klesá'} (${a.year}→${b.year})`,
        detail: `Z ${Math.round(a.matPct)} % na ${Math.round(b.matPct)} % (${diff > 0 ? '+' : ''}${Math.round(diff)} b.). ${diff > 0 ? 'Pozor · ukrajuje to z marže.' : 'Dobře · marže se zlepšuje.'}`,
        severity: diff > 0 ? 'warn' : 'good',
        prompt: `Materiálová náročnost se mezi ${a.year} a ${b.year} změnila o ${Math.round(diff)} b. Co za tím může být?`,
      })
    }
  }

  return out.sort((x, y) => SEV_RANK[x.severity] - SEV_RANK[y.severity]).slice(0, 4)
}

// Báze pro výpočty Co kdyby · jen když report má whatif_base s tržbami.
export function scenarioBase(d: any): WhatIfBase | null {
  const wb = d?.whatif_base
  if (!wb || !wb.annual_revenue) return null
  return { ...TECHCARS_BASE, ...wb }
}

// Textový blok scénářů pro kontext chatu · Klimentík díky tomu odpovídá
// na „co kdyby" reálnými čísly, ne odhadem.
export function scenarioContext(d: any): string {
  const base = scenarioBase(d)
  if (!base) return ''
  const baseRes = calcWhatIfAuto(base, ZERO_LEVERS)
  const be = breakEvenRevenue(base, ZERO_LEVERS)
  const row = (label: string, lev: Partial<typeof ZERO_LEVERS>) => {
    const r = calcWhatIfAuto(base, { ...ZERO_LEVERS, ...lev })
    const delta = r.ebitda - baseRes.ebitda
    return `  · ${label}: EBITDA ${kc(r.ebitda)} (${delta >= 0 ? '+' : ''}${kc(delta)} oproti dnešku)`
  }
  return [
    `## SPOČÍTANÉ SCÉNÁŘE (přesná čísla z modelu · používej je u dotazů „co kdyby“)`,
    `Výchozí stav (model): roční tržby ${kc(base.annual_revenue)}, materiálová náročnost ${base.material_pct} %, fixní náklady ${kc(base.fixed_annual)}, dnešní EBITDA ${kc(baseRes.ebitda)}.`,
    `Hranice rentability (EBIT = 0): tržby ~${kc(be)}.`,
    `Dopady jednotlivých pák na roční EBITDA:`,
    row('marže na dílech lepší o 2 p.b.', { material_pp: 2 }),
    row('marže na dílech lepší o 4 p.b.', { material_pp: 4 }),
    row('tržby +4 %', { revenue_pct: 4 }),
    row('tržby +8 %', { revenue_pct: 8 }),
    row('hodinová sazba +5 %', { hourly_pct: 5 }),
    row('hodinová sazba +10 %', { hourly_pct: 10 }),
    row('fixní náklady −100 000 Kč/rok', { fixed_delta: -100000 }),
    `Pozn.: jde o modelové scénáře, ne realitu · při odpovědi to připomeň a odkaž na záložku „Co kdyby“.`,
  ].join('\n')
}

// Krátké shrnutí postřehů do kontextu chatu (ať na ně Klimentík umí navázat).
export function insightsContext(d: any): string {
  const ins = buildInsights(d)
  if (ins.length === 0) return ''
  return ['## CO JSEM SI VŠIML V DATECH (proaktivní postřehy)', ...ins.map((i) => `  · [${i.severity}] ${i.title} — ${i.detail}`)].join('\n')
}
