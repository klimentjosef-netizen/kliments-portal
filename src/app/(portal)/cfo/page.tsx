'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import CfoTabs from '@/components/cfo/CfoTabs'
import PricingTab from '@/components/cfo/PricingTab'
import CostsTab from '@/components/cfo/CostsTab'
import CashflowTab from '@/components/cfo/CashflowTab'
import BudgetTab from '@/components/cfo/BudgetTab'
import RisksTab from '@/components/cfo/RisksTab'
import QuestionsTab from '@/components/cfo/QuestionsTab'
import { type Tier, type Extra, type CostItem, type Budget, calcRevenue, calcOpex } from '@/components/cfo/calcEngine'
import type { Report } from '@/lib/types'

const ALL_TABS = [
  { id: 'pricing', label: 'Cenotvorba' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'budget', label: 'Rozpočet' },
  { id: 'costs', label: 'Náklady' },
  { id: 'risks', label: 'Rizika & Plán' },
  { id: 'questions', label: 'Dotazy' },
]

// Default data for new reports
const DEFAULT_DATA = {
  title: 'CFO na volné noze',
  subtitle: '',
  status: 'active',
  tiers: [{ name: 'Základní', price: 0, capacity: 10, members: 0, features: ['Přístup k službě'] }] as Tier[],
  extras: [] as Extra[],
  fixed_costs: [
    { name: 'Nájem', amount: 0 },
    { name: 'Energie a voda', amount: 0 },
    { name: 'Administrativa', amount: 0 },
    { name: 'Marketing', amount: 0 },
  ] as CostItem[],
  variable_cost_pct: 5,
  budget: {
    total: 0,
    capex_budget: 0,
    reserve_budget: 0,
    capex_items: [],
    reserve_drawn: 0,
  } as Budget,
  ramp_months: 17,
  projection_months: 24,
  risks: [],
  steps: [],
  questions: [],
  summary: '',
}

export default function CfoPage() {
  return (
    <Suspense fallback={<><Topbar title="CFO na volné noze" /><div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>}>
      <CfoPageInner />
    </Suspense>
  )
}

function CfoPageInner() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pricing')
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [clientName, setClientName] = useState<string>('')
  const [isAdminView, setIsAdminView] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()
  const searchParams = useSearchParams()
  const clientParam = searchParams.get('client')

  // Load report
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Admin viewing a specific client
      let targetId = user.id
      if (clientParam) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role === 'admin') {
          targetId = clientParam
          setIsAdminView(true)
          const { data: clientProfile } = await supabase.from('profiles').select('name').eq('id', clientParam).single()
          if (clientProfile) setClientName(clientProfile.name)
        }
      }

      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', targetId).eq('type', 'cfo')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientParam])

  // Auto-save with debounce
  const autoSave = useCallback(async (newData: Record<string, unknown>) => {
    if (!report) return
    setSaveStatus('Ukládám...')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const { error } = await supabase
        .from('reports')
        .update({ data: newData })
        .eq('id', report.id)
      if (error) {
        setSaveStatus('Chyba ukládání')
        setTimeout(() => setSaveStatus(''), 3000)
      } else {
        setSaveStatus('✓ Uloženo ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }))
      }
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])

  // Update helper
  function updateData(key: string, value: unknown) {
    if (!report) return
    const newData = { ...report.data, [key]: value }
    setReport({ ...report, data: newData })
    autoSave(newData)
  }

  // Merge defaults with stored data
  const d = report ? { ...DEFAULT_DATA, ...report.data } : DEFAULT_DATA
  const tiers = (d.tiers || DEFAULT_DATA.tiers) as Tier[]
  const extras = (d.extras || DEFAULT_DATA.extras) as Extra[]
  const fixedCosts = (d.fixed_costs || DEFAULT_DATA.fixed_costs) as CostItem[]
  const variablePct = (d.variable_cost_pct ?? DEFAULT_DATA.variable_cost_pct) as number
  const budget = (d.budget || DEFAULT_DATA.budget) as Budget
  const rampMonths = (d.ramp_months ?? DEFAULT_DATA.ramp_months) as number
  const projectionMonths = (d.projection_months ?? DEFAULT_DATA.projection_months) as number

  // Calculate EBITDA for budget tab
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const monthlyEbitda = rev.total - opex.total

  // Visible tabs
  const visibleTabs = ALL_TABS.filter(t => {
    if (t.id === 'risks') return d.risks && (d.risks as unknown[]).length > 0
    if (t.id === 'questions') return d.questions && (d.questions as unknown[]).length > 0
    return true
  })

  if (loading) return (
    <>
      <Topbar title="CFO na volné noze" />
      <div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div>
    </>
  )

  if (!report) return (
    <>
      <Topbar title="CFO na volné noze" />
      <div className="p-9"><EmptyState /></div>
    </>
  )

  return (
    <>
      <Topbar title={isAdminView ? `CFO — ${clientName}` : 'CFO na volné noze'} />
      <div className="p-9">
        {/* Admin banner */}
        {isAdminView && (
          <div className="bg-rose/10 border border-rose/20 rounded-2xl px-5 py-3 mb-4 flex items-center justify-between">
            <span className="text-[0.8rem] text-rose-deep">Prohlížíte dashboard klienta <strong>{clientName}</strong></span>
            <a href="/portal/admin" className="text-[0.72rem] text-rose hover:text-rose-deep underline">← Zpět na klienty</a>
          </div>
        )}

        {/* Header */}
        <div className="bg-ink rounded-[20px] p-7 mb-6 flex justify-between items-start relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
          <div>
            <h2 className="font-serif text-xl text-sand font-light mb-1.5">{d.title || 'CFO na volné noze'}</h2>
            <p className="text-[0.78rem] text-white/40">{d.subtitle || ''}{isAdminView && clientName ? ` · ${clientName}` : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus && (
              <span className={`text-[0.68rem] ${saveStatus.startsWith('✓') ? 'text-green' : saveStatus.startsWith('Chyba') ? 'text-rose-pale' : 'text-white/40'}`}>
                {saveStatus}
              </span>
            )}
            <span className={`px-5 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium ${
              d.status === 'paused' ? 'bg-amber text-white' :
              d.status === 'completed' ? 'bg-mid text-white' :
              'bg-green text-white'
            }`}>
              {d.status === 'paused' ? 'Pozastaveno ●' : d.status === 'completed' ? 'Ukončeno' : 'Aktivní ●'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <CfoTabs tabs={visibleTabs} active={tab} onChange={setTab} />

        {/* Tab content */}
        {tab === 'pricing' && (
          <PricingTab
            tiers={tiers}
            extras={extras}
            fixedCosts={fixedCosts}
            variablePct={variablePct}
            budget={budget}
            onTiersChange={v => updateData('tiers', v)}
            onExtrasChange={v => updateData('extras', v)}
          />
        )}
        {tab === 'cashflow' && (
          <CashflowTab
            tiers={tiers}
            extras={extras}
            fixedCosts={fixedCosts}
            variablePct={variablePct}
            budget={budget}
            rampMonths={rampMonths}
            projectionMonths={projectionMonths}
          />
        )}
        {tab === 'budget' && (
          <BudgetTab
            budget={budget}
            monthlyEbitda={monthlyEbitda}
            onBudgetChange={v => updateData('budget', v)}
          />
        )}
        {tab === 'costs' && (
          <CostsTab
            fixedCosts={fixedCosts}
            variablePct={variablePct}
            onCostsChange={v => updateData('fixed_costs', v)}
            onVariableChange={v => updateData('variable_cost_pct', v)}
          />
        )}
        {tab === 'risks' && <RisksTab data={d} />}
        {tab === 'questions' && <QuestionsTab data={d} />}
      </div>
    </>
  )
}
