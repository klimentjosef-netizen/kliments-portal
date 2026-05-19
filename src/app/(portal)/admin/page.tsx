'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import OnboardingWizard from '@/components/admin/OnboardingWizard'
import type { Profile } from '@/lib/types'

const SERVICES = ['CFO na volné noze', 'Rozjeď to správně', 'Prodej za maximum', 'Firemní audit', 'Startup kit', 'Příprava na investora', 'Mentoring']

export default function AdminPage() {
  const [clients, setClients] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function refreshClients() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    if (data) setClients(data as Profile[])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') return

      setIsAdmin(true)
      await refreshClients()
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleActive(clientId: string, current: boolean) {
    await supabase.from('profiles').update({ active: !current }).eq('id', clientId)
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, active: !current } : c))
  }

  function getServices(service: string | null): string[] {
    if (!service) return []
    return service.split(',').map(s => s.trim()).filter(Boolean)
  }

  async function toggleService(clientId: string, currentService: string | null, svc: string) {
    const current = getServices(currentService)
    const updated = current.includes(svc) ? current.filter(s => s !== svc) : [...current, svc]
    const newService = updated.join(', ')
    await supabase.from('profiles').update({ service: newService || null }).eq('id', clientId)
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, service: newService || null } : c))
  }

  async function deleteClient(clientId: string, clientName: string) {
    const confirmed = window.confirm(
      `Opravdu smazat klienta "${clientName}"?\n\n` +
      `Tato akce smaže:\n` +
      `• účet (přihlášení do portálu)\n` +
      `• profil v databázi\n` +
      `• všechny reporty klienta\n\n` +
      `Akci nelze vrátit.`
    )
    if (!confirmed) return

    const res = await fetch('/portal/api/delete-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) {
      alert('Mazání selhalo: ' + (json.error || 'neznámá chyba'))
      return
    }
    setClients(prev => prev.filter(c => c.id !== clientId))
  }

  if (!isAdmin) return <><Topbar title="Admin" /><div className="p-4 lg:p-9 text-center text-mid">Přístup odepřen</div></>

  return (
    <>
      <Topbar title="Klienti" />
      <div className="p-4 lg:p-9">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-serif text-xl text-ink">Správa klientů</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-rose text-white px-5 py-2.5 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors"
          >
            + Přidat klienta
          </button>
        </div>

        {/* Onboarding wizard */}
        {showAdd && (
          <OnboardingWizard
            onCancel={() => setShowAdd(false)}
            onComplete={async () => {
              setShowAdd(false)
              await refreshClients()
            }}
          />
        )}

        {/* Clients table */}
        <div className="bg-white rounded-[20px] border border-black/[0.06] overflow-x-auto">
          {loading ? (
            <div className="p-8 animate-pulse"><div className="h-4 bg-sand-pale rounded w-1/3 mb-3" /><div className="h-4 bg-sand-pale rounded w-1/2" /></div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-black/[0.06]">
                  <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Klient</th>
                  <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">E-mail</th>
                  <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Služba</th>
                  <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Status</th>
                  <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => c.role === 'client').map((c) => (
                  <tr key={c.id}
                    onClick={() => router.push(`/cfo?client=${c.id}`)}
                    className="border-b border-black/[0.06] last:border-0 hover:bg-sand transition-colors cursor-pointer">
                    <td className="py-3 px-5 text-[0.82rem] text-ink font-medium">{c.name}</td>
                    <td className="py-3 px-5 text-[0.82rem] text-mid">{c.email}</td>
                    <td className="py-3 px-5" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {SERVICES.map(s => {
                          const active = getServices(c.service).includes(s)
                          return (
                            <button key={s} onClick={() => toggleService(c.id, c.service, s)}
                              className={`px-2 py-0.5 rounded-full text-[0.58rem] font-medium transition-colors ${
                                active ? 'bg-rose text-white' : 'bg-black/[0.04] text-mid hover:bg-rose/10 hover:text-rose'
                              }`}>
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => toggleActive(c.id, c.active)}
                        className={`px-2.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer transition-colors ${
                          c.active ? 'bg-[#eef6f1] text-green hover:bg-green/20' : 'bg-rose-blush text-rose-deep hover:bg-rose/20'
                        }`}
                      >
                        {c.active ? 'Aktivní' : 'Neaktivní'}
                      </button>
                    </td>
                    <td className="py-3 px-5 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => deleteClient(c.id, c.name)}
                        title="Smazat klienta (účet, profil, reporty)"
                        className="text-[0.6rem] tracking-[0.12em] uppercase text-mid hover:text-rose-deep px-2 py-1 rounded transition-colors"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
