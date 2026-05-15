# Block library

Modularní stavebnice pro reporty Kliments. Místo aby každý typ reportu měl pevně danou
strukturu, ukládáme jeho obsah jako pole „bloků" v JSONB poli `reports.data.blocks`.
Renderer ([BlockRenderer.tsx](./BlockRenderer.tsx)) je v real-time přeloží na komponenty.

Tahle architektura umožní:

- **Skládat dashboardy klientům na míru** — admin vybere bloky, které dávají smysl.
- **Sdílet jeden zdroj pravdy s mobilní appkou** — iOS/Android stáhne stejný JSON
  a vykreslí ho nativně.
- **Bezpečně přidávat nové typy bloků** — TypeScript exhaustive check nedovolí
  zapomenout na implementaci ve switchi.

## Tvar bloku

Každý blok má `type` jako diskriminátor, volitelné `id` (stabilní React key) a
volitelný `span` (1, 2, 3, 4, 6, 8, 12 — kolik sloupců zabírá v 12-col gridu, default 12).

```ts
import type { Block } from '@/components/blocks/types'

const blocks: Block[] = [
  { type: 'heading', level: 2, eyebrow: 'CFO Q1 2026', text: 'Finanční přehled' },

  {
    type: 'kpi-grid',
    columns: 4,
    items: [
      { label: 'Roční obrat', value: '1,2M Kč', sub: 'stabilní základ' },
      { label: 'Čistá marže', value: '18 %', trend: 'up', intent: 'success' },
      { label: 'Zaměstnanci', value: 3 },
      { label: 'Likvidní rezerva', value: '0,8 mes.', intent: 'critical', sub: '⚠ kritické' },
    ],
  },

  {
    type: 'cashflow-chart',
    title: 'Cashflow: posledních 6 měsíců',
    months: ['Říj', 'Lis', 'Pro', 'Led', 'Úno', 'Bře'],
    revenue: [120000, 105000, 130000, 95000, 110000, 140000],
    costs:   [85000, 90000, 95000, 100000, 92000, 88000],
  },

  {
    type: 'strengths-weaknesses',
    strengths: ['Hrubá marže 68 %', 'Stabilní dodavatelé 5+ let'],
    weaknesses: ['Nulová finanční rezerva pod 1 měsíc', 'Cashflow propad leden–únor'],
  },

  {
    type: 'step-list',
    title: 'Akční plán',
    layout: 'timeline',
    items: [
      { num: 1, deadline: 'Do 5. dubna', title: 'Ověřit živnostenský list', done: true },
      { num: 2, deadline: 'Do 10. dubna', title: 'Registrace k DPH' },
    ],
  },

  {
    type: 'risk-list',
    title: 'Rizika',
    items: [
      { level: 'critical', title: 'Cashflow runway pod 1 měsíc', desc: 'Bez injekce hrozí krize do června.' },
      { level: 'medium', title: 'Závislost na jednom dodavateli', desc: '60 % nákupu z jednoho zdroje.' },
    ],
  },

  { type: 'callout', intent: 'warning', title: 'Pozor', body: 'Faktura 387 000 Kč přes 60 dní po splatnosti.' },
]
```

## Vykreslení

```tsx
import BlockRenderer from '@/components/blocks/BlockRenderer'

export default function Page() {
  return <BlockRenderer blocks={blocks} />
}
```

## Dostupné bloky

| Type | Komponenta | Účel |
|---|---|---|
| `heading` | [HeadingBlock](./HeadingBlock.tsx) | Nadpis 1./2./3. úrovně s volitelným eyebrowem a podtitulkem |
| `text` | [TextBlock](./TextBlock.tsx) | Volný odstavec textu (varianty normal/muted/lead) |
| `kpi` | [KpiBlock](./KpiBlock.tsx) | Jedna KPI karta (label + hodnota + trend + intent) |
| `kpi-grid` | [KpiGridBlock](./KpiGridBlock.tsx) | Mřížka KPI karet (2/3/4 sloupce) |
| `progress` | [ProgressBlock](./ProgressBlock.tsx) | Progress bar s procentuálním splněním |
| `risk-list` | [RiskListBlock](./RiskListBlock.tsx) | Seznam rizik s úrovní (critical/medium/low) |
| `step-list` | [StepListBlock](./StepListBlock.tsx) | Akční kroky jako timeline nebo karty |
| `table` | [TableBlock](./TableBlock.tsx) | Tabulka s headers + řádky |
| `strengths-weaknesses` | [StrengthsWeaknessesBlock](./StrengthsWeaknessesBlock.tsx) | Dvouspolková SWOT (silné × slabé) |
| `cashflow-chart` | [CashflowChartBlock](./CashflowChartBlock.tsx) | Pruhový graf čistého cashflow po měsících |
| `callout` | [CalloutBlock](./CalloutBlock.tsx) | Informační/varovný box (info/success/warning/critical) |

## Jak přidat nový block

1. Přidej `XxxBlock` variantu do `Block` union v [types.ts](./types.ts).
2. Vytvoř komponentu `XxxBlock.tsx` (default export, props typed z `types.ts`).
3. Zaregistruj v `switch` v [BlockRenderer.tsx](./BlockRenderer.tsx).
4. TypeScript ti řekne, jestli jsi něco zapomněl (exhaustive check v `default:`).

## Datový model

V Supabase `reports.data` (JSONB) ukládáme:

```jsonc
{
  "blocks": [...]   // pole Block[]
  // dalsi pole reportu (legacy struktury - zustavaji pro zpetnou kompatibilitu)
}
```

Když `data.blocks` chybí, page komponenta může spadnout zpět na legacy renderování.
Existující reporty tedy zatím fungují stejně; nové (a postupně migrované) půjdou
přes BlockRenderer.
