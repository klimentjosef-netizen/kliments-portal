'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import SaveToast from '@/components/SaveToast'
import BlockRenderer from '@/components/blocks/BlockRenderer'
import type { Block } from '@/components/blocks/types'
import CfoTabs from '@/components/cfo/CfoTabs'
import DashboardTab from '@/components/cfo/DashboardTab'
import MonthlyPlanTab from '@/components/cfo/MonthlyPlanTab'
import PricingTab from '@/components/cfo/PricingTab'
import CostsTab from '@/components/cfo/CostsTab'
import CashflowTab from '@/components/cfo/CashflowTab'
import BudgetTab from '@/components/cfo/BudgetTab'
import RisksTab from '@/components/cfo/RisksTab'
import QuestionsTab from '@/components/cfo/QuestionsTab'
import ImportTab from '@/components/cfo/ImportTab'
import VatTab from '@/components/cfo/VatTab'
import TaxesTab from '@/components/cfo/TaxesTab'
import ReceivablesTab from '@/components/cfo/ReceivablesTab'
import WhatIfTab from '@/components/cfo/WhatIfTab'
import PnlTab from '@/components/cfo/PnlTab'
import FillMonthTab from '@/components/cfo/FillMonthTab'
import WeeklyCashflowTab from '@/components/cfo/WeeklyCashflowTab'
import TaxOverviewTab from '@/components/cfo/TaxOverviewTab'
import AssistantWidget from '@/components/cfo/AssistantWidget'
import { PeriodStrip, ledgerYearInfo } from '@/components/cfo/period'
import {
  type Tier, type Extra, type CostItem, type Budget, type Ledger,
  type VatData, type TaxData, type ReceivablesData, type Actuals,
  type BusinessProfile, DEFAULT_BUSINESS_PROFILE,
  calcRevenue, calcOpex,
  migrateActualsToLedger, generateExpectedItems, mergeExpectedWithExisting,
  syncInvoicesToLedger, getRampFactorForMonth,
  getCzechTaxCalendar, calcRecommendations, getUpcomingTimeline,
} from '@/components/cfo/calcEngine'
import AdminClientPicker from '@/components/AdminClientPicker'
import type { Report } from '@/lib/types'
import { exportCfoPdf } from '@/lib/pdfExport'
import { exportCfoExcel } from '@/lib/excelExport'

const ALL_TABS = [
  { id: 'dashboard', label: 'Přehled' },
  { id: 'hospodareni', label: 'Hospodaření' },
  { id: 'monthly', label: 'Měsíční plán' },
  { id: 'pricing', label: 'Cenotvorba' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'whatif', label: 'Co kdyby' },
  { id: 'receivables', label: 'Pohledávky a závazky' },
  { id: 'vat', label: 'DPH' },
  { id: 'taxes', label: 'Daně & Odvody' },
  { id: 'costs', label: 'Náklady' },
  { id: 'budget', label: 'Rozpočet' },
  { id: 'risks', label: 'Rizika & Plán' },
  { id: 'questions', label: 'Dotazy' },
  { id: 'import', label: 'Import dat' },
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
  business_profile: DEFAULT_BUSINESS_PROFILE,
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
  const [cfoYear, setCfoYear] = useState<string>('souhrn') // globální přepínač roku (Hospodaření)
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [clientName, setClientName] = useState<string>('')
  const [isAdminView, setIsAdminView] = useState(false)
  const [isAdminNoPick, setIsAdminNoPick] = useState(false)
  const [targetClientId, setTargetClientId] = useState<string>('')
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

      setTargetClientId(targetId)
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
  // Typ byznysu: 'transaction' (autoservis ap.) vs 'subscription' (členové/tarify).
  // Default subscription kvůli zpětné kompatibilitě stávajících reportů.
  const businessModel = (d.business_model as string) || 'subscription'
  const isTransaction = businessModel === 'transaction'
  // E-shop vs ostatní transakční (autoservis…) · přepíná názvosloví páček, scénářů a daňových páků.
  const eshop = /e-?shop|e-?commerce|\bshop\b/i.test(String(d.business_profile?.industry || ''))
  // Záložky nevhodné pro transakční byznys (postavené na tarifech/členech/CAPEX startupu)
  const HIDDEN_FOR_TRANSACTION = ['pricing', 'monthly', 'budget', 'risks', 'questions']
  // Hospodaření je jen pro transakční model
  const TRANSACTION_ONLY = ['hospodareni']
  // Srozumitelné názvy pro transakční byznys
  const TRANSACTION_LABELS: Record<string, string> = {
    cashflow: 'Peníze', receivables: 'Faktury', taxes: 'Daně a odvody', import: 'Doplnit data',
  }
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
  const rcvRaw = (d.receivables || {}) as Partial<ReceivablesData>
  const receivables: ReceivablesData = {
    invoices_issued: Array.isArray(rcvRaw.invoices_issued) ? rcvRaw.invoices_issued : [],
    invoices_received: Array.isArray(rcvRaw.invoices_received) ? rcvRaw.invoices_received : [],
  }

  // Business profile
  const profile = (d.business_profile || DEFAULT_BUSINESS_PROFILE) as BusinessProfile

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
    // Transakční byznys NEdogeneruje žádné očekávané měsíce — letošní rok se plní
    // jen ručně přes „Doplnit data". (Auto-generování je tarifové/předplatné a vyrábělo
    // by 2026 měsíce jen z fixních nákladů → portál by tvrdil, že 2026 má data.)
    if (!isTransaction) for (let i = 0; i < 6; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      let ml = result.months.find(m => m.month === month)
      if (!ml) {
        ml = { month, items: [], locked: false }
        result.months.push(ml)
      }
      if (!ml.locked) {
        const ramp = hasRunningBusiness && !businessStartMonth ? 1.0 : getRampFactorForMonth(month, startMonth, rampMonths)
        const generated = generateExpectedItems(month, tiers, extras, fixedCosts, taxesData, vat, ramp, profile.entity_type)
        ml.items = mergeExpectedWithExisting(generated, ml.items)
      }
    }
    // Sync invoices
    const synced = syncInvoicesToLedger(receivables, result)
    synced.months.sort((a, b) => a.month.localeCompare(b.month))
    return synced
  })()

  // Živá data letošního roku · pro nudge na Přehledu
  const liveMonthsCount = ledger.months.filter(m => m.month.startsWith(String(new Date().getFullYear())) && m.items.length > 0).length

  // Calculate EBITDA for budget tab
  const rev = calcRevenue(tiers, extras)
  const opex = calcOpex(fixedCosts, variablePct, rev.total)
  const monthlyEbitda = rev.total - opex.total

  // CAPEX VAT for VatTab
  const capexSpent = budget.capex_items.reduce((s, i) => s + i.spent, 0)
  const capexVat = Math.round(capexSpent * 21 / 121)

  // Smart advisor data
  const taxDeadlines = getCzechTaxCalendar(profile, taxesData, vat, ledger)
  const recommendations = calcRecommendations(ledger, tiers, extras, fixedCosts, variablePct, budget, receivables, taxesData, vat, profile)
  const timeline = getUpcomingTimeline(ledger, taxDeadlines)

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

        {/* Block-based dashboard: transakční klienti ho vidí UVNITŘ záložky Přehled
            (čistší flow); předplatní ho mají nad CFO UI jako dřív. Přepínání let
            řeší přímo živé záložky (Hospodaření), ne statické bloky. */}
        {!isTransaction && Array.isArray(d.blocks) && d.blocks.length > 0 && (
          <div className="mb-8">
            <BlockRenderer blocks={d.blocks as Block[]} />
          </div>
        )}

        {/* Header */}
        <div className="bg-ink rounded-[20px] p-7 mb-6 flex justify-between items-start relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
          <div>
            <h2 className="font-serif text-xl text-sand font-light mb-1.5">{d.title || 'CFO na volné noze'}</h2>
            <p className="text-[0.78rem] text-white/40">{d.subtitle || ''}{isAdminView && clientName ? ` · ${clientName}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const stamp = new Date().toISOString().slice(0, 10)
                const name = (clientName || d.subtitle || 'kliments').toString().replace(/[^a-z0-9čšřžýáíéúůďťň-]+/gi, '-').toLowerCase()
                exportCfoExcel({
                  filename: `cfo-${name}-${stamp}.xlsx`,
                  clientName: clientName || undefined,
                  ledger,
                  receivables,
                  tiers,
                  fixedCosts,
                  variablePct: variablePct,
                })
              }}
              className="px-4 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium bg-white/15 text-white/80 hover:bg-white/25 hover:text-white transition-colors"
            >
              Export Excel
            </button>
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

        {/* Business profile bar */}
        <div className="bg-white rounded-2xl p-4 mb-4 border border-black/[0.06] flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Forma</label>
            <select
              value={profile.entity_type}
              onChange={e => updateData('business_profile', { ...profile, entity_type: e.target.value })}
              className="bg-sand-pale rounded-lg px-3 py-1.5 text-[0.78rem] text-ink border-none outline-none focus:ring-1 focus:ring-rose"
            >
              <option value="sro">s.r.o.</option>
              <option value="osvc">OSVC</option>
              <option value="as">a.s.</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Typ byznysu</label>
            <select
              value={businessModel}
              onChange={e => updateData('business_model', e.target.value)}
              className="bg-sand-pale rounded-lg px-3 py-1.5 text-[0.78rem] text-ink border-none outline-none focus:ring-1 focus:ring-rose"
            >
              <option value="transaction">Transakční (servis, e-shop…)</option>
              <option value="subscription">Předplatné (členové, tarify)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Platce DPH</label>
            <button
              onClick={() => updateData('business_profile', { ...profile, vat_payer: !profile.vat_payer })}
              className={`px-3 py-1.5 rounded-lg text-[0.78rem] font-medium transition-colors ${
                profile.vat_payer ? 'bg-green/15 text-green' : 'bg-black/5 text-mid'
              }`}
            >
              {profile.vat_payer ? 'Ano' : 'Ne'}
            </button>
          </div>
          {!profile.vat_payer && (
            <div className="flex items-center gap-2">
              <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Prechod na DPH</label>
              <input
                type="month"
                value={profile.vat_transition_date || ''}
                onChange={e => updateData('business_profile', { ...profile, vat_transition_date: e.target.value || null })}
                className="bg-sand-pale rounded-lg px-3 py-1.5 text-[0.78rem] text-ink border-none outline-none focus:ring-1 focus:ring-rose"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-[0.58rem] tracking-[0.1em] uppercase text-mid">Zalozeni</label>
            <input
              type="month"
              value={profile.founding_date || ''}
              onChange={e => updateData('business_profile', { ...profile, founding_date: e.target.value })}
              className="bg-sand-pale rounded-lg px-3 py-1.5 text-[0.78rem] text-ink border-none outline-none focus:ring-1 focus:ring-rose"
            />
          </div>
        </div>

        {/* Tabs */}
        {/* Pruh období — jasné roky + co je živě (jen transakční flow) */}
        {isTransaction && <PeriodStrip ledger={ledger} />}

        {/* Globální přepínač roku — vždy vidět; vede na Hospodaření daného roku */}
        {isTransaction && (() => {
          const { closedYears, currentYear, liveMonths } = ledgerYearInfo(ledger)
          const opts = ['souhrn', ...closedYears, ...(liveMonths > 0 ? [String(currentYear)] : [])]
          return (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-[0.6rem] tracking-[0.14em] uppercase text-mid font-medium mr-1">Zobrazit rok</span>
              {opts.map(y => (
                <button key={y}
                  onClick={() => { setCfoYear(y); handleTabChange('hospodareni') }}
                  className={`px-4 py-1.5 rounded-full text-[0.78rem] font-medium transition-colors ${
                    (tab === 'hospodareni' && cfoYear === y) ? 'bg-rose text-white' : 'bg-white border border-black/[0.08] text-mid hover:border-rose-pale'
                  }`}>
                  {y === 'souhrn' ? 'Souhrn všech let' : y}
                </button>
              ))}
            </div>
          )
        })()}

        <CfoTabs tabs={ALL_TABS.filter(t => {
          if (t.id === 'vat' && !profile.vat_payer && !profile.vat_transition_date) return false
          if (!isTransaction && TRANSACTION_ONLY.includes(t.id)) return false
          if (isTransaction && HIDDEN_FOR_TRANSACTION.includes(t.id)) return false
          return true
        }).map(t => (isTransaction && TRANSACTION_LABELS[t.id]) ? { ...t, label: TRANSACTION_LABELS[t.id] } : t)}
          active={tab} onChange={handleTabChange} />

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
          <div className="space-y-8">
          {isTransaction && (
            <WeeklyCashflowTab
              ledger={ledger}
              whatifBase={d.whatif_base}
              schedule={d.cf_schedule}
              onScheduleChange={v => updateData('cf_schedule', v)}
            />
          )}
          {isTransaction && Array.isArray(d.blocks_cash) && d.blocks_cash.length > 0 && <BlockRenderer blocks={d.blocks_cash as Block[]} />}
          {!isTransaction && (
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
            complexity={profile.complexity}
            bankBalance={ledger.bank_balance}
            businessModel={businessModel}
            onRampMonthsChange={v => updateData('ramp_months', v)}
            onProjectionMonthsChange={v => updateData('projection_months', v)}
            onBusinessStartMonthChange={v => updateData('business_start_month', v)}
          />
          )}
          </div>
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
        {tab === 'dashboard' && isTransaction && liveMonthsCount === 0 && (
          <button onClick={() => handleTabChange('import')}
            className="w-full text-left bg-ink rounded-[20px] p-5 mb-6 flex items-center justify-between gap-4 group">
            <div>
              <div className="text-[0.62rem] tracking-[0.1em] uppercase text-rose-pale mb-1">Živá data {new Date().getFullYear()}</div>
              <div className="font-serif text-[1.05rem] text-sand font-light leading-snug">Letošní rok zatím nemá data · doplňte poslední uzavřený měsíc</div>
              <div className="text-[0.76rem] text-white/45 mt-1">Stačí tři čísla a portál se rozsvítí naživo. Bez nich vidíte jen historii.</div>
            </div>
            <span className="shrink-0 bg-rose text-white rounded-full px-4 py-2 text-[0.78rem] font-medium group-hover:bg-rose-deep transition-colors">Doplnit data →</span>
          </button>
        )}
        {tab === 'dashboard' && (
          isTransaction && Array.isArray(d.blocks_overview || d.blocks) ? (
            <BlockRenderer blocks={(d.blocks_overview || d.blocks) as Block[]} />
          ) : (
          <DashboardTab
            ledger={ledger} tiers={tiers} extras={extras} fixedCosts={fixedCosts}
            variablePct={variablePct} budget={budget} receivables={receivables}
            taxes={taxesData} vat={vat} profile={profile}
            recommendations={recommendations} timeline={timeline}
            businessModel={businessModel} whatifBase={d.whatif_base}
            onTabChange={handleTabChange}
            onProfileChange={v => updateData('business_profile', v)}
          />
          )
        )}
        {tab === 'monthly' && (
          <MonthlyPlanTab ledger={ledger} taxDeadlines={taxDeadlines} complexity={profile.complexity} onLedgerChange={v => updateData('ledger', v)} />
        )}
        {tab === 'vat' && (
          <VatTab vat={vat} ledger={ledger} capexVat={capexVat} profile={profile} onVatChange={v => updateData('vat', v)} />
        )}
        {tab === 'taxes' && (
          isTransaction
            ? <TaxOverviewTab ledger={ledger} whatifBase={d.whatif_base} eshop={eshop} />
            : <TaxesTab taxes={taxesData} taxDeadlines={taxDeadlines} complexity={profile.complexity} onTaxesChange={v => updateData('taxes', v)} />
        )}
        {tab === 'hospodareni' && (
          <div className="space-y-8">
            <PnlTab ledger={ledger} view={cfoYear} onViewChange={setCfoYear} />
            {Array.isArray(d.blocks_pnl) && d.blocks_pnl.length > 0 && <BlockRenderer blocks={d.blocks_pnl as Block[]} />}
          </div>
        )}
        {tab === 'whatif' && (
          <WhatIfTab base={d.whatif_base} onBaseChange={v => updateData('whatif_base', v)} eshop={eshop} />
        )}
        {tab === 'receivables' && (
          <ReceivablesTab receivables={receivables} onReceivablesChange={v => updateData('receivables', v)} />
        )}
        {tab === 'risks' && <RisksTab data={d} onRisksChange={v => updateData('risks', v)} onStepsChange={v => updateData('steps', v)} />}
        {tab === 'questions' && <QuestionsTab data={d} onQuestionsChange={v => updateData('questions', v)} />}
        {tab === 'import' && (
          isTransaction ? (
            <FillMonthTab ledger={ledger} whatifBase={d.whatif_base} onLedgerChange={v => updateData('ledger', v)} />
          ) : (
          <ImportTab
            ledger={ledger}
            receivables={receivables}
            onLedgerChange={v => updateData('ledger', v)}
            onReceivablesChange={v => updateData('receivables', v)}
          />
          )
        )}
        </div>
      </div>
      <AssistantWidget clientId={targetClientId} clientName={isAdminView ? clientName : ''} />
    </>
  )
}
