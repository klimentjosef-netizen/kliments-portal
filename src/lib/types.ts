export type UserRole = 'admin' | 'client'

export interface Profile {
  id: string
  email: string
  name: string
  role: UserRole
  service: string | null
  active: boolean
}

export interface Report {
  id: string
  client_id: string
  type: 'diagnoza' | 'cfo' | 'valuace' | 'investor' | 'mentoring'
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  created_at?: string
}

export interface CfoReportData {
  title: string
  subtitle: string
  status?: 'active' | 'paused' | 'completed'
  summary?: string

  // Dashboard backward compat
  cashflow?: string
  revenue?: string
  ebitda?: string
  receivables?: string
  cashflow_trend?: string
  cashflow_trend_up?: boolean
  revenue_trend?: string
  revenue_trend_up?: boolean
  ebitda_trend?: string
  ebitda_trend_up?: boolean
  ebitda_period?: string
  receivables_note?: string

  // KPIs
  kpis?: Array<{ label: string; value: string; delta?: string; up?: boolean }>

  // P&L
  monthly_pnl?: {
    revenues: Array<{ name: string; amount: number }>
    costs: Array<{ name: string; amount: number }>
  }

  // Cashflow
  cashflow_months?: Array<{
    label: string
    revenue: number
    costs: number
    ebitda: number
    cumulative: number
  }>
  revenue_mix?: Array<{ label: string; amount: number }>

  // Budget
  budget?: {
    total: number
    capex_budget: number
    reserve_budget: number
    capex_items: Array<{ name: string; amount: number }>
    reserve_drawn: number
    monthly_loss_estimate?: number
  }

  // Risks & plan
  risks?: Array<{ level: 'critical' | 'medium' | 'low'; title: string; desc: string }>
  steps?: Array<{ num: string; deadline: string; title: string; desc: string; done?: boolean }>

  // Questions
  questions?: Array<{ question: string; status: 'open' | 'resolved'; answer?: string }>
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at?: string
}