'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import type { Report } from '@/lib/types'

export default function CfoPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', user.id).eq('type', 'cfo')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  }, [])

  const d = report?.data || {}

  if (loading) return <><Topbar title="CFO na volné noze" /><div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="CFO na volné noze" /><div className="p-9"><EmptyState /></div></>

  return (
    <>
      <Topbar title="CFO na volné noze" />
      <div className="p-9">
        <div className="bg-ink rounded-[20px] p-7 mb-6 flex justify-between items-start relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
          <div>
            <h2 className="font-serif text-xl text-sand font-light mb-1.5">{d.title || 'CFO na volné noze'}</h2>
            <p className="text-[0.78rem] text-white/40">{d.subtitle || ''}</p>
          </div>
          <span className="bg-green text-white px-5 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium">Aktivní ●</span>
        </div>

        {/* KPIs */}
        {d.kpis && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {(d.kpis as { label: string; value: string; delta: string; up: boolean }[]).map((k, i) => (
              <div key={i} className="bg-white rounded-[14px] p-4 border border-black/[0.06]">
                <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1.5">{k.label}</div>
                <div className="font-serif text-xl font-light text-rose leading-none">{k.value}</div>
                <div className={`text-[0.68rem] mt-1 ${k.up ? 'text-green' : 'text-rose-deep'}`}>{k.delta}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 mb-6">
          {/* Cashflow */}
          {d.cashflow_months && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Cashflow — 6 měsíců</h3>
              <div className="flex items-end gap-2 h-24">
                {(d.cashflow_months as { label: string; value: number; amount: string }[]).map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[0.62rem] font-medium text-mid">{m.amount}</span>
                    <div className={`w-full rounded-t ${m.value >= 0 ? 'bg-rose' : 'bg-rose-pale'}`}
                      style={{ height: `${Math.min(Math.abs(m.value), 100)}%` }} />
                    <span className="text-[0.6rem] text-mid">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {d.risks && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Rizika tohoto měsíce</h3>
              <div className="space-y-2.5">
                {(d.risks as { level: string; title: string; desc: string }[]).map((r, i) => (
                  <div key={i} className={`flex gap-3 items-start p-3 rounded-lg ${
                    r.level === 'critical' ? 'bg-[#fdf0f0]' : r.level === 'medium' ? 'bg-[#fff8f0]' : 'bg-[#eef6f1]'
                  }`}>
                    <span className={`text-[0.58rem] tracking-[0.1em] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                      r.level === 'critical' ? 'bg-rose/20 text-rose-deep' : r.level === 'medium' ? 'bg-amber/20 text-amber' : 'bg-green/20 text-green'
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
        </div>

        {/* Action plan */}
        {d.steps && (
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
            <h3 className="font-serif text-base text-ink mb-4">Akční plán</h3>
            <div className="grid grid-cols-3 gap-3.5">
              {(d.steps as { num: string; deadline: string; title: string; desc: string }[]).map((s, i) => (
                <div key={i} className="rounded-[14px] p-5 border border-black/[0.06]">
                  <div className="font-serif text-3xl font-light text-rose-pale mb-2">{s.num}</div>
                  <div className="text-[0.62rem] tracking-[0.12em] uppercase text-rose font-medium mb-1.5">{s.deadline}</div>
                  <div className="text-[0.85rem] font-medium text-ink mb-1">{s.title}</div>
                  <div className="text-[0.75rem] text-mid leading-relaxed">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}