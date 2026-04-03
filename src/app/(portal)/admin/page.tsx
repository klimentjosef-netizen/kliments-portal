'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import type { Profile } from '@/lib/types'

const SERVICES = ['CFO na volné noze', 'Rozjeď to správně', 'Prodej za maximum', 'Firemní audit', 'Startup kit', 'Příprava na investora', 'Mentoring']

export default function AdminPage() {
  const [clients, setClients] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newService, setNewService] = useState(SERVICES[0])
  const [newPassword, setNewPassword] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
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

  async function addClient() {
    if (!newEmail || !newName) return
    setAdding(true)
    setAddError('')

    const res = await fetch('/portal/api/create-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPassword, service: newService }),
    })
    const result = await res.json()

    if (result.error) {
      setAddError(result.error)
    } else {
      await refreshClients()
      setShowAdd(false)
      setNewEmail('')
      setNewName('')
      setNewPassword('')
    }
    setAdding(false)
  }

  async function toggleActive(clientId: string, current: boolean) {
    await supabase.from('profiles').update({ active: !current }).eq('id', clientId)
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, active: !current } : c))
  }

  async function updateService(clientId: string, service: string) {
    await supabase.from('profiles').update({ service }).eq('id', clientId)
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, service } : c))
  }

  if (!isAdmin) return <><Topbar title="Admin" /><div className="p-4 lg:p-9 text-center text-mid">Přístup odepřen</div></>

  return (
    <>
      <Topbar title="Klienti" />
      <div className="p-4 lg:p-9">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-serif text-xl text-ink">Správa klientů</h2>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="bg-rose text-white px-5 py-2.5 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors"
          >
            + Přidat klienta
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06] mb-6">
            <h3 className="font-serif text-base text-ink mb-4">Nový klient</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Jméno</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2.5 text-sm outline-none focus:border-rose transition-colors"
                  placeholder="Jan Novák" />
              </div>
              <div>
                <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">E-mail</label>
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2.5 text-sm outline-none focus:border-rose transition-colors"
                  placeholder="jan@firma.cz" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Služba</label>
                <select value={newService} onChange={(e) => setNewService(e.target.value)}
                  className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2.5 text-sm outline-none focus:border-rose transition-colors">
                  {SERVICES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Heslo</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2.5 text-sm outline-none focus:border-rose transition-colors"
                  placeholder="Min. 6 znaků" />
              </div>
            </div>
            {addError && <p className="text-rose-deep text-sm mb-3">{addError}</p>}
            <button onClick={addClient} disabled={adding || !newEmail || !newName || !newPassword}
              className="bg-rose text-white px-6 py-2 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50">
              {adding ? 'Přidávám...' : 'Přidat'}
            </button>
          </div>
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
                </tr>
              </thead>
              <tbody>
                {clients.filter(c => c.role === 'client').map((c) => (
                  <tr key={c.id}
                    onClick={() => router.push(`/cfo?client=${c.id}`)}
                    className="border-b border-black/[0.06] last:border-0 hover:bg-sand transition-colors cursor-pointer">
                    <td className="py-3 px-5 text-[0.82rem] text-ink font-medium">{c.name}</td>
                    <td className="py-3 px-5 text-[0.82rem] text-mid">{c.email}</td>
                    <td className="py-3 px-5">
                      <select
                        value={c.service || ''}
                        onChange={(e) => updateService(c.id, e.target.value)}
                        className="bg-transparent text-[0.78rem] text-mid outline-none border-b border-transparent hover:border-rose focus:border-rose cursor-pointer"
                      >
                        {SERVICES.map(s => <option key={s}>{s}</option>)}
                      </select>
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
