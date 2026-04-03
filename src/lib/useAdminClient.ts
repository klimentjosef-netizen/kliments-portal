'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Report } from '@/lib/types'

interface UseAdminClientResult {
  report: Report | null
  loading: boolean
  isAdmin: boolean
  isAdminNoPick: boolean
  isAdminView: boolean
  clientName: string
  clientParam: string | null
}

export function useAdminClient(reportType: string, clientParam: string | null): UseAdminClientResult {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAdminNoPick, setIsAdminNoPick] = useState(false)
  const [isAdminView, setIsAdminView] = useState(false)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      const admin = profile?.role === 'admin'
      setIsAdmin(admin)

      let targetId = user.id
      if (admin) {
        if (clientParam) {
          targetId = clientParam
          setIsAdminView(true)
          const { data: cp } = await supabase.from('profiles').select('name').eq('id', clientParam).single()
          if (cp) setClientName(cp.name)
        } else {
          setIsAdminNoPick(true)
          setLoading(false)
          return
        }
      }

      const { data } = await supabase
        .from('reports').select('*')
        .eq('client_id', targetId).eq('type', reportType)
        .order('created_at', { ascending: false }).limit(1).single()
      if (data) setReport(data as Report)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientParam, reportType])

  return { report, loading, isAdmin, isAdminNoPick, isAdminView, clientName, clientParam }
}
