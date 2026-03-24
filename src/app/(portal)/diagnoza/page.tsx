'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import type { Report } from '@/lib/types'

export default function DiagnozaPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', user.id).eq('type', 'diagnoza')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  }, [])

  const d = report?.data || {}

  if (loading) return <><Topbar title="Finanční diagnóza" /><div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Finanční diagnóza" /><div className="p-9"><EmptyState /></div></>

  return (
    <>
      <Topbar title="Finanční diagnóza" />
      <div className="p-9">
        {/* Header */}
        <div className="bg-ink rounded-[20px] p-7 mb-6 flex justify-between items-start relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
          <div>
            <h2 className="font-serif text-xl text-sand font-light mb-1.5">{d.title || 'Finanční diagnóza'}</h2>
            <p className="text-[0.78rem] text-white/40">{d.subtitle || ''}</p>
          </div>
          <span className="bg-rose text-white px-5 py-2 rounded-full text-[0.68rem] tracking-[0.1em] uppercase font-medium whitespace-nowrap">
            {d.status || 'Hotovo'} ✓
          </span>
        </div>

        {/* Metrics */}
        {d.metrics && (
          <div className="grid grid-cols-4 gap-3.5 mb-6">
            {(d.metrics as { label: string; value: string; sub: string; critical?: boolean }[]).map((m, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-black/[0.06]">
                <div className="text-[0.62rem] tracking-[0.1em] uppercase text-mid mb-1.5">{m.label}</div>
                <div className={`font-serif text-2xl font-light leading-none ${m.critical ? 'text-rose-deep' : 'text-rose'}`}>{m.value}</div>
                <div className={`text-[0.7rem] mt-1 ${m.critical ? 'text-rose-deep font-medium' : 'text-mid'}`}>{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Cashflow */}
        {d.cashflow_months && (
          <div className="bg-white rounded-2xl p-6 border border-black/[0.06] mb-6">
            <h3 className="font-serif text-base text-ink mb-4">Cashflow — posledních 6 měsíců</h3>
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

        {/* SWOT */}
        {d.strengths && d.weaknesses && (
          <div className="grid grid-cols-2 gap-3.5 mb-6">
            <div className="rounded-[14px] p-5 bg-[#eef6f1] border border-green/15">
              <div className="text-[0.7rem] font-semibold text-green tracking-[0.08em] uppercase mb-3">✓ Silné stránky</div>
              {(d.strengths as string[]).map((s, i) => (
                <div key={i} className="flex gap-2 mb-1.5 text-[0.78rem] text-mid">
                  <span className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0 mt-1.5" />{s}
                </div>
              ))}
            </div>
            <div className="rounded-[14px] p-5 bg-[#fdf0f0] border border-rose/15">
              <div className="text-[0.7rem] font-semibold text-rose-deep tracking-[0.08em] uppercase mb-3">✗ Slabé stránky</div>
              {(d.weaknesses as string[]).map((w, i) => (
                <div key={i} className="flex gap-2 mb-1.5 text-[0.78rem] text-mid">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose flex-shrink-0 mt-1.5" />{w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action steps */}
        {d.steps && (
          <>
            <h3 className="font-serif text-base text-ink mb-4">Akční plán</h3>
            <div className="grid grid-cols-3 gap-3.5">
              {(d.steps as { num: string; deadline: string; title: string; desc: string }[]).map((s, i) => (
                <div key={i} className="rounded-[14px] p-5 border border-black/[0.06] bg-white">
                  <div className="font-serif text-3xl font-light text-rose-pale mb-2">{s.num}</div>
                  <div className="text-[0.62rem] tracking-[0.12em] uppercase text-rose font-medium mb-1.5">{s.deadline}</div>
                  <div className="text-[0.85rem] font-medium text-ink mb-1">{s.title}</div>
                  <div className="text-[0.75rem] text-mid leading-relaxed">{s.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}