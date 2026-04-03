'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import SaveToast from '@/components/SaveToast'
import AdminClientPicker from '@/components/AdminClientPicker'
import type { Report } from '@/lib/types'

interface Step { num: string; deadline: string; title: string; desc: string; done?: boolean; notes?: string }

export default function ValuacePage() {
  return (<Suspense fallback={<><Topbar title="Prodej za maximum" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>}><ValuacePageInner /></Suspense>)
}
function ValuacePageInner() {
  const searchParams = useSearchParams()
  const clientParam = searchParams.get('client')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('')
  const [isAdminNoPick, setIsAdminNoPick] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true); setIsAdminNoPick(false); setReport(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      let targetId = user.id
      if (profile?.role === 'admin') {
        if (clientParam) { targetId = clientParam } else { setIsAdminNoPick(true); setLoading(false); return }
      }
      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', targetId).eq('type', 'valuace')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientParam])

  const autoSave = useCallback(async (newData: Record<string, unknown>) => {
    if (!report) return
    setSaveStatus('Ukládám...')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const { error } = await supabase.from('reports').update({ data: newData }).eq('id', report.id)
      if (error) { setSaveStatus('Chyba ukládání'); setTimeout(() => setSaveStatus(''), 3000) }
      else setSaveStatus('✓ Uloženo ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }))
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])

  function updateData(key: string, value: unknown) {
    if (!report) return
    const newData = { ...report.data, [key]: value }
    setReport({ ...report, data: newData })
    autoSave(newData)
  }

  const d = report?.data || {}

  if (isAdminNoPick) return <AdminClientPicker serviceName="Prodej za maximum" pageUrl="/valuace" title="Prodej za maximum" />
  if (loading) return <><Topbar title="Prodej za maximum" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Prodej za maximum" /><div className="p-4 lg:p-9"><EmptyState service="Prodej za maximum" /></div></>

  const steps = (d.steps || []) as Step[]

  function toggleStep(i: number) {
    updateData('steps', steps.map((s, j) => j === i ? { ...s, done: !s.done } : s))
  }

  function updateStepNotes(i: number, notes: string) {
    updateData('steps', steps.map((s, j) => j === i ? { ...s, notes } : s))
  }

  return (
    <>
      <Topbar title="Prodej za maximum" />
      <SaveToast status={saveStatus} />
      <div className="p-4 lg:p-9">
        {/* Result banner */}
        {d.result && (
          <div className="bg-ink rounded-[20px] p-7 grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 relative overflow-hidden">
            <div className="absolute right-5 bottom-[-20px] font-serif italic text-[120px] text-white/[0.04] leading-none pointer-events-none">
              {d.result.value || ''}
            </div>
            {(d.result.items as { label: string; value: string; sub: string; main?: boolean }[]).map((item: { label: string; value: string; sub: string; main?: boolean }, i: number) => (
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
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

          {/* Action plan - interactive */}
          {steps.length > 0 && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Akční plán před prodejem</h3>
              <div className="space-y-3">
                {steps.map((s, i) => (
                  <div key={i} className={`flex gap-3 items-start p-3 border border-black/[0.06] rounded-[14px] ${s.done ? 'opacity-50' : ''}`}>
                    <div className="font-serif text-xl font-light text-rose-pale min-w-[28px]">{s.num}</div>
                    <div className="flex-1">
                      <div className="text-[0.62rem] tracking-[0.12em] uppercase text-rose font-medium mb-1">{s.deadline}</div>
                      <div className={`text-[0.85rem] font-medium text-ink mb-0.5 ${s.done ? 'line-through' : ''}`}>{s.title}</div>
                      <div className="text-[0.75rem] text-mid mb-2">{s.desc}</div>
                      <input
                        value={s.notes || ''}
                        onChange={e => updateStepNotes(i, e.target.value)}
                        placeholder="Vaše poznámka..."
                        className="w-full bg-sand/50 rounded-lg px-3 py-1.5 text-[0.72rem] text-mid outline-none focus:ring-1 focus:ring-rose/30"
                      />
                    </div>
                    <button
                      onClick={() => toggleStep(i)}
                      className={`text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 rounded flex-shrink-0 cursor-pointer transition-colors ${
                        s.done ? 'bg-green/10 text-green' : 'bg-black/5 text-mid hover:bg-green/10 hover:text-green'
                      }`}
                    >
                      {s.done ? '✓' : 'Hotovo'}
                    </button>
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
