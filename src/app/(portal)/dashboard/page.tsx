'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import type { Profile, Report } from '@/lib/types'
import Link from 'next/link'

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

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-9">
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
          <div className="grid grid-cols-4 gap-4 mb-7">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-black/[0.06] animate-pulse">
                <div className="h-3 bg-sand-pale rounded w-20 mb-3" />
                <div className="h-8 bg-sand-pale rounded w-16 mb-2" />
                <div className="h-2 bg-sand-pale rounded w-24" />
              </div>
            ))}
          </div>
        ) : !report ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-7">
              <StatCard
                label="Cashflow tento měsíc"
                value={d.cashflow || '—'}
                sub="Kč čistý CF"
                trend={d.cashflow_trend}
                trendUp={d.cashflow_trend_up}
              />
              <StatCard
                label="Tržby"
                value={d.revenue || '—'}
                sub="Kč celkem"
                trend={d.revenue_trend}
                trendUp={d.revenue_trend_up}
              />
              <StatCard
                label="EBITDA marže"
                value={d.ebitda || '—'}
                sub={d.ebitda_period || ''}
                trend={d.ebitda_trend}
                trendUp={d.ebitda_trend_up}
              />
              <StatCard
                label="Pohledávky"
                value={d.receivables || '—'}
                sub="Kč po splatnosti"
                trend={d.receivables_note}
                trendUp={false}
              />
            </div>

            {/* Cashflow chart */}
            {d.cashflow_months && (
              <div className="bg-white rounded-[20px] p-6 border border-black/[0.06] mb-7">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-serif text-base text-ink">Cashflow — posledních 6 měsíců</h3>
                </div>
                <div className="flex items-end gap-2 h-20">
                  {(d.cashflow_months as { label: string; value: number }[]).map((m: { label: string; value: number }, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${m.value >= 0 ? 'bg-rose' : 'bg-rose-pale'}`}
                        style={{ height: `${Math.abs(m.value)}%` }}
                      />
                      <span className="text-[0.6rem] text-mid">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {d.risks && (
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