'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import type { Profile, Report } from '@/lib/types'
import Link from 'next/link'
import { type Tier, type Extra, type CostItem, type Budget, calcRevenue, calcOpex, calcBreakeven, calcCapexRoi, fmtShort } from '@/components/cfo/calcEngine'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (prof) setProfile(prof as Profile)

      const { data: rep } = await supabase
        .from('reports').select('*')
        .eq('client_id', user.id).eq('type', 'cfo')
        .order('created_at', { ascending: false }).limit(1).single()
      if (rep) setReport(rep as Report)

      setLoading(false)
    }
    load()
  }, [])

  const d = report?.data || {}

  // Compute real values from calcEngine if tiers exist
  const hasTiers = d.tiers && (d.tiers as Tier[]).length > 0
  const tiers = (d.tiers || []) as Tier[]
  const extras = (d.extras || []) as Extra[]
  const fixedCosts = (d.fixed_costs || []) as CostItem[]
  const variablePct = (d.variable_cost_pct ?? 5) as number
  const budget = (d.budget || { total: 0, capex_budget: 0, reserve_budget: 0, capex_items: [], reserve_drawn: 0 }) as Budget

  const rev = hasTiers ? calcRevenue(tiers, extras) : null
  const opex = rev ? calcOpex(fixedCosts, variablePct, rev.total) : null
  const ebitda = rev && opex ? rev.total - opex.total : null
  const ebitdaMargin = rev && rev.total > 0 && ebitda !== null ? Math.round((ebitda / rev.total) * 100) : null
  const breakeven = hasTiers ? calcBreakeven(tiers, fixedCosts, variablePct) : null
  const totalMembers = tiers.reduce((sum, t) => sum + t.members, 0)
  const capexRoi = ebitda !== null && ebitda > 0 && budget.capex_budget > 0 ? calcCapexRoi(budget.capex_budget, ebitda) : null

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-4 lg:p-9">
        {/* Welcome */}
        <div className="bg-ink rounded-[20px] p-7 flex justify-between items-center mb-7 relative overflow-hidden">
          <div className="absolute w-72 h-72 rounded-full -right-16 -top-20"
            style={{ background: 'radial-gradient(circle, rgba(201,123,132,0.2) 0%, transparent 70%)' }} />
          <div className="relative z-10">
            <h2 className="font-serif text-2xl text-sand font-light mb-1.5">
              Dobrý den{profile?.name ? `, ${profile.name}` : ''}
            </h2>
            <p className="text-[0.82rem] text-white/40">
              {profile?.service ? `Aktivní služba: ${profile.service}` : 'Vítejte v portálu'}
            </p>
          </div>
          <Link href="/zpravy"
            className="bg-rose text-white px-6 py-2.5 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors relative z-10 whitespace-nowrap">
            Napsat Josefovi →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-black/[0.06] animate-pulse">
                <div className="h-3 bg-sand-pale rounded w-20 mb-3" />
                <div className="h-8 bg-sand-pale rounded w-16 mb-2" />
                <div className="h-2 bg-sand-pale rounded w-24" />
              </div>
            ))}
          </div>
        ) : !report ? (
          <EmptyState service={profile?.service} />
        ) : (
          <>
            {/* Stats – computed or fallback to legacy strings */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              <StatCard
                label="Měsíční tržby"
                value={rev ? fmtShort(rev.total) : (d.revenue || '—')}
                sub={rev ? `z ${totalMembers} členů` : 'Kč celkem'}
                trend={rev && extras.length > 0 ? `+ ${fmtShort(rev.extraRevenue)} doplňkové` : d.revenue_trend}
                trendUp={rev ? (rev.total > 0) : d.revenue_trend_up}
              />
              <StatCard
                label="EBITDA"
                value={ebitda !== null ? fmtShort(ebitda) : (d.ebitda || '—')}
                sub={ebitdaMargin !== null ? `${ebitdaMargin} % marže` : (d.ebitda_period || '')}
                trend={ebitda !== null ? (ebitda >= 0 ? 'Ziskový' : 'Ztrátový') : d.ebitda_trend}
                trendUp={ebitda !== null ? ebitda >= 0 : d.ebitda_trend_up}
              />
              <StatCard
                label="Break-even"
                value={breakeven ? `${Math.ceil(breakeven.members)}` : '—'}
                sub={breakeven ? `členů potřeba (ø ${fmtShort(breakeven.avgPrice)})` : ''}
                trend={breakeven && totalMembers >= breakeven.members ? `Dosaženo (${totalMembers}/${Math.ceil(breakeven.members)})` : breakeven ? `${totalMembers}/${Math.ceil(breakeven.members)} členů` : undefined}
                trendUp={breakeven ? totalMembers >= breakeven.members : false}
              />
              <StatCard
                label="Návratnost CAPEX"
                value={capexRoi !== null ? `${Math.round(capexRoi)} měs.` : (d.receivables || '—')}
                sub={budget.capex_budget > 0 ? `z ${fmtShort(budget.capex_budget)} investice` : (d.receivables_note || '')}
                trend={capexRoi !== null && capexRoi <= 24 ? 'Do 2 let' : capexRoi !== null ? `${Math.round(capexRoi / 12)} let` : undefined}
                trendUp={capexRoi !== null ? capexRoi <= 24 : false}
              />
            </div>

            {/* Risks */}
            {d.risks && (d.risks as { level: string; title: string; desc: string }[]).length > 0 && (
              <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
                <h3 className="font-serif text-base text-ink mb-4">Aktuální rizika</h3>
                <div className="space-y-2.5">
                  {(d.risks as { level: string; title: string; desc: string }[]).map((r: { level: string; title: string; desc: string }, i: number) => (
                    <div key={i} className={`flex gap-3 items-start p-3 rounded-lg ${
                      r.level === 'critical' ? 'bg-[#fdf0f0]' :
                      r.level === 'medium' ? 'bg-[#fff8f0]' : 'bg-[#eef6f1]'
                    }`}>
                      <span className={`text-[0.58rem] tracking-[0.1em] font-semibold px-2 py-0.5 rounded ${
                        r.level === 'critical' ? 'bg-rose/20 text-rose-deep' :
                        r.level === 'medium' ? 'bg-amber/20 text-amber' : 'bg-green/20 text-green'
                      }`}>
                        {r.level === 'critical' ? 'KRITICKÉ' : r.level === 'medium' ? 'STŘEDNÍ' : 'NÍZKÉ'}
                      </span>
                      <div>
                        <div className="text-[0.8rem] font-medium text-ink">{r.title}</div>
                        <div className="text-[0.72rem] text-mid">{r.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
