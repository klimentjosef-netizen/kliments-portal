'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import type { Profile } from '@/lib/types'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) setProfile(data as Profile)
    }
    loadProfile()
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <main className="ml-60 flex-1 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  )
}