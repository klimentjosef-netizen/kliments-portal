import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Endpoint vytvori CFO report pro noveho klienta na zaklade onboarding dat.
// Vyzaduje admin session.

export async function POST(req: NextRequest) {
  const userClient = createServerSupabase()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { clientId, onboarding } = body
  if (!clientId || !onboarding) {
    return NextResponse.json({ error: 'Missing clientId or onboarding' }, { status: 400 })
  }

  // Mapovani onboarding form -> CFO report data struktura
  const tiers = (onboarding.tiers || [])
    .filter((t: { name: string }) => t.name?.trim())
    .map((t: { name: string; price: number; quantity: number }) => ({
      name: t.name,
      price: t.price,
      capacity: Math.max(t.quantity * 2, 10),
      members: t.quantity,
      badge: '',
      features: [],
    }))

  const fixedCosts = (onboarding.fixed_costs || [])
    .filter((c: { name: string }) => c.name?.trim())
    .map((c: { name: string; amount: number }) => ({
      name: c.name,
      amount: c.amount,
    }))

  const reportData = {
    title: 'CFO na volné noze',
    subtitle: onboarding.name,
    status: 'active',
    business_profile: {
      entity_type: onboarding.entity_type || 'sro',
      vat_payer: onboarding.vat_payer ?? true,
      complexity: 'standard',
      founding_date: '',
      fiscal_year_start: '01',
      vat_transition_date: '',
      industry: onboarding.industry || '',
      employees: onboarding.employees || '',
      annual_revenue: onboarding.annual_revenue || '',
      goals: onboarding.goals || [],
    },
    vat: {
      registered: onboarding.vat_payer ?? true,
      period: 'monthly',
      rates: [21],
      periods: [],
    },
    projection_months: 12,
    variable_cost_pct: 20,
    tiers,
    extras: [],
    fixed_costs: fixedCosts,
    risks: [],
    steps: [
      {
        num: '01',
        deadline: 'Do 7 dní',
        title: 'Doplnit reálná čísla minulého měsíce',
        desc: 'V záložce Import dat nahrajte CSV bankovní výpis a faktury za uzavřený měsíc.',
        done: false,
      },
      {
        num: '02',
        deadline: 'Do 14 dní',
        title: 'Doladit dashboard s Josefem',
        desc: 'První online schůzka, projdeme čísla a doladíme priority na první kvartál.',
        done: false,
      },
    ],
    questions: [],
    ledger: { bank_balance: 0, months: [] },
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from('reports').insert({
    client_id: clientId,
    type: 'cfo',
    title: 'CFO na volné noze',
    data: reportData,
  })

  if (error) {
    console.error('[onboarding-create-report] insert failed:', error.message)
    return NextResponse.json({ error: 'Vytvoření reportu selhalo: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
