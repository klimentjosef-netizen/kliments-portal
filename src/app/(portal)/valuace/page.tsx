'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import type { Report } from '@/lib/types'

export default function ValuacePage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', user.id).eq('type', 'valuace')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  }, [])

  const d = report?.data || {}

  if (loading) return <><Topbar title="Prodej za maximum" /><div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Prodej za maximum" /><div className="p-9"><EmptyState /></div></>

  return (
    <>
      <Topbar title="Prodej za maximum" />
      <div className="p-9">
        {/* Result banner */}
        {d.result && (
          <div className="bg-ink rounded-[20px] p-7 grid grid-cols-3 gap-6 mb-6 relative overflow-hidden">
            <div className="absolute right-5 bottom-[-20px] font-serif italic text-[120px] text-white/[0.04] leading-none pointer-events-none">
              {d.result.value || ''}
            </div>
            {(d.result.items as { label: string; value: string; sub: string; main?: boolean }[]).map((item, i) => (
              <div key={i}>
                <div className="text-[0.62rem] tracking-[0.12em] uppercase text-white/30 mb-1.5">{item.label}</div>
                <div className={`font-serif font-light text-rose-pale leading-none ${item.main ? 'text-3xl' : 'text-lg'}`}>{item.value}</div>
                <div className="text-[0.7rem] text-white/40 mt-1">{item.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Methods */}
        {d.methods && (
          <div className="grid grid-cols-3 gap-3.5 mb-6">
            {(d.methods as { name: string; value: string; weight: number }[]).map((m, i) => (
              <div key={i} className="bg-white rounded-[14px] p-5 border border-black/[0.06]">
                <div className="text-[0.72rem] font-semibold text-ink mb-1 tracking-[0.06em]">{m.name}</div>
                <div className="font-serif text-xl text-rose mb-1">{m.value}</div>
                <div className="text-[0.65rem] text-mid">Váha {m.weight} %</div>
                <div className="h-1 bg-rose-pale rounded-full mt-2.5">
                  <div className="h-full bg-rose rounded-full" style={{ width: `${m.weight}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 mb-6">
          {/* Revenue chart */}
          {d.revenue_years && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Vývoj tržeb</h3>
              <div className="flex items-end gap-3 h-24">
                {(d.revenue_years as { label: string; value: number; amount: string }[]).map((y, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[0.62rem] font-medium text-mid">{y.amount}</span>
                    <div className="w-full bg-rose rounded-t" style={{ height: `${y.value}%` }} />
                    <span className="text-[0.6rem] text-mid">{y.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action plan */}
          {d.steps && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Akční plán před prodejem</h3>
              <div className="space-y-3">
                {(d.steps as { num: string; deadline: string; title: string; desc: string }[]).map((s, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 border border-black/[0.06] rounded-[14px]">
                    <div className="font-serif text-xl font-light text-rose-pale min-w-[28px]">{s.num}</div>
                    <div>
                      <div className="text-[0.62rem] tracking-[0.12em] uppercase text-rose font-medium mb-1">{s.deadline}</div>
                      <div className="text-[0.85rem] font-medium text-ink mb-0.5">{s.title}</div>
                      <div className="text-[0.75rem] text-mid">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}