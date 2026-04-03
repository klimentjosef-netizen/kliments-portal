// ── Pure calculation functions for CFO dashboard ──

export interface Tier {
  name: string
  price: number
  capacity: number
  members: number
  badge?: string
  features: string[]
}

export interface Extra {
  name: string
  quantity: number
  unit_price: number
  unit: string
}

export interface CostItem {
  name: string
  amount: number
}

export interface CapexItem {
  name: string
  planned: number
  spent: number
}

export interface Budget {
  total: number
  capex_budget: number
  reserve_budget: number
  capex_items: CapexItem[]
  reserve_drawn: number
}

export interface Revenue {
  tierRevenue: number
  extraRevenue: number
  total: number
  tierBreakdown: Array<{ name: string; members: number; price: number; revenue: number }>
  extraBreakdown: Array<{ name: string; quantity: number; unit_price: number; revenue: number }>
}

export interface Opex {
  fixed: number
  variable: number
  total: number
}

export interface CashflowMonth {
  label: string
  revenue: number
  costs: number
  ebitda: number
  cumulative: number
}

// ── Revenue ──

export function calcRevenue(tiers: Tier[], extras: Extra[]): Revenue {
  const tierBreakdown = tiers.map(t => ({
    name: t.name,
    members: t.members,
    price: t.price,
    revenue: t.price * t.members,
  }))
  const extraBreakdown = extras.map(e => ({
    name: e.name,
    quantity: e.quantity,
    unit_price: e.unit_price,
    revenue: e.quantity * e.unit_price,
  }))
  const tierRevenue = tierBreakdown.reduce((s, t) => s + t.revenue, 0)
  const extraRevenue = extraBreakdown.reduce((s, e) => s + e.revenue, 0)

  return {
    tierRevenue,
    extraRevenue,
    total: tierRevenue + extraRevenue,
    tierBreakdown,
    extraBreakdown,
  }
}

// ── OPEX ──

export function calcOpex(fixedCosts: CostItem[], variablePct: number, totalRevenue: number): Opex {
  const fixed = fixedCosts.reduce((s, c) => s + c.amount, 0)
  const variable = Math.round(totalRevenue * variablePct / 100)
  return { fixed, variable, total: fixed + variable }
}

// ── EBITDA ──

export function calcEbitda(revenue: Revenue, opex: Opex): number {
  return revenue.total - opex.total
}

// ── Break-even ──

export function calcBreakeven(
  tiers: Tier[],
  fixedCosts: CostItem[],
  variablePct: number
): { members: number; avgPrice: number } {
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  const totalTierRev = tiers.reduce((s, t) => s + t.price * t.members, 0)
  const avgPrice = totalMembers > 0 ? totalTierRev / totalMembers : 0
  const fixedOpex = fixedCosts.reduce((s, c) => s + c.amount, 0)

  const members = avgPrice > 0
    ? Math.ceil(fixedOpex / (avgPrice * (1 - variablePct / 100)))
    : 999

  return { members, avgPrice }
}

// ── CAPEX ROI ──

export function calcCapexRoi(capexBudget: number, monthlyEbitda: number): number {
  if (monthlyEbitda <= 0) return 999
  return Math.round(capexBudget / monthlyEbitda)
}

// ── Scenario table ──

export function calcScenarios(
  tiers: Tier[],
  extras: Extra[],
  fixedCosts: CostItem[],
  variablePct: number,
  memberCounts: number[]
): Array<{ members: number; ebitda: number }> {
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  const rev = calcRevenue(tiers, extras)

  return memberCounts.map(m => {
    const ratio = totalMembers > 0 ? m / totalMembers : 1
    const scaledTierRev = rev.tierRevenue * ratio
    const totalRev = scaledTierRev + rev.extraRevenue
    const opex = calcOpex(fixedCosts, variablePct, totalRev)
    return { members: m, ebitda: totalRev - opex.total }
  })
}

// ── Ramp-up curve ──

export function getRampCurve(months: number, rampMonths: number = 17): number[] {
  return Array.from({ length: months }, (_, i) => {
    if (i >= rampMonths) return 1
    // S-curve: slow start, faster middle, slow finish
    const t = i / rampMonths
    return Math.round((3 * t * t - 2 * t * t * t) * 100) / 100
  })
}

// ── 24-month cashflow projection ──

export function calcCashflowProjection(
  tiers: Tier[],
  extras: Extra[],
  fixedCosts: CostItem[],
  variablePct: number,
  budget: Budget,
  projectionMonths: number = 24,
  rampMonths: number = 17,
  startLabel?: string
): CashflowMonth[] {
  const rev = calcRevenue(tiers, extras)
  const ramp = getRampCurve(projectionMonths, rampMonths)
  const months: CashflowMonth[] = []
  let cumulative = -(budget.capex_budget)

  const monthLabels = getMonthLabels(projectionMonths, startLabel)

  for (let i = 0; i < projectionMonths; i++) {
    const r = ramp[i]
    const mTierRev = Math.round(rev.tierRevenue * r)
    const mExtraRev = Math.round(rev.extraRevenue * r)
    const mRevenue = mTierRev + mExtraRev
    const mOpex = calcOpex(fixedCosts, variablePct, mRevenue)
    const mEbitda = mRevenue - mOpex.total

    cumulative += mEbitda

    months.push({
      label: monthLabels[i],
      revenue: mRevenue,
      costs: mOpex.total,
      ebitda: mEbitda,
      cumulative: Math.round(cumulative),
    })
  }

  return months
}

// ── Helpers ──

function getMonthLabels(count: number, startLabel?: string): string[] {
  const CZ_MONTHS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
  const now = new Date()
  let startMonth = now.getMonth()
  let startYear = now.getFullYear()

  if (startLabel) {
    const idx = CZ_MONTHS.findIndex(m => startLabel.startsWith(m))
    if (idx >= 0) startMonth = idx
    const yearMatch = startLabel.match(/\d{2}$/)
    if (yearMatch) startYear = 2000 + parseInt(yearMatch[0])
  }

  return Array.from({ length: count }, (_, i) => {
    const m = (startMonth + i) % 12
    const y = startYear + Math.floor((startMonth + i) / 12)
    return `${CZ_MONTHS[m]} ${String(y).slice(-2)}`
  })
}

// ── Financial management types ──

export type TransactionCategory = 'revenue' | 'cost' | 'tax' | 'vat' | 'capex' | 'social' | 'health' | 'other'

export interface Transaction {
  id: string
  date: string
  description: string
  category: TransactionCategory
  amount: number       // positive = income, negative = expense
  vat_rate?: number    // 0, 12, 21
  vat_amount?: number
  paid: boolean
  invoice_id?: string
}

export interface ActualMonth {
  month: string        // "2026-04"
  items: Transaction[]
}

export interface Actuals {
  bank_balance: number
  months: ActualMonth[]
}

export interface VatRate {
  service: string
  rate: number
  note: string
}

export interface VatPeriod {
  label: string
  output: number
  input: number
  liability: number
  paid: boolean
  due_date: string
}

export interface VatData {
  registered: boolean
  period: 'monthly' | 'quarterly'
  rates: VatRate[]
  periods: VatPeriod[]
}

export interface TaxAdvance {
  period: string
  amount: number
  due_date: string
  paid: boolean
}

export interface TaxData {
  entity_type: 'sro' | 'osvc'
  income_tax: {
    rate: number
    annual_estimate: number
    advances: TaxAdvance[]
  }
  social: {
    monthly: number
    advances: TaxAdvance[]
  }
  health: {
    monthly: number
    advances: TaxAdvance[]
  }
  other_taxes: Array<{
    name: string
    amount: number
    frequency: 'monthly' | 'quarterly' | 'annual'
    due_date: string
    paid: boolean
  }>
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'
export type BillStatus = 'received' | 'approved' | 'paid' | 'overdue'

export interface Invoice {
  id: string
  number: string
  client: string
  description: string
  amount: number
  vat_rate: number
  vat_amount: number
  total: number
  issued_date: string
  due_date: string
  paid_date?: string
  status: InvoiceStatus
}

export interface Bill {
  id: string
  number: string
  supplier: string
  description: string
  amount: number
  vat_rate: number
  vat_amount: number
  total: number
  received_date: string
  due_date: string
  paid_date?: string
  status: BillStatus
}

export interface ReceivablesData {
  invoices_issued: Invoice[]
  invoices_received: Bill[]
}

// ── Actual cashflow calculations ──

export function calcActualMonth(items: Transaction[]): { income: number; expense: number; net: number } {
  const income = items.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0)
  const expense = items.filter(i => i.amount < 0).reduce((s, i) => s + Math.abs(i.amount), 0)
  return { income, expense, net: income - expense }
}

export function calcActualVsPlanned(
  actuals: ActualMonth[],
  projection: CashflowMonth[]
): Array<{ month: string; planned_revenue: number; actual_revenue: number; planned_costs: number; actual_costs: number }> {
  return projection.map(p => {
    const actual = actuals.find(a => {
      const [y, m] = a.month.split('-').map(Number)
      const CZ = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
      return p.label === `${CZ[m - 1]} ${String(y).slice(-2)}`
    })
    const am = actual ? calcActualMonth(actual.items) : null
    return {
      month: p.label,
      planned_revenue: p.revenue,
      actual_revenue: am?.income ?? 0,
      planned_costs: p.costs,
      actual_costs: am?.expense ?? 0,
    }
  })
}

// ── VAT calculations ──

export function calcVatFromActuals(items: Transaction[]): { output: number; input: number; liability: number } {
  let output = 0
  let input = 0
  for (const item of items) {
    const vat = item.vat_amount ?? 0
    if (item.amount > 0) output += vat
    else input += vat
  }
  return { output, input, liability: output - input }
}

// ── Aging report ──

export function calcAging(invoices: Invoice[], today: string = new Date().toISOString().slice(0, 10)): {
  current: number; d30: number; d60: number; d90: number; d90plus: number; total: number
} {
  const unpaid = invoices.filter(i => i.status !== 'paid')
  let current = 0, d30 = 0, d60 = 0, d90 = 0, d90plus = 0
  const todayMs = new Date(today).getTime()

  for (const inv of unpaid) {
    const dueMs = new Date(inv.due_date).getTime()
    const days = Math.floor((todayMs - dueMs) / 86400000)
    if (days <= 0) current += inv.total
    else if (days <= 30) d30 += inv.total
    else if (days <= 60) d60 += inv.total
    else if (days <= 90) d90 += inv.total
    else d90plus += inv.total
  }

  return { current, d30, d60, d90, d90plus, total: current + d30 + d60 + d90 + d90plus }
}

// ── ID generator ──

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function fmt(n: number): string {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

export function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M Kč'
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + 'k Kč'
  return n.toLocaleString('cs-CZ') + ' Kč'
}
