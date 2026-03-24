'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import type { Report } from '@/lib/types'

export default function InvestorPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', user.id).eq('type', 'investor')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  }, [])

  const d = report?.data || {}

  if (loading) return <><Topbar title="Příprava na investora" /><div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Příprava na investora" /><div className="p-9"><EmptyState /></div></>

  return (
    <>
      <Topbar title="Příprava na investora" />
      <div className="p-9">
        {/* Header */}
        <div className="rounded-[20px] p-7 mb-6 flex justify-between items-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #b5606a, #c97b84, #b89878)' }}>
          <div className="absolute w-72 h-72 rounded-full -right-20 -top-20 bg-white/[0.08]" />
          <div className="relative z-10">
            <h2 className="font-serif text-2xl text-white font-light mb-1.5">{d.title || 'Příprava na investora'}</h2>
            <p className="text-[0.8rem] text-white/60">{d.subtitle || ''}</p>
          </div>
          <span className="bg-white/20 text-white px-5 py-2 rounded-full text-[0.68rem] tracking-[0.1em] relative z-10">{d.badge || 'Seed Round'}</span>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-6">
          {/* Checklist */}
          {d.checklist && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Checklist připravenosti</h3>
              <div className="space-y-2">
                {(d.checklist as { done: boolean; text: string }[]).map((item, i) => (
                  <div key={i} className="flex gap-2.5 items-center p-2.5 rounded-lg bg-sand text-[0.8rem]">
                    <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 text-[0.7rem] ${
                      item.done ? 'bg-green text-white' : 'bg-rose-blush text-rose-deep'
                    }`}>
                      {item.done ? '✓' : '✗'}
                    </div>
                    <span className={item.done ? 'text-ink' : 'text-rose-deep font-medium'}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          {d.metrics && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Klíčové metriky</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {(d.metrics as { label: string; value: string; trend: string; up: boolean }[]).map((m, i) => (
                  <div key={i} className="bg-sand rounded-2xl p-3.5">
                    <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1">{m.label}</div>
                    <div className="font-serif text-xl font-light text-rose leading-none">{m.value}</div>
                    <div className={`text-[0.68rem] mt-1 ${m.up ? 'text-green' : 'text-rose-deep'}`}>{m.trend}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MRR projection */}
        {d.mrr_projection && (
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-base text-ink">MRR projekce — 12 měsíců</h3>
              <span className="text-[0.7rem] text-rose">Cíl: {d.mrr_target || ''}</span>
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {(d.mrr_projection as number[]).map((v, i) => (
                <div key={i} className="flex-1 bg-rose rounded-t opacity-85 last:opacity-100"
                  style={{ height: `${v}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}