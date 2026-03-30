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

export function fmt(n: number): string {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

export function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M Kč'
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + 'k Kč'
  return n.toLocaleString('cs-CZ') + ' Kč'
}
