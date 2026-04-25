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

// ══════════════════════════════════════════════
// ── Smart vCFO: Ledger types ──
// ══════════════════════════════════════════════

export type ExpectedSource = 'tier_revenue' | 'extra_revenue' | 'fixed_cost' | 'tax_advance' | 'social' | 'health' | 'vat_payment' | 'invoice' | 'bill' | 'manual'
export type ItemStatus = 'expected' | 'confirmed' | 'paid' | 'skipped'

export interface LedgerItem {
  id: string
  date: string
  description: string
  category: TransactionCategory
  source: ExpectedSource
  source_id?: string
  amount_expected: number
  amount_actual: number
  vat_rate?: number
  vat_amount?: number
  status: ItemStatus
}

export interface MonthLedger {
  month: string
  items: LedgerItem[]
  locked: boolean
}

export interface Ledger {
  bank_balance: number
  months: MonthLedger[]
}

export interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  detail?: string
  tab?: string
}

// ── Ledger: auto-generation ──

export function generateExpectedItems(
  month: string,
  tiers: Tier[],
  extras: Extra[],
  fixedCosts: CostItem[],
  taxes: TaxData,
  vat: VatData,
  rampFactor: number = 1,
): LedgerItem[] {
  const items: LedgerItem[] = []
  const firstOfMonth = `${month}-01`

  // Tier revenue
  for (const t of tiers) {
    if (t.members <= 0 || t.price <= 0) continue
    const amount = Math.round(t.price * t.members * rampFactor)
    items.push({
      id: genId(),
      date: firstOfMonth,
      description: `${t.name} (${t.members} × ${t.price.toLocaleString('cs-CZ')} Kč)`,
      category: 'revenue',
      source: 'tier_revenue',
      source_id: t.name,
      amount_expected: amount,
      amount_actual: 0,
      vat_rate: 12,
      vat_amount: Math.round(amount - amount / 1.12),
      status: 'expected',
    })
  }

  // Extra revenue
  for (const e of extras) {
    if (e.quantity <= 0 || e.unit_price <= 0) continue
    const amount = Math.round(e.quantity * e.unit_price * rampFactor)
    items.push({
      id: genId(),
      date: firstOfMonth,
      description: `${e.name} (${e.quantity} × ${e.unit_price.toLocaleString('cs-CZ')} Kč)`,
      category: 'revenue',
      source: 'extra_revenue',
      source_id: e.name,
      amount_expected: amount,
      amount_actual: 0,
      vat_rate: 21,
      vat_amount: Math.round(amount - amount / 1.21),
      status: 'expected',
    })
  }

  // Fixed costs
  for (const c of fixedCosts) {
    if (c.amount <= 0) continue
    items.push({
      id: genId(),
      date: firstOfMonth,
      description: c.name,
      category: 'cost',
      source: 'fixed_cost',
      source_id: c.name,
      amount_expected: -c.amount,
      amount_actual: 0,
      status: 'expected',
    })
  }

  // Social insurance
  if (taxes.social.monthly > 0) {
    items.push({
      id: genId(),
      date: firstOfMonth,
      description: 'Sociální pojištění',
      category: 'social',
      source: 'social',
      amount_expected: -taxes.social.monthly,
      amount_actual: 0,
      status: 'expected',
    })
  }

  // Health insurance
  if (taxes.health.monthly > 0) {
    items.push({
      id: genId(),
      date: firstOfMonth,
      description: 'Zdravotní pojištění',
      category: 'health',
      source: 'health',
      amount_expected: -taxes.health.monthly,
      amount_actual: 0,
      status: 'expected',
    })
  }

  // Income tax advances (check if any fall in this month)
  for (const adv of taxes.income_tax.advances) {
    if (adv.due_date && adv.due_date.startsWith(month) && adv.amount > 0) {
      items.push({
        id: genId(),
        date: adv.due_date,
        description: `Záloha na daň z příjmů: ${adv.period}`,
        category: 'tax',
        source: 'tax_advance',
        source_id: adv.period,
        amount_expected: -adv.amount,
        amount_actual: 0,
        status: 'expected',
      })
    }
  }

  // VAT payment (quarterly: months 3, 6, 9, 12)
  if (vat.registered) {
    const monthNum = parseInt(month.split('-')[1])
    const isQuarterEnd = vat.period === 'quarterly' && monthNum % 3 === 0
    const isMonthlyVat = vat.period === 'monthly'
    if (isQuarterEnd || isMonthlyVat) {
      // Find matching period
      const period = vat.periods.find(p => {
        if (!p.due_date) return false
        return p.due_date.startsWith(month)
      })
      if (period && period.liability !== 0 && !period.paid) {
        items.push({
          id: genId(),
          date: period.due_date || firstOfMonth,
          description: `DPH: ${period.label}`,
          category: 'vat',
          source: 'vat_payment',
          source_id: period.label,
          amount_expected: -Math.abs(period.liability),
          amount_actual: 0,
          status: 'expected',
        })
      }
    }
  }

  return items
}

export function mergeExpectedWithExisting(generated: LedgerItem[], existing: LedgerItem[]): LedgerItem[] {
  const result = [...existing]

  for (const gen of generated) {
    // Match by source + source_id + description for reliable identification
    const match = result.find(e =>
      e.source === gen.source &&
      e.source_id === gen.source_id &&
      (e.source_id != null || e.description === gen.description)
    )

    if (match) {
      // Only update if expected AND amount hasn't been manually changed
      if (match.status === 'expected' && match.amount_expected === match.amount_actual) {
        match.amount_expected = gen.amount_expected
        match.description = gen.description
        match.vat_rate = gen.vat_rate
        match.vat_amount = gen.vat_amount
      }
      // If confirmed/paid/skipped or manually edited, leave it alone
    } else {
      // New item, add it
      result.push(gen)
    }
  }

  return result
}

export function migrateActualsToLedger(oldActuals: Actuals): Ledger {
  const months: MonthLedger[] = oldActuals.months.map(m => ({
    month: m.month,
    locked: false,
    items: m.items.map(t => ({
      id: t.id,
      date: t.date,
      description: t.description,
      category: t.category,
      source: 'manual' as ExpectedSource,
      amount_expected: t.amount,
      amount_actual: t.amount,
      vat_rate: t.vat_rate,
      vat_amount: t.vat_amount,
      status: (t.paid ? 'paid' : 'confirmed') as ItemStatus,
    })),
  }))
  return { bank_balance: oldActuals.bank_balance, months }
}

// ── Ledger: calculations ──

export function calcLedgerMonth(items: LedgerItem[]): {
  expected_income: number; expected_expense: number; expected_net: number
  actual_income: number; actual_expense: number; actual_net: number
  variance_pct: number
} {
  let ei = 0, ee = 0, ai = 0, ae = 0
  for (const item of items) {
    if (item.amount_expected > 0) ei += item.amount_expected
    else ee += Math.abs(item.amount_expected)

    if (item.status === 'confirmed' || item.status === 'paid') {
      if (item.amount_actual > 0) ai += item.amount_actual
      else ae += Math.abs(item.amount_actual)
    }
  }
  const en = ei - ee
  const an = ai - ae
  const variance_pct = en !== 0 ? Math.round((an - en) / Math.abs(en) * 100) : 0

  return {
    expected_income: ei, expected_expense: ee, expected_net: en,
    actual_income: ai, actual_expense: ae, actual_net: an,
    variance_pct,
  }
}

export function calcCashPosition(
  bankBalance: number,
  ledger: Ledger,
  monthsAhead: number = 6
): Array<{ month: string; opening: number; expected_in: number; expected_out: number; closing: number }> {
  const result: Array<{ month: string; opening: number; expected_in: number; expected_out: number; closing: number }> = []
  let balance = bankBalance
  const now = new Date()

  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const ml = ledger.months.find(m => m.month === month)
    let expected_in = 0, expected_out = 0

    if (ml) {
      for (const item of ml.items) {
        if (item.status === 'skipped') continue
        const amt = item.status === 'paid' || item.status === 'confirmed'
          ? item.amount_actual
          : item.amount_expected
        if (amt > 0) expected_in += amt
        else if (amt < 0) expected_out += Math.abs(amt)
      }
    }

    const opening = balance
    balance = balance + expected_in - expected_out
    result.push({ month, opening, expected_in, expected_out, closing: balance })
  }

  return result
}

// ── Ledger: invoice sync ──

export function syncInvoicesToLedger(receivables: ReceivablesData, ledger: Ledger): Ledger {
  const updated = { ...ledger, months: ledger.months.map(m => ({ ...m, items: [...m.items] })) }

  // Sync paid issued invoices → revenue in ledger
  for (const inv of receivables.invoices_issued) {
    if (inv.status !== 'paid' || !inv.paid_date || inv.paid_date.length < 7) continue
    const month = inv.paid_date.slice(0, 7)
    let ml = updated.months.find(m => m.month === month)
    if (!ml) {
      ml = { month, items: [], locked: false }
      updated.months.push(ml)
    }
    const existing = ml.items.find(i => i.source === 'invoice' && i.source_id === inv.id)
    if (!existing) {
      ml.items.push({
        id: genId(),
        date: inv.paid_date,
        description: `Faktura ${inv.number}: ${inv.client}`,
        category: 'revenue',
        source: 'invoice',
        source_id: inv.id,
        amount_expected: inv.total,
        amount_actual: inv.total,
        vat_rate: inv.vat_rate,
        vat_amount: inv.vat_amount,
        status: 'paid',
      })
    }
  }

  // Sync paid received bills → cost in ledger
  for (const bill of receivables.invoices_received) {
    if (bill.status !== 'paid' || !bill.paid_date) continue
    const month = bill.paid_date.slice(0, 7)
    let ml = updated.months.find(m => m.month === month)
    if (!ml) {
      ml = { month, items: [], locked: false }
      updated.months.push(ml)
    }
    const existing = ml.items.find(i => i.source === 'bill' && i.source_id === bill.id)
    if (!existing) {
      ml.items.push({
        id: genId(),
        date: bill.paid_date,
        description: `Faktura ${bill.number}: ${bill.supplier}`,
        category: 'cost',
        source: 'bill',
        source_id: bill.id,
        amount_expected: -bill.total,
        amount_actual: -bill.total,
        vat_rate: bill.vat_rate,
        vat_amount: bill.vat_amount,
        status: 'paid',
      })
    }
  }

  updated.months.sort((a, b) => a.month.localeCompare(b.month))
  return updated
}

// ── Ledger: VAT from confirmed items ──

export function calcVatFromLedger(ledger: Ledger): { output: number; input: number; liability: number } {
  let output = 0, input = 0
  for (const m of ledger.months) {
    for (const item of m.items) {
      if (item.status === 'skipped') continue
      const vat = item.vat_amount ?? 0
      // Use actual amount for paid/confirmed, expected for expected (Czech VAT based on invoice date)
      const amt = item.status === 'paid' || item.status === 'confirmed' ? item.amount_actual : item.amount_expected
      if (amt > 0) output += vat
      else if (amt < 0) input += vat
    }
  }
  return { output, input, liability: output - input }
}

// ── Ledger: income tax estimate ──

export function calcIncomeTaxEstimate(ledger: Ledger, taxRate: number): number {
  let totalProfit = 0
  for (const m of ledger.months) {
    for (const item of m.items) {
      if (item.status !== 'confirmed' && item.status !== 'paid') continue
      totalProfit += item.amount_actual
    }
  }
  return totalProfit > 0 ? Math.round(totalProfit * taxRate / 100) : 0
}

// ── Smart alerts ──

export function calcAlerts(
  ledger: Ledger,
  tiers: Tier[],
  fixedCosts: CostItem[],
  variablePct: number,
  budget: Budget,
  receivables: ReceivablesData,
  taxes: TaxData,
  vat: VatData,
  today: string = new Date().toISOString().slice(0, 10),
): Alert[] {
  if (!ledger || !tiers || !fixedCosts || !budget || !receivables || !taxes || !vat) return []
  const alerts: Alert[] = []
  const todayMs = new Date(today).getTime()

  // 1. Cash position negative
  const cashPos = calcCashPosition(ledger.bank_balance, ledger, 6)
  const negIdx = cashPos.findIndex(m => m.closing < 0)
  if (negIdx >= 0) {
    const negMonth = cashPos[negIdx]
    const monthsUntil = negIdx + 1
    alerts.push({
      id: 'cash_negative',
      severity: 'critical',
      message: `Cashflow bude záporný za ${monthsUntil} ${monthsUntil === 1 ? 'měsíc' : monthsUntil < 5 ? 'měsíce' : 'měsíců'}`,
      detail: `Aktuální zůstatek: ${fmt(ledger.bank_balance)}, očekávaný stav: ${fmt(negMonth.closing)}`,
      tab: 'monthly',
    })
  }

  // 2. Overdue invoices
  const overdue = receivables.invoices_issued.filter(i => i.status === 'overdue' || (i.status !== 'paid' && i.due_date && new Date(i.due_date).getTime() < todayMs))
  if (overdue.length > 0) {
    const total = overdue.reduce((s, i) => s + i.total, 0)
    alerts.push({
      id: 'invoices_overdue',
      severity: 'warning',
      message: `${overdue.length} ${overdue.length === 1 ? 'faktura' : overdue.length < 5 ? 'faktury' : 'faktur'} po splatnosti, celkem ${fmt(total)}`,
      tab: 'receivables',
    })
  }

  // 3. VAT due soon
  for (const p of vat.periods) {
    if (p.paid || !p.due_date) continue
    const days = Math.floor((new Date(p.due_date).getTime() - todayMs) / 86400000)
    if (days >= 0 && days <= 14) {
      alerts.push({
        id: `vat_due_${p.label}`,
        severity: days <= 3 ? 'critical' : 'warning',
        message: `DPH přiznání splatné za ${days} dní (${p.label})`,
        detail: `Částka: ${fmt(Math.abs(p.liability))}`,
        tab: 'vat',
      })
    }
  }

  // 4. Break-even not reached
  const be = calcBreakeven(tiers, fixedCosts, variablePct)
  const totalMembers = tiers.reduce((s, t) => s + t.members, 0)
  if (totalMembers > 0 && totalMembers < be.members) {
    alerts.push({
      id: 'breakeven_gap',
      severity: 'info',
      message: `Break-even nedosažen, chybí ${be.members - totalMembers} zákazníků`,
      detail: `Aktuálně ${totalMembers} z potřebných ${be.members}`,
      tab: 'pricing',
    })
  }

  // 5. Revenue below plan (current month)
  const currentMonth = today.slice(0, 7)
  const currentML = ledger.months.find(m => m.month === currentMonth)
  if (currentML) {
    const stats = calcLedgerMonth(currentML.items)
    if (stats.expected_income > 0 && stats.actual_income < stats.expected_income * 0.8) {
      const pct = Math.round((1 - stats.actual_income / stats.expected_income) * 100)
      alerts.push({
        id: 'revenue_variance',
        severity: 'warning',
        message: `Tržby o ${pct}% nižší než plán tento měsíc`,
        detail: `Očekáváno: ${fmt(stats.expected_income)}, skutečnost: ${fmt(stats.actual_income)}`,
        tab: 'monthly',
      })
    }
  }

  // 6. Tax advances due soon
  const allAdvances = [
    ...taxes.income_tax.advances.map(a => ({ ...a, type: 'daň z příjmů' })),
    ...taxes.social.advances.map(a => ({ ...a, type: 'sociální' })),
    ...taxes.health.advances.map(a => ({ ...a, type: 'zdravotní' })),
  ]
  for (const adv of allAdvances) {
    if (adv.paid || !adv.due_date) continue
    const days = Math.floor((new Date(adv.due_date).getTime() - todayMs) / 86400000)
    if (days >= 0 && days <= 7) {
      alerts.push({
        id: `tax_due_${adv.type}_${adv.period}`,
        severity: 'warning',
        message: `Záloha na ${adv.type} splatná za ${days} dní`,
        detail: `Období: ${adv.period}, částka: ${fmt(adv.amount)}`,
        tab: 'taxes',
      })
    }
  }

  // 7. Reserve running low
  const opex = calcOpex(fixedCosts, variablePct, calcRevenue(tiers, []).total)
  const monthlyEbitda = calcRevenue(tiers, []).total - opex.total
  if (monthlyEbitda < 0 && Math.abs(monthlyEbitda) > 0) {
    const reserveRemaining = budget.reserve_budget - budget.reserve_drawn
    const runway = Math.floor(reserveRemaining / Math.abs(monthlyEbitda))
    if (runway < 3 && runway >= 0 && isFinite(runway)) {
      alerts.push({
        id: 'reserve_low',
        severity: 'critical',
        message: `Rezerva pokryje jen ${runway} ${runway === 1 ? 'měsíc' : runway < 5 ? 'měsíce' : 'měsíců'}`,
        detail: `Zbývá: ${fmt(reserveRemaining)}, měsíční ztráta: ${fmt(Math.abs(monthlyEbitda))}`,
        tab: 'budget',
      })
    }
  }

  return alerts
}

// ── Hybrid cashflow (actual + projected) ──

export function calcHybridCashflow(
  ledger: Ledger,
  tiers: Tier[],
  extras: Extra[],
  fixedCosts: CostItem[],
  variablePct: number,
  budget: Budget,
  projectionMonths: number = 24,
  rampMonths: number = 17,
  startOffset: number = 0,
): Array<CashflowMonth & { isActual: boolean }> {
  const projected = calcCashflowProjection(tiers, extras, fixedCosts, variablePct, budget, projectionMonths, rampMonths, undefined, startOffset)

  const CZ = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
  return projected.map(p => {
    // Match by parsing both sides to year+month numbers
    const ml = ledger.months.find(m => {
      const [y, mo] = m.month.split('-').map(Number)
      if (!y || !mo) return false
      const label = `${CZ[mo - 1]} ${String(y).slice(-2)}`
      return p.label === label
    })

    if (ml && ml.items.some(i => i.status === 'confirmed' || i.status === 'paid')) {
      const stats = calcLedgerMonth(ml.items)
      return {
        ...p,
        revenue: stats.actual_income,
        costs: stats.actual_expense,
        ebitda: stats.actual_net,
        isActual: true,
      }
    }

    return { ...p, isActual: false }
  })
}

// ── Ramp factor for a specific month ──

export function getRampFactorForMonth(month: string, startMonth: string, rampMonths: number = 17): number {
  const [sy, sm] = startMonth.split('-').map(Number)
  const [my, mm] = month.split('-').map(Number)
  const monthIndex = (my - sy) * 12 + (mm - sm)
  if (monthIndex < 0) return 0
  if (monthIndex >= rampMonths) return 1
  const t = monthIndex / rampMonths
  return Math.round((3 * t * t - 2 * t * t * t) * 100) / 100
}

// ══════════════════════════════════════════════
// ── Revenue ──

export function calcRevenue(tiers: Tier[], extras: Extra[]): Revenue {
  const tierBreakdown = tiers.map(t => ({
    name: t.name,
    members: Math.max(0, t.members),
    price: Math.max(0, t.price),
    revenue: Math.max(0, t.price) * Math.max(0, t.members),
  }))
  const extraBreakdown = extras.map(e => ({
    name: e.name,
    quantity: Math.max(0, e.quantity),
    unit_price: Math.max(0, e.unit_price),
    revenue: Math.max(0, e.quantity) * Math.max(0, e.unit_price),
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

  const margin = avgPrice * (1 - Math.min(variablePct, 99) / 100)
  const members = avgPrice > 0 && margin > 0
    ? Math.ceil(fixedOpex / margin)
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

export function getRampCurve(months: number, rampMonths: number = 17, startOffset: number = 0): number[] {
  return Array.from({ length: months }, (_, i) => {
    const j = i + startOffset
    if (j >= rampMonths) return 1
    // S-curve: slow start, faster middle, slow finish
    const t = j / rampMonths
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
  startLabel?: string,
  startOffset: number = 0
): CashflowMonth[] {
  const rev = calcRevenue(tiers, extras)
  const ramp = getRampCurve(projectionMonths, rampMonths, startOffset)
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
