// What-if model pro transakční byznys (autoservis) · nezávislý na "tarifech/členech".
// 4 páky: marže na dílech (±p.b.), tržby (±%), fixní náklady (±Kč), hodinová sazba (±%).

export interface WhatIfBase {
  annual_revenue: number      // roční tržby (hlavní, bez ostatních provozních výnosů)
  material_pct: number        // materiálová náročnost = materiál/díly jako % tržeb (0..100)
  other_income: number        // ostatní provozní výnosy (Kč/rok)
  fixed_annual: number        // fixní náklady vč. odpisů (Kč/rok)
  depreciation_annual: number // odpisy (Kč/rok) · pro EBITDA add-back
  labor_share_pct: number     // odhad: kolik % tržeb je práce (zbytek díly) · pro páku hod. sazby
}

export interface WhatIfLevers {
  material_pp: number  // zlepšení marže na dílech v p.b. (kladné = nižší materiálová náročnost)
  revenue_pct: number  // změna tržeb v %
  fixed_delta: number  // změna fixních nákladů v Kč/rok (kladné = vyšší náklady)
  hourly_pct: number   // změna hodinové sazby práce v %
}

export interface WhatIfResult {
  revenue: number
  material: number
  fixed: number
  ebit: number       // provozní výsledek
  ebitda: number
  cashImpactAnnual: number // přibližný roční dopad na cash (≈ EBITDA)
}

export const ZERO_LEVERS: WhatIfLevers = { material_pp: 0, revenue_pct: 0, fixed_delta: 0, hourly_pct: 0 }

export function calcWhatIfAuto(base: WhatIfBase, levers: WhatIfLevers): WhatIfResult {
  const matPct = Math.max(0, base.material_pct - levers.material_pp) / 100
  const grownRevenue = base.annual_revenue * (1 + levers.revenue_pct / 100)
  // zvýšení hodinové sazby zvedne jen práci (díly beze změny), tj. čistá marže navíc
  const laborExtra = base.annual_revenue * (base.labor_share_pct / 100) * (levers.hourly_pct / 100)
  const revenue = grownRevenue + laborExtra
  const material = grownRevenue * matPct // materiál škáluje s objemem (bez práce navíc)
  const fixed = base.fixed_annual + levers.fixed_delta
  const ebit = revenue + base.other_income - material - fixed
  const ebitda = ebit + base.depreciation_annual
  return { revenue, material, fixed, ebit, ebitda, cashImpactAnnual: ebitda }
}

// Roční tržby potřebné pro EBIT = 0 při daných pákách (mimo růst tržeb)
export function breakEvenRevenue(base: WhatIfBase, levers: WhatIfLevers): number {
  const matPct = Math.max(0, base.material_pct - levers.material_pp) / 100
  const fixed = base.fixed_annual + levers.fixed_delta
  // EBIT = R*(1-matPct) + otherIncome - fixed = 0  →  R = (fixed - otherIncome)/(1-matPct)
  const denom = 1 - matPct
  return denom > 0 ? (fixed - base.other_income) / denom : Infinity
}

// Výchozí báze pro TechCars (skutečnost 2025, reconciliováno na výkaz)
export const TECHCARS_BASE: WhatIfBase = {
  annual_revenue: 7119000,
  material_pct: 60.9,
  other_income: 245000,
  fixed_annual: 3297500,
  depreciation_annual: 255000,
  labor_share_pct: 40,
}
