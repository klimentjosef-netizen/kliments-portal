'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import SaveToast from '@/components/SaveToast'
import CfoTabs from '@/components/cfo/CfoTabs'
import DashboardTab from '@/components/cfo/DashboardTab'
import MonthlyPlanTab from '@/components/cfo/MonthlyPlanTab'
import PricingTab from '@/components/cfo/PricingTab'
import CostsTab from '@/components/cfo/CostsTab'
import CashflowTab from '@/components/cfo/CashflowTab'
import BudgetTab from '@/components/cfo/BudgetTab'
import RisksTab from '@/components/cfo/RisksTab'
import QuestionsTab from '@/components/cfo/QuestionsTab'
import VatTab from '@/components/cfo/VatTab'
import TaxesTab from '@/components/cfo/TaxesTab'
import ReceivablesTab from '@/components/cfo/ReceivablesTab'
import {
  type Tier, type Extra, type CostItem, type Budget, type Ledger,
  type VatData, type TaxData, type ReceivablesData, type Actuals,
  calcRevenue, calcOpex,
  migrateActualsToLedger, generateExpectedItems, mergeExpectedWithExisting,
  syncInvoicesToLedger, getRampFactorForMonth,
} from '@/components/cfo/calcEngine'
import AdminClientPicker from '@/components/AdminClientPicker'
import type { Report } from '@/lib/types'
import { exportCfoPdf } from '@/lib/pdfExport'

const ALL_TABS = [
  { id: 'dashboard', label: 'Přehled' },
  { id: 'monthly', label: 'Měsíční plán' },
  { id: 'pricing', label: 'Cenotvorba' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'receivables', label: 'Pohledávky a závazky' },
  { id: 'vat', label: 'DPH' },
  { id: 'taxes', label: 'Daně & Odvody' },
  { id: 'costs', label: 'Náklady' },
  { id: 'budget', label: 'Rozpočet' },
  { id: 'risks', label: 'Rizika & Plán' },
  { id: 'questions', label: 'Dotazy' },
]

const TAB_IDS = ALL_TABS.map(t => t.id)

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
  business_start_month: '',
}

export default function CfoPage() {
  return (
    <Suspense fallback={<><Topbar title="CFO na volné noze" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>}>
      <CfoPageInner />
    </Suspense>
  )
}

function CfoPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(initialTab && TAB_IDS.includes(initialTab) ? initialTab : 'dashboard')
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [clientName, setClientName] = useState<string>('')
  const [isAdminView, setIsAdminView] = useState(false)
  const [isAdminNoPick, setIsAdminNoPick] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reportIdRef = useRef<string>('')
  const supabase = createClient()
  const clientParam = searchParams.get('client')

  // Persist tab in URL
  function handleTabChange(newTab: string) {
    setTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // Load report
  useEffect(() => {
    async function load() {
      // Reset states
      setLoading(true)
      setIsAdminNoPick(false)
      setIsAdminView(false)
      setClientName('')
      setReport(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Admin viewing a specific client
      let targetId = user.id
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'admin') {
        if (clientParam) {
          targetId = clientParam
          setIsAdminView(true)
          const { data: clientProfile } = await supabase.from('profiles').select('name').eq('id', clientParam).single()
          if (clientProfile) setClientName(clientProfile.name)
        } else {
          setIsAdminNoPick(true)
          setLoading(false)
          return
        }
      }

      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', targetId).eq('type', 'cfo')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) {
        setReport(data as Report)
        reportIdRef.current = (data as Report).id
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientParam])

  // Auto-save with debounce (uses ref for stable report ID)
  function saveToDb(newData: Record<string, unknown>) {
    const id = reportIdRef.current
    if (!id) return
    setSaveStatus('Ukládám...')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const sb = createClient()
      const { error } = await sb
        .from('reports')
        .update({ data: newData })
        .eq('id', id)
      if (error) {
        console.error('Save error:', error)
        setSaveStatus('Chyba ukládání')
        setTimeout(() => setSaveStatus(''), 3000)
      } else {
        setSaveStatus('✓ Uloženo ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }))
      }
    }, 800)
  }

  // Update helper
  function updateData(key: string, value: unknown) {
    if (!report) return
    const newData = { ...report.data, [key]: value }
    setReport({ ...report, data: newData })
    saveToDb(newData)
  }

  // Merge defaults with stored data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: Record<string, any> = report ? { ...DEFAULT_DATA, ...report.data } : DEFAULT_DATA
  const tiers = (d.tiers || DEFAULT_DATA.tiers) as Tier[]
  const extras = (d.extras || DEFAULT_DATA.extras) as Extra[]
  const fixedCosts = (d.fixed_costs || DEFAULT_DATA.fixed_costs) as CostItem[]
  const variablePct = (d.variable_cost_pct ?? DEFAULT_DATA.variable_cost_pct) as number
  const budget = (d.budget || DEFAULT_DATA.budget) as Budget
  const rampMonths = (d.ramp_months ?? DEFAULT_DATA.ramp_months) as number
  const projectionMonths = (d.projection_months ?? DEFAULT_DATA.projection_months) as number
  // Migrate old actuals to ledger if needed
  const rawLedger: Ledger = d.ledger
    ? d.ledger as Ledger
    : d.actuals
      ? migrateActualsToLedger(d.actuals as Actuals)
      : { bank_balance: 0, months: [] }
  const vat = (d.vat || { registered: true, period: 'quarterly', rates: [], periods: [] }) as VatData
  const taxesData = (d.taxes || { entity_type: 'sro', income_tax: { rate: 21, annual_estimate: 0, advances: [] }, social: { monthly: 0, advances: [] }, health: { monthly: 0, advances: [] }, other_taxes: [] }) as TaxData
  const receivables = (d.receivables || { invoices_issued: [], invoices_received: [] }) as ReceivablesData

  // Compute elapsed months from business start for ramp offset
  const businessStartMonth = (d.business_start_month as string) || ''
  const hasRunningBusiness = tiers.some(t => t.members > 0 && t.price > 0)
  const elapsedMonths = (() => {
    if (!businessStartMonth) return hasRunningBusiness ? rampMonths : 0
    const [sy, sm] = businessStartMonth.split('-').map(Number)
    const now = new Date()
    return (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm)
  })()

  // Auto-generate expected items for current + next 5 months
  const ledger: Ledger = (() => {
    const result = { ...rawLedger, months: rawLedger.months.map(m => ({ ...m, items: [...m.items] })) }
    const startMonth = businessStartMonth || new Date().toISOString().slice(0, 7)
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      let ml = result.months.find(m => m.month === month)
      if (!ml) {
        ml = { month, items: [], locked: false }
        result.months.push(ml)
      }
      if (!ml.locked) {
        const ramp = hasRunningBusiness && !businessStartMonth ? 1.0 : getRampFactorForMonth(month, startMonth, rampMonths)
        const generated = generateExpectedItems(month, tiers, extras, fixedCosts, taxesData, vat, ramp)
        ml.items = mergeExpectedWithExisting(generated, ml.items)
      }
    }
    // Sync invoices
    const synced = syncInvoicesToLedger(receivables, result)
    synced.months.sort((a, b) => a.month.localeCompare(b.month))
    return synced
  })()

  // Calculate EBITDA for budget tab
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const monthlyEbitda = rev.total - opex.total

  // CAPEX VAT for VatTab
  const capexSpent = budget.capex_items.reduce((s, i) => s + i.spent, 0)
  const capexVat = Math.round(capexSpent * 21 / 121)

  if (isAdminNoPick) return <AdminClientPicker serviceName="CFO na volné noze" pageUrl="/cfo" title="CFO na volné noze" />

  if (loading) return (
    <>
      <Topbar title="CFO na volné noze" />
      <div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div>
    </>
  )

  if (!report) return (
    <>
      <Topbar title="CFO na volné noze" />
      <div className="p-4 lg:p-9"><EmptyState /></div>
    </>
  )

  return (
    <>
      <Topbar title={isAdminView ? `CFO · ${clientName}` : 'CFO na volné noze'} />
      <SaveToast status={saveStatus} />
      <div className="p-4 lg:p-9">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCfoPdf('cfo-content', d.title || 'CFO na volné noze')}
              className="px-4 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
            >
              Export PDF
            </button>
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
        <CfoTabs tabs={ALL_TABS} active={tab} onChange={handleTabChange} />

        {/* Tab content */}
        <div id="cfo-content">
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
            startOffset={elapsedMonths}
            businessStartMonth={businessStartMonth}
            ledger={ledger}
            onRampMonthsChange={v => updateData('ramp_months', v)}
            onProjectionMonthsChange={v => updateData('projection_months', v)}
            onBusinessStartMonthChange={v => updateData('business_start_month', v)}
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
        {tab === 'dashboard' && (
          <DashboardTab
            ledger={ledger} tiers={tiers} extras={extras} fixedCosts={fixedCosts}
            variablePct={variablePct} budget={budget} receivables={receivables}
            taxes={taxesData} vat={vat} onTabChange={handleTabChange}
          />
        )}
        {tab === 'monthly' && (
          <MonthlyPlanTab ledger={ledger} onLedgerChange={v => updateData('ledger', v)} />
        )}
        {tab === 'vat' && (
          <VatTab vat={vat} ledger={ledger} capexVat={capexVat} onVatChange={v => updateData('vat', v)} />
        )}
        {tab === 'taxes' && (
          <TaxesTab taxes={taxesData} onTaxesChange={v => updateData('taxes', v)} />
        )}
        {tab === 'receivables' && (
          <ReceivablesTab receivables={receivables} onReceivablesChange={v => updateData('receivables', v)} />
        )}
        {tab === 'risks' && <RisksTab data={d} onRisksChange={v => updateData('risks', v)} onStepsChange={v => updateData('steps', v)} />}
        {tab === 'questions' && <QuestionsTab data={d} onQuestionsChange={v => updateData('questions', v)} />}
        </div>
      </div>
    </>
  )
}
