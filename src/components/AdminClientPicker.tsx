'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/lib/types'

interface AdminClientPickerProps {
  serviceName: string
  pageUrl: string
  title: string
}

export default function AdminClientPicker({ serviceName, pageUrl, title }: AdminClientPickerProps) {
  const [clients, setClients] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles').select('*')
        .eq('role', 'client').eq('active', true)
        .order('name')
      if (data) {
        // Filter clients whose service field contains this service name
        const filtered = (data as Profile[]).filter(c =>
          c.service && c.service.split(',').map(s => s.trim()).includes(serviceName)
        )
        setClients(filtered)
      }
      setLoading(false)
    }
    load()
  }, [serviceName])

  return (
    <>
      <Topbar title={title} />
      <div className="p-4 lg:p-9">
        <div className="bg-ink rounded-[20px] p-7 mb-6 relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-40px] font-serif italic text-[180px] text-white/[0.04] leading-none pointer-events-none">K</div>
          <h2 className="font-serif text-xl text-sand font-light mb-1.5">{title}</h2>
          <p className="text-[0.78rem] text-white/40">Vyberte klienta pro zobrazení dashboardu</p>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-2xl" />)}
          </div>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-[20px] p-8 border border-black/[0.06] text-center">
            <p className="text-mid text-sm">Žádní klienti s touto službou.</p>
            <a href="/portal/admin" className="text-rose text-sm hover:text-rose-deep mt-2 inline-block">Přiřadit službu klientovi →</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`${pageUrl}?client=${c.id}`)}
                className="bg-white rounded-[20px] p-5 border border-black/[0.06] hover:border-rose/30 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose flex items-center justify-center font-serif text-sm text-white italic flex-shrink-0">
                    {c.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.88rem] font-medium text-ink truncate group-hover:text-rose transition-colors">{c.name}</div>
                    <div className="text-[0.72rem] text-mid truncate">{c.email}</div>
                  </div>
                  <span className="text-mid group-hover:text-rose transition-colors text-lg">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
