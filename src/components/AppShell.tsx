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
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let userId: string | null = null

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) setProfile(data as Profile)

      // Load unread count
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false)

      setUnreadCount(count || 0)
    }
    loadProfile()

    // Realtime subscription for new messages
    const channel = supabase
      .channel('unread-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as { receiver_id: string }
        if (msg.receiver_id === userId) {
          setUnreadCount(prev => prev + 1)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Reset unread when visiting messages page
  useEffect(() => {
    if (pathname === '/zpravy') {
      setUnreadCount(0)
    }
  }, [pathname])

  // Route protection: redirect clients to dashboard if they access unauthorized pages
  useEffect(() => {
    if (!profile || profile.role === 'admin') return
    const allowed = getRoutesForService(profile.service)
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
        <Sidebar profile={profile} onNavigate={() => setSidebarOpen(false)} unreadCount={unreadCount} />
      </div>

      {/* Main */}
      <main className="lg:ml-60 flex-1 min-h-screen flex flex-col w-full">
        {/* Mobile topbar with hamburger */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-sand/90 backdrop-blur-md border-b border-black/[0.06] sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 relative">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#1f1a18" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose text-white text-[0.5rem] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <span className="font-serif text-base text-ink">Kliments<span className="text-rose">.</span></span>
        </div>
        {children}
      </main>
    </div>
  )
}
