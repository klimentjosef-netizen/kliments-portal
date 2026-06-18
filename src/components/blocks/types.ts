/**
 * Block system pro reporty Kliments.
 *
 * Princip: report neuklada hotove HTML, ulozi pole "bloku" v JSON tvaru.
 * Renderer (web nebo budouci mobilni app) pak bloky vykresli nativne.
 *
 * Pridani noveho bloku:
 *   1. Pridat variantu do `Block` union nize.
 *   2. Vytvorit komponentu v ./blocks/{Name}Block.tsx.
 *   3. Zaregistrovat v BLOCK_REGISTRY v BlockRenderer.tsx.
 *
 * Vsechny bloky maji volitelne `id` (pro stabilni keys) a `span` (kolik
 * mrizkovych sloupcu zabira v BlockGrid; default = full row).
 */

export type BlockBase = {
  id?: string
  /** 1..12 sloupcu v 12col gridu; pokud neuvedeno → vsech 12 (cely radek) */
  span?: 1 | 2 | 3 | 4 | 6 | 8 | 12
}

export type HeadingBlock = BlockBase & {
  type: 'heading'
  level: 1 | 2 | 3
  text: string
  /** Volitelny podtitulek pod headingem */
  sub?: string
  /** Volitelne eyebrow nad headingem (uppercase mala) */
  eyebrow?: string
}

export type TextBlock = BlockBase & {
  type: 'text'
  body: string
  /** "muted" = vidi se mene; default je normalni text */
  variant?: 'normal' | 'muted' | 'lead'
}

export type KpiBlock = BlockBase & {
  type: 'kpi'
  label: string
  value: string | number
  /** Podtext pod hodnotou (napr. "stabilni zaklad") */
  sub?: string
  /** Smer trendu (zelena/cervena/nula) */
  trend?: 'up' | 'down' | 'neutral'
  /** Kriticky/poradi-vstup → ramecek a barva indikatoru */
  intent?: 'default' | 'success' | 'warning' | 'critical'
}

export type KpiGridBlock = BlockBase & {
  type: 'kpi-grid'
  items: Omit<KpiBlock, 'type' | 'span'>[]
  /** Pocet sloupcu (default 4 na desktopu) */
  columns?: 2 | 3 | 4
}

export type ProgressBlock = BlockBase & {
  type: 'progress'
  label: string
  value: number
  max: number
  /** Vlevo pod barou, napr. "65 % cilove castky" */
  sub?: string
  /** Barva bary */
  intent?: 'default' | 'success' | 'warning' | 'critical'
}

export type RiskItem = {
  id?: string
  level: 'critical' | 'medium' | 'low'
  title: string
  desc?: string
}
export type RiskListBlock = BlockBase & {
  type: 'risk-list'
  title?: string
  items: RiskItem[]
}

export type StepItem = {
  id?: string
  /** Cislo nebo poradi (napr. "01") */
  num?: string | number
  deadline?: string
  title: string
  desc?: string
  done?: boolean
}
export type StepListBlock = BlockBase & {
  type: 'step-list'
  title?: string
  items: StepItem[]
  /** Layout · vertikalni "casova osa" nebo "karty" */
  layout?: 'timeline' | 'cards'
}

export type TableBlock = BlockBase & {
  type: 'table'
  title?: string
  headers: string[]
  rows: (string | number)[][]
  /** Volitelny footer s souctem / poznamkou */
  footer?: string
}

export type StrengthsWeaknessesBlock = BlockBase & {
  type: 'strengths-weaknesses'
  strengths: string[]
  weaknesses: string[]
}

export type CashflowChartBlock = BlockBase & {
  type: 'cashflow-chart'
  title?: string
  months: string[]
  /** Prijmy a vydaje v Kc po mesicich. Stejna delka jako months. */
  revenue: number[]
  costs: number[]
}

export type CalloutBlock = BlockBase & {
  type: 'callout'
  title?: string
  body: string
  intent?: 'info' | 'success' | 'warning' | 'critical'
}

export type YoyRow = {
  /** Label radku (napr. "Trzby", "EBITDA marze") */
  label: string
  /** Hodnoty pro jednotlive roky ve stejnem poradi jako `years` */
  values: (number | null)[]
  /** Formatovani · currency (Kc), percent, number (raw) */
  format?: 'currency' | 'percent' | 'number'
  /** Highlight tohoto radku (napr. EBITDA, klicovy ukazatel) */
  highlight?: boolean
  /** "vyssi je lepe" pro YoY trend (default true) */
  higherIsBetter?: boolean
}

export type YoyComparisonBlock = BlockBase & {
  type: 'yoy-comparison'
  title?: string
  /** Pole roku (napr. [2024, 2025, 2026]). Posledni je nejnovejsi. */
  years: number[]
  rows: YoyRow[]
  /** Volitelna poznamka pod tabulkou */
  note?: string
}

/** Data completeness: vizualni prehled co je v portalu, co chybi.
 *  Pouziva se napr. behem onboardingu noveho klienta · admin vidi
 *  co uz nahral z RZA podkladu a co je jeste otevreno. */
export type CompletenessCell = {
  /** Status policka */
  status: 'complete' | 'partial' | 'missing'
  /** Volitelny tooltip / popis */
  note?: string
}
export type CompletenessRow = {
  /** Nazev kategorie (napr. "Bankovni vypisy", "DPH priznani") */
  label: string
  /** Pole bunek odpovidajicich `columns` (napr. mesice nebo roky) */
  cells: CompletenessCell[]
}
export type DataCompletenessBlock = BlockBase & {
  type: 'data-completeness'
  title?: string
  /** Sloupcove popisky (napr. ["2024", "2025", "2026 YTD"] nebo mesice) */
  columns: string[]
  rows: CompletenessRow[]
  /** Volitelne shrnuti · napr. "73 % kompletni, chybi 8 polozek" */
  summary?: string
}

/**
 * Sjednoceny union vsech bloku. Pridanim variantky sem se rozsiri cely
 * system; TS pomuze odhalit chybejici implementaci v renderu.
 */
export type Block =
  | HeadingBlock
  | TextBlock
  | KpiBlock
  | KpiGridBlock
  | ProgressBlock
  | RiskListBlock
  | StepListBlock
  | TableBlock
  | StrengthsWeaknessesBlock
  | CashflowChartBlock
  | CalloutBlock
  | YoyComparisonBlock
  | DataCompletenessBlock

export type BlockType = Block['type']
