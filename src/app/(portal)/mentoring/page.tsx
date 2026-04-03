'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import SaveToast from '@/components/SaveToast'
import AdminClientPicker from '@/components/AdminClientPicker'
import type { Report } from '@/lib/types'

interface Task { text: string; done: boolean }
interface Session { num: string; topic: string; date: string; notes: string; tasks: Task[]; client_notes?: string }

export default function MentoringPage() {
  return (<Suspense fallback={<><Topbar title="Mentoring" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>}><MentoringPageInner /></Suspense>)
}
function MentoringPageInner() {
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
        .eq('client_id', targetId).eq('type', 'mentoring')
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
  const sessions = (d.sessions || []) as Session[]

  if (isAdminNoPick) return <AdminClientPicker serviceName="Mentoring" pageUrl="/mentoring" title="Mentoring" />
  if (loading) return <><Topbar title="Mentoring" /><div className="p-4 lg:p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Mentoring" /><div className="p-4 lg:p-9"><EmptyState service="Mentoring" /></div></>

  function toggleTask(sessionIdx: number, taskIdx: number) {
    const updated = sessions.map((s, si) =>
      si === sessionIdx ? { ...s, tasks: s.tasks.map((t, ti) => ti === taskIdx ? { ...t, done: !t.done } : t) } : s
    )
    updateData('sessions', updated)
  }

  function updateClientNotes(sessionIdx: number, client_notes: string) {
    const updated = sessions.map((s, si) => si === sessionIdx ? { ...s, client_notes } : s)
    updateData('sessions', updated)
  }

  return (
    <>
      <Topbar title="Mentoring" />
      <SaveToast status={saveStatus} />
      <div className="p-4 lg:p-9">
        {sessions.map((session, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-black/[0.06] mb-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <span className="font-serif text-2xl text-rose-pale font-light">{session.num}</span>
                <div>
                  <div className="text-[0.88rem] font-medium text-ink">{session.topic}</div>
                  <div className="text-[0.7rem] text-mid">{session.date}</div>
                </div>
              </div>
            </div>

            <div className="bg-sand rounded-lg p-4 text-[0.78rem] text-mid leading-relaxed mb-3">
              {session.notes}
            </div>

            {/* Tasks - interactive */}
            {session.tasks && session.tasks.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {session.tasks.map((task, j) => (
                  <button key={j} onClick={() => toggleTask(i, j)}
                    className="flex gap-2 items-center text-[0.76rem] text-mid w-full text-left hover:bg-sand/50 rounded px-1 py-0.5 transition-colors">
                    <div className={`w-3.5 h-3.5 rounded flex-shrink-0 transition-colors ${task.done ? 'bg-green' : 'border-[1.5px] border-black/10'}`} />
                    <span className={task.done ? 'line-through opacity-60' : ''}>{task.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Client notes */}
            <textarea
              value={session.client_notes || ''}
              onChange={e => updateClientNotes(i, e.target.value)}
              placeholder="Vaše poznámky k sezení..."
              rows={2}
              className="w-full bg-sand/50 rounded-lg px-4 py-2.5 text-[0.76rem] text-mid outline-none focus:ring-1 focus:ring-rose/30 resize-none"
            />
          </div>
        ))}
      </div>
    </>
  )
}
