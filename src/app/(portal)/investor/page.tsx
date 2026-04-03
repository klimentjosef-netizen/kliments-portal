'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import SaveToast from '@/components/SaveToast'
import AdminClientPicker from '@/components/AdminClientPicker'
import type { Report } from '@/lib/types'

interface CheckItem { done: boolean; text: string }
interface Metric { label: string; value: string; trend: string; up: boolean }

export default function InvestorPage() {
  return (<Suspense fallback={<><Topbar title="Příprava na investora" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>}><InvestorPageInner /></Suspense>)
}
function InvestorPageInner() {
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
        .eq('client_id', targetId).eq('type', 'investor')
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

  if (isAdminNoPick) return <AdminClientPicker serviceName="Příprava na investora" pageUrl="/investor" title="Příprava na investora" />
  if (loading) return <><Topbar title="Příprava na investora" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Příprava na investora" /><div className="p-4 lg:p-9"><EmptyState service="Příprava na investora" /></div></>

  const checklist = (d.checklist || []) as CheckItem[]
  const metrics = (d.metrics || []) as Metric[]
  const doneCount = checklist.filter(c => c.done).length
  const completionPct = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0

  function toggleCheck(i: number) {
    updateData('checklist', checklist.map((c, j) => j === i ? { ...c, done: !c.done } : c))
  }

  function updateMetricValue(i: number, value: string) {
    updateData('metrics', metrics.map((m, j) => j === i ? { ...m, value } : m))
  }

  return (
    <>
      <Topbar title="Příprava na investora" />
      <SaveToast status={saveStatus} />
      <div className="p-4 lg:p-9">
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

        {/* Completion progress */}
        {checklist.length > 0 && (
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06] mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-serif text-base text-ink">Připravenost</h3>
              <span className={`text-[0.82rem] font-medium ${completionPct === 100 ? 'text-green' : 'text-rose'}`}>{completionPct} %</span>
            </div>
            <div className="h-2 bg-sand rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${completionPct === 100 ? 'bg-green' : 'bg-rose'}`} style={{ width: `${completionPct}%` }} />
            </div>
            <div className="text-[0.72rem] text-mid mt-1.5">{doneCount} z {checklist.length} splněno</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          {/* Checklist - interactive */}
          {checklist.length > 0 && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Checklist připravenosti</h3>
              <div className="space-y-2">
                {checklist.map((item, i) => (
                  <button key={i} onClick={() => toggleCheck(i)}
                    className="flex gap-2.5 items-center p-2.5 rounded-lg bg-sand text-[0.8rem] w-full text-left hover:bg-sand-deep transition-colors">
                    <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 text-[0.7rem] transition-colors ${
                      item.done ? 'bg-green text-white' : 'bg-rose-blush text-rose-deep'
                    }`}>
                      {item.done ? '✓' : '✗'}
                    </div>
                    <span className={item.done ? 'text-ink' : 'text-rose-deep font-medium'}>{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Metrics - editable values */}
          {metrics.length > 0 && (
            <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
              <h3 className="font-serif text-base text-ink mb-4">Klíčové metriky</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {metrics.map((m, i) => (
                  <div key={i} className="bg-sand rounded-2xl p-3.5">
                    <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid mb-1">{m.label}</div>
                    <input
                      value={m.value}
                      onChange={e => updateMetricValue(i, e.target.value)}
                      className="font-serif text-xl font-light text-rose leading-none bg-transparent outline-none border-b border-transparent focus:border-rose w-full"
                    />
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
              <h3 className="font-serif text-base text-ink">MRR projekce: 12 měsíců</h3>
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
