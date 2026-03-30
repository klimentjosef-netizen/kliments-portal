'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import { getRoutesForService } from '@/lib/services'
import type { Profile } from '@/lib/types'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

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

  // Route protection: redirect clients to dashboard if they access unauthorized pages
  useEffect(() => {
    if (!profile || profile.role === 'admin') return
    const allowed = getRoutesForService(profile.service)
    // Check if current path starts with any allowed route (for nested routes like /admin/reports)
    const isAllowed = allowed.some(route => pathname === route || pathname.startsWith(route + '/'))
    if (!isAllowed) {
      router.replace('/dashboard')
    }
  }, [profile, pathname, router])

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static`}>
        <Sidebar profile={profile} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <main className="lg:ml-60 flex-1 min-h-screen flex flex-col w-full">
        {/* Mobile topbar with hamburger */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-sand/90 backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#1f1a18" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <span className="font-serif text-base text-ink">Kliments<span className="text-rose">.</span></span>
        </div>
        {children}
      </main>
    </div>
  )
}