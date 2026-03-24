'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import EmptyState from '@/components/EmptyState'
import type { Report } from '@/lib/types'

export default function MentoringPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', user.id).eq('type', 'mentoring')
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  }, [])

  const d = report?.data || {}

  if (loading) return <><Topbar title="Mentoring" /><div className="p-9"><div className="animate-pulse h-40 bg-white rounded-[20px]" /></div></>
  if (!report) return <><Topbar title="Mentoring" /><div className="p-9"><EmptyState /></div></>

  return (
    <>
      <Topbar title="Mentoring" />
      <div className="p-9">
        {d.sessions && (d.sessions as { num: string; topic: string; date: string; notes: string; tasks: { text: string; done: boolean }[] }[]).map((session, i) => (
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

            {session.tasks && session.tasks.length > 0 && (
              <div className="space-y-1.5">
                {session.tasks.map((task, j) => (
                  <div key={j} className="flex gap-2 items-center text-[0.76rem] text-mid">
                    <div className={`w-3.5 h-3.5 rounded flex-shrink-0 ${task.done ? 'bg-green' : 'border-[1.5px] border-black/10'}`} />
                    <span className={task.done ? 'line-through opacity-60' : ''}>{task.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}