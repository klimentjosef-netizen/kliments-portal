'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getRoutesForService } from '@/lib/services'
import type { Profile } from '@/lib/types'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Finanční diagnóza', href: '/diagnoza', icon: '🔍' },
  { label: 'CFO na volné noze', href: '/cfo', icon: '📈' },
  { label: 'Prodej za maximum', href: '/valuace', icon: '⭐' },
  { label: 'Příprava na investora', href: '/investor', icon: '📋' },
  { label: 'Mentoring', href: '/mentoring', icon: '👤' },
  { label: 'Zprávy', href: '/zpravy', icon: '💬', badge: true },
]

export default function Sidebar({ profile, onNavigate, unreadCount = 0 }: { profile: Profile | null; onNavigate?: () => void; unreadCount?: number }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Admin sees everything, clients see only their service routes
  const isAdmin = profile?.role === 'admin'
  const allowedRoutes = isAdmin ? NAV_ITEMS.map(i => i.href) : getRoutesForService(profile?.service)
  const visibleItems = NAV_ITEMS.filter(item => allowedRoutes.includes(item.href))

  return (
    <aside className="w-60 min-h-screen bg-ink fixed left-0 top-0 bottom-0 z-50 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/[0.07]">
        <span className="font-serif text-xl text-sand">
          Kliments<span className="text-rose text-2xl leading-none -mb-1">.</span>
        </span>
      </div>

      {/* User */}
      <div className="px-6 py-5 border-b border-white/[0.07] flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-rose flex items-center justify-center font-serif text-sm text-white italic flex-shrink-0">
          {profile?.name?.charAt(0) || '?'}
        </div>
        <div className="overflow-hidden">
          <div className="text-[0.82rem] font-medium text-sand truncate">{profile?.name || 'Načítám...'}</div>
          <div className="text-[0.68rem] text-white/25 tracking-wider">{isAdmin ? 'Admin' : 'Klient'}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="text-[0.58rem] tracking-[0.2em] uppercase text-white/20 px-6 py-2">Přehled</div>
        {visibleItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-6 py-2.5 text-[0.8rem] transition-colors relative ${
                active
                  ? 'text-sand bg-rose/15'
                  : 'text-white/40 hover:text-sand hover:bg-white/[0.04]'
              }`}
            >
              {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-rose rounded-r" />}
              <span className="text-sm">{item.icon}</span>
              {item.label}
              {item.badge && unreadCount > 0 && (
                <span className="ml-auto bg-rose text-white text-[0.58rem] font-semibold w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="text-[0.58rem] tracking-[0.2em] uppercase text-white/20 px-6 py-2 mt-4">Admin</div>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-6 py-2.5 text-[0.8rem] transition-colors relative ${
                pathname === '/admin'
                  ? 'text-sand bg-rose/15'
                  : 'text-white/40 hover:text-sand hover:bg-white/[0.04]'
              }`}
            >
              {pathname === '/admin' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-rose rounded-r" />}
              <span className="text-sm">👥</span>
              Klienti
            </Link>
            <Link
              href="/admin/reports"
              className={`flex items-center gap-3 px-6 py-2.5 text-[0.8rem] transition-colors relative ${
                pathname === '/admin/reports'
                  ? 'text-sand bg-rose/15'
                  : 'text-white/40 hover:text-sand hover:bg-white/[0.04]'
              }`}
            >
              {pathname === '/admin/reports' && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-rose rounded-r" />}
              <span className="text-sm">📝</span>
              Reporty
            </Link>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-6 py-4 border-t border-white/[0.07]">
        {profile?.service && (
          <div className="bg-rose/20 border border-rose/30 rounded-lg px-3 py-2.5 mb-3">
            <div className="text-[0.58rem] tracking-[0.14em] uppercase text-rose-pale mb-1">Aktivní služba</div>
            <div className="text-[0.78rem] text-sand font-medium">{profile.service}</div>
          </div>
        )}
        <button
          onClick={logout}
          className="text-[0.72rem] text-white/30 hover:text-rose-pale transition-colors"
        >
          Odhlásit se
        </button>
      </div>
    </aside>
  )
}
