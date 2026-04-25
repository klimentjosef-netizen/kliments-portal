'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import type { Profile, Report } from '@/lib/types'

const REPORT_TYPES = [
  { value: 'diagnoza', label: 'Finanční diagnóza' },
  { value: 'cfo', label: 'CFO na volné noze' },
  { value: 'valuace', label: 'Prodej za maximum' },
  { value: 'investor', label: 'Příprava na investora' },
  { value: 'mentoring', label: 'Mentoring' },
]

export default function AdminReportsPage() {
  const [clients, setClients] = useState<Profile[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') return
      setIsAdmin(true)

      const { data: c } = await supabase.from('profiles').select('*').eq('role', 'client').order('name')
      if (c) setClients(c as Profile[])

      const { data: r } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
      if (r) setReports(r as Report[])
    }
    load()
  }, [])

  async function saveReport(data: Record<string, unknown>) {
    setSaving(true)
    if (editingReport) {
      await supabase.from('reports').update({ data, title: (data.title as string) || editingReport.title }).eq('id', editingReport.id)
    } else {
      await supabase.from('reports').insert({
        client_id: selectedClient,
        type: selectedType,
        title: (data.title as string) || `${selectedType} report`,
        data,
      })
    }
    const { data: r } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
    if (r) setReports(r as Report[])
    setSaving(false)
    setShowEditor(false)
    setEditingReport(null)
  }

  async function deleteReport(id: string) {
    if (!confirm('Smazat tento report?')) return
    await supabase.from('reports').delete().eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  if (!isAdmin) return <><Topbar title="Admin" /><div className="p-9 text-center text-mid">Přístup odepřen</div></>

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || id

  return (
    <>
      <Topbar title="Správa reportů" />
      <div className="p-4 lg:p-9">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-serif text-xl text-ink">Reporty klientů</h2>
          <button onClick={() => { setShowEditor(true); setEditingReport(null); setSelectedClient(''); setSelectedType(''); }}
            className="bg-rose text-white px-5 py-2.5 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors">
            + Nový report
          </button>
        </div>

        {showEditor && (
          <div className="bg-white rounded-[20px] p-6 border border-black/[0.06] mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-base text-ink">{editingReport ? 'Upravit report' : 'Nový report'}</h3>
              <button onClick={() => { setShowEditor(false); setEditingReport(null); }} className="text-mid text-sm">✕</button>
            </div>

            {!editingReport && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Klient</label>
                  <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                    className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2.5 text-sm outline-none focus:border-rose">
                    <option value="">Vyberte klienta...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Typ reportu</label>
                  <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                    className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2.5 text-sm outline-none focus:border-rose">
                    <option value="">Vyberte typ...</option>
                    {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {(selectedType || editingReport) && (
              <ReportForm
                type={editingReport?.type || selectedType}
                initialData={editingReport?.data || {}}
                onSave={saveReport}
                saving={saving}
                disabled={!editingReport && (!selectedClient || !selectedType)}
              />
            )}
          </div>
        )}

        {/* Reports list */}
        <div className="bg-white rounded-[20px] border border-black/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06]">
                <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Klient</th>
                <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Typ</th>
                <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Název</th>
                <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Datum</th>
                <th className="text-[0.62rem] tracking-[0.12em] uppercase text-mid py-3 px-5 text-left font-medium">Akce</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-b border-black/[0.06] last:border-0 hover:bg-sand transition-colors">
                  <td className="py-3 px-5 text-[0.82rem] text-ink">{clientName(r.client_id)}</td>
                  <td className="py-3 px-5"><span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-medium bg-rose-blush text-rose-deep">{r.type}</span></td>
                  <td className="py-3 px-5 text-[0.82rem] text-mid">{r.title}</td>
                  <td className="py-3 px-5 text-[0.75rem] text-mid">{r.created_at ? new Date(r.created_at).toLocaleDateString('cs-CZ') : ''}</td>
                  <td className="py-3 px-5 flex gap-2">
                    <button onClick={() => { setEditingReport(r); setShowEditor(true); }}
                      className="text-[0.72rem] text-rose hover:text-rose-deep">Upravit</button>
                    <button onClick={() => deleteReport(r.id)}
                      className="text-[0.72rem] text-mid hover:text-rose-deep">Smazat</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-mid text-sm">Žádné reporty</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Report Form Component ──
function ReportForm({ type, initialData, onSave, saving, disabled }: {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (data: Record<string, any>) => void
  saving: boolean
  disabled: boolean
}) {
  const [json, setJson] = useState(JSON.stringify(initialData, null, 2))
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [formData, setFormData] = useState(initialData)

  const updateField = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (mode === 'json') {
      try { onSave(JSON.parse(json)) } catch { alert('Neplatný JSON') }
    } else {
      onSave(formData)
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('form')}
          className={`px-4 py-1.5 rounded-full text-[0.72rem] ${mode === 'form' ? 'bg-rose text-white' : 'border border-black/10 text-mid'}`}>
          Formulář
        </button>
        <button onClick={() => { setMode('json'); setJson(JSON.stringify(formData, null, 2)); }}
          className={`px-4 py-1.5 rounded-full text-[0.72rem] ${mode === 'json' ? 'bg-rose text-white' : 'border border-black/10 text-mid'}`}>
          JSON editor
        </button>
      </div>

      {mode === 'json' ? (
        <textarea value={json} onChange={e => setJson(e.target.value)}
          className="w-full h-80 font-mono text-xs p-4 border border-black/10 rounded-xl bg-sand outline-none focus:border-rose"
          spellCheck={false} />
      ) : (
        <div className="space-y-4">
          {type === 'diagnoza' && <DiagnozaForm data={formData} onChange={updateField} />}
          {type === 'cfo' && <CfoForm data={formData} onChange={updateField} />}
          {type === 'valuace' && <ValuaceForm data={formData} onChange={updateField} />}
          {type === 'investor' && <InvestorForm data={formData} onChange={updateField} />}
          {type === 'mentoring' && <MentoringForm data={formData} onChange={updateField} />}
        </div>
      )}

      <button onClick={handleSave} disabled={saving || disabled}
        className="mt-4 bg-rose text-white px-6 py-2.5 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50">
        {saving ? 'Ukládám...' : 'Uložit report'}
      </button>
    </div>
  )
}

// ── Shared field component ──
function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  const cls = "w-full border-b-[1.5px] border-black/10 bg-transparent py-2 text-sm outline-none focus:border-rose"
  return (
    <div>
      <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1">{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} className={cls + " resize-none h-20"} />
        : <input value={value} onChange={e => onChange(e.target.value)} className={cls} />}
    </div>
  )
}

// ── DIAGNÓZA FORM ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DiagnozaForm({ data, onChange }: { data: Record<string, any>; onChange: (k: string, v: unknown) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Název" value={data.title || ''} onChange={v => onChange('title', v)} />
        <Field label="Podtitul" value={data.subtitle || ''} onChange={v => onChange('subtitle', v)} />
      </div>
      <p className="text-[0.68rem] text-rose mt-4 mb-2 font-medium uppercase tracking-wider">Metriky (JSON pole)</p>
      <textarea value={JSON.stringify(data.metrics || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('metrics', JSON.parse(e.target.value)) } catch {} }} />
      <p className="text-[0.55rem] text-mid mt-1 mb-3">Formát: [{"{"}&quot;label&quot;:&quot;Obrat&quot;, &quot;value&quot;:&quot;1,2M&quot;, &quot;sub&quot;:&quot;Kč&quot;{"}"}]</p>
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">Silné stránky (jedna na řádek)</p>
      <textarea value={(data.strengths || []).join('\n')} className="w-full text-sm p-3 border border-black/10 rounded-lg bg-sand h-20 outline-none focus:border-rose"
        onChange={e => onChange('strengths', e.target.value.split('\n').filter(Boolean))} />
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">Slabé stránky (jedna na řádek)</p>
      <textarea value={(data.weaknesses || []).join('\n')} className="w-full text-sm p-3 border border-black/10 rounded-lg bg-sand h-20 outline-none focus:border-rose"
        onChange={e => onChange('weaknesses', e.target.value.split('\n').filter(Boolean))} />
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">Akční kroky (JSON)</p>
      <textarea value={JSON.stringify(data.steps || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('steps', JSON.parse(e.target.value)) } catch {} }} />
    </>
  )
}

// ── CFO FORM (interactive plan model) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CfoForm({ data, onChange }: { data: Record<string, any>; onChange: (k: string, v: unknown) => void }) {
  const tiers = (data.tiers || []) as Array<{ name: string; price: number; capacity: number; members: number; badge?: string; features: string[] }>
  const extras = (data.extras || []) as Array<{ name: string; quantity: number; unit_price: number; unit: string }>
  const fixedCosts = (data.fixed_costs || []) as Array<{ name: string; amount: number }>
  const budget = (data.budget || null) as { total: number; capex_budget: number; reserve_budget: number; capex_items: Array<{ name: string; planned: number; spent: number }>; reserve_drawn: number } | null
  const risks = (data.risks || []) as Array<{ level: string; title: string; desc: string }>
  const steps = (data.steps || []) as Array<{ num: string; deadline: string; title: string; desc: string; done?: boolean }>
  const questions = (data.questions || []) as Array<{ question: string; status: string; answer?: string }>

  const sectionCls = "border border-black/[0.06] rounded-xl p-4 mt-4"
  const sectionTitle = "text-[0.68rem] text-rose font-medium uppercase tracking-wider mb-3"
  const smallBtn = "text-[0.65rem] px-3 py-1 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors"
  const removeBtn = "text-[0.6rem] text-mid hover:text-rose-deep cursor-pointer ml-2"

  return (
    <>
      {/* Meta */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Název" value={data.title || ''} onChange={v => onChange('title', v)} />
        <Field label="Podtitul" value={data.subtitle || ''} onChange={v => onChange('subtitle', v)} />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-4">
        <Field label="Variabilní náklady (%)" value={String(data.variable_cost_pct ?? 5)} onChange={v => onChange('variable_cost_pct', Number(v) || 0)} />
        <Field label="Zahájení podnikání" value={String(data.business_start_month ?? '')} onChange={v => onChange('business_start_month', v)} />
        <Field label="Ramp-up měsíců" value={String(data.ramp_months ?? 17)} onChange={v => onChange('ramp_months', Number(v) || 17)} />
        <Field label="Projekce měsíců" value={String(data.projection_months ?? 24)} onChange={v => onChange('projection_months', Number(v) || 24)} />
      </div>

      {/* Tiers */}
      <div className={sectionCls}>
        <div className="flex justify-between items-center mb-3">
          <p className={sectionTitle}>Tarify</p>
          <button className={smallBtn} onClick={() => onChange('tiers', [...tiers, { name: 'Nový tarif', price: 0, capacity: 10, members: 0, features: ['Základní přístup'] }])}>+ Tarif</button>
        </div>
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_80px_30px] gap-2 mb-2 items-end">
            <input placeholder="Název" value={t.name} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...tiers]; arr[i] = { ...arr[i], name: e.target.value }; onChange('tiers', arr) }} />
            <input placeholder="Cena" type="number" value={t.price || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={e => { const arr = [...tiers]; arr[i] = { ...arr[i], price: +e.target.value || 0 }; onChange('tiers', arr) }} />
            <input placeholder="Kapacita" type="number" value={t.capacity || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={e => { const arr = [...tiers]; arr[i] = { ...arr[i], capacity: +e.target.value || 0 }; onChange('tiers', arr) }} />
            <input placeholder="Členů" type="number" value={t.members || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={e => { const arr = [...tiers]; arr[i] = { ...arr[i], members: +e.target.value || 0 }; onChange('tiers', arr) }} />
            <input placeholder="Badge" value={t.badge || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...tiers]; arr[i] = { ...arr[i], badge: e.target.value }; onChange('tiers', arr) }} />
            <button className={removeBtn} onClick={() => onChange('tiers', tiers.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Extra revenue */}
      <div className={sectionCls}>
        <div className="flex justify-between items-center mb-3">
          <p className={sectionTitle}>Doplňkové příjmy</p>
          <button className={smallBtn} onClick={() => onChange('extras', [...extras, { name: '', quantity: 0, unit_price: 0, unit: 'ks' }])}>+ Příjem</button>
        </div>
        {extras.map((e, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_80px_60px_30px] gap-2 mb-2 items-end">
            <input placeholder="Název" value={e.name} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={ev => { const arr = [...extras]; arr[i] = { ...arr[i], name: ev.target.value }; onChange('extras', arr) }} />
            <input placeholder="Počet" type="number" value={e.quantity || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={ev => { const arr = [...extras]; arr[i] = { ...arr[i], quantity: +ev.target.value || 0 }; onChange('extras', arr) }} />
            <input placeholder="Kč/ks" type="number" value={e.unit_price || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={ev => { const arr = [...extras]; arr[i] = { ...arr[i], unit_price: +ev.target.value || 0 }; onChange('extras', arr) }} />
            <input placeholder="jed." value={e.unit} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={ev => { const arr = [...extras]; arr[i] = { ...arr[i], unit: ev.target.value }; onChange('extras', arr) }} />
            <button className={removeBtn} onClick={() => onChange('extras', extras.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Fixed costs */}
      <div className={sectionCls}>
        <div className="flex justify-between items-center mb-3">
          <p className={sectionTitle}>Fixní náklady</p>
          <button className={smallBtn} onClick={() => onChange('fixed_costs', [...fixedCosts, { name: '', amount: 0 }])}>+ Náklad</button>
        </div>
        {fixedCosts.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_30px] gap-2 mb-1.5 items-end">
            <input placeholder="Název" value={c.name} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...fixedCosts]; arr[i] = { ...arr[i], name: e.target.value }; onChange('fixed_costs', arr) }} />
            <input placeholder="Kč/měs" type="number" value={c.amount || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={e => { const arr = [...fixedCosts]; arr[i] = { ...arr[i], amount: +e.target.value || 0 }; onChange('fixed_costs', arr) }} />
            <button className={removeBtn} onClick={() => onChange('fixed_costs', fixedCosts.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Budget */}
      <div className={sectionCls}>
        <p className={sectionTitle}>Rozpočet</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-[0.55rem] text-mid block mb-0.5">Celkový rozpočet</label>
            <input type="number" value={budget?.total || ''} className="w-full border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => onChange('budget', { ...(budget || { capex_budget: 0, reserve_budget: 0, capex_items: [], reserve_drawn: 0 }), total: +e.target.value || 0 })} />
          </div>
          <div>
            <label className="text-[0.55rem] text-mid block mb-0.5">CAPEX rozpočet</label>
            <input type="number" value={budget?.capex_budget || ''} className="w-full border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => onChange('budget', { ...(budget || { total: 0, reserve_budget: 0, capex_items: [], reserve_drawn: 0 }), capex_budget: +e.target.value || 0 })} />
          </div>
          <div>
            <label className="text-[0.55rem] text-mid block mb-0.5">Provozní rezerva</label>
            <input type="number" value={budget?.reserve_budget || ''} className="w-full border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => onChange('budget', { ...(budget || { total: 0, capex_budget: 0, capex_items: [], reserve_drawn: 0 }), reserve_budget: +e.target.value || 0 })} />
          </div>
        </div>
        <p className="text-[0.6rem] text-mid mb-2">CAPEX položky (plán + čerpáno)</p>
        {(budget?.capex_items || []).map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_100px_100px_30px] gap-2 mb-1.5 items-end">
            <input placeholder="Název" value={item.name} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const items = [...(budget?.capex_items || [])]; items[i] = { ...items[i], name: e.target.value }; onChange('budget', { ...budget, capex_items: items }) }} />
            <input placeholder="Plán" type="number" value={item.planned || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={e => { const items = [...(budget?.capex_items || [])]; items[i] = { ...items[i], planned: +e.target.value || 0 }; onChange('budget', { ...budget, capex_items: items }) }} />
            <input placeholder="Čerpáno" type="number" value={item.spent || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose text-right"
              onChange={e => { const items = [...(budget?.capex_items || [])]; items[i] = { ...items[i], spent: +e.target.value || 0 }; onChange('budget', { ...budget, capex_items: items }) }} />
            <button className={removeBtn} onClick={() => onChange('budget', { ...budget, capex_items: (budget?.capex_items || []).filter((_: unknown, j: number) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className={smallBtn} onClick={() => onChange('budget', { ...(budget || { total: 0, capex_budget: 0, reserve_budget: 0, reserve_drawn: 0 }), capex_items: [...(budget?.capex_items || []), { name: '', planned: 0, spent: 0 }] })}>+ CAPEX položka</button>
      </div>

      {/* Risks */}
      <div className={sectionCls}>
        <div className="flex justify-between items-center mb-3">
          <p className={sectionTitle}>Rizika</p>
          <button className={smallBtn} onClick={() => onChange('risks', [...risks, { level: 'medium', title: '', desc: '' }])}>+ Riziko</button>
        </div>
        {risks.map((r, i) => (
          <div key={i} className="grid grid-cols-[100px_1fr_1fr_30px] gap-2 mb-2 items-end">
            <select value={r.level} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...risks]; arr[i] = { ...arr[i], level: e.target.value }; onChange('risks', arr) }}>
              <option value="low">Nízké</option>
              <option value="medium">Střední</option>
              <option value="critical">Kritické</option>
            </select>
            <input placeholder="Název" value={r.title} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...risks]; arr[i] = { ...arr[i], title: e.target.value }; onChange('risks', arr) }} />
            <input placeholder="Popis" value={r.desc} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...risks]; arr[i] = { ...arr[i], desc: e.target.value }; onChange('risks', arr) }} />
            <button className={removeBtn} onClick={() => onChange('risks', risks.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className={sectionCls}>
        <div className="flex justify-between items-center mb-3">
          <p className={sectionTitle}>Akční plán</p>
          <button className={smallBtn} onClick={() => onChange('steps', [...steps, { num: String(steps.length + 1).padStart(2, '0'), deadline: '', title: '', desc: '', done: false }])}>+ Krok</button>
        </div>
        {steps.map((s, i) => (
          <div key={i} className="grid grid-cols-[50px_100px_1fr_1fr_50px_30px] gap-2 mb-2 items-end">
            <input placeholder="#" value={s.num} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], num: e.target.value }; onChange('steps', arr) }} />
            <input placeholder="Deadline" value={s.deadline} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], deadline: e.target.value }; onChange('steps', arr) }} />
            <input placeholder="Název" value={s.title} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], title: e.target.value }; onChange('steps', arr) }} />
            <input placeholder="Popis" value={s.desc} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], desc: e.target.value }; onChange('steps', arr) }} />
            <label className="flex items-center gap-1 text-[0.6rem] text-mid">
              <input type="checkbox" checked={s.done ?? false} onChange={e => { const arr = [...steps]; arr[i] = { ...arr[i], done: e.target.checked }; onChange('steps', arr) }} /> Done
            </label>
            <button className={removeBtn} onClick={() => onChange('steps', steps.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Questions */}
      <div className={sectionCls}>
        <div className="flex justify-between items-center mb-3">
          <p className={sectionTitle}>Otevřené dotazy</p>
          <button className={smallBtn} onClick={() => onChange('questions', [...questions, { question: '', status: 'open', answer: '' }])}>+ Dotaz</button>
        </div>
        {questions.map((q, i) => (
          <div key={i} className="grid grid-cols-[100px_1fr_1fr_30px] gap-2 mb-2 items-end">
            <select value={q.status} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...questions]; arr[i] = { ...arr[i], status: e.target.value }; onChange('questions', arr) }}>
              <option value="open">Otevřený</option>
              <option value="resolved">Vyřešený</option>
            </select>
            <input placeholder="Dotaz" value={q.question} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...questions]; arr[i] = { ...arr[i], question: e.target.value }; onChange('questions', arr) }} />
            <input placeholder="Odpověď" value={q.answer || ''} className="border-b border-black/10 bg-transparent py-1 text-xs outline-none focus:border-rose"
              onChange={e => { const arr = [...questions]; arr[i] = { ...arr[i], answer: e.target.value }; onChange('questions', arr) }} />
            <button className={removeBtn} onClick={() => onChange('questions', questions.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
    </>
  )
}

// ── VALUACE FORM ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ValuaceForm({ data, onChange }: { data: Record<string, any>; onChange: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Název" value={data.title || ''} onChange={v => onChange('title', v)} />
      <p className="text-[0.68rem] text-rose mt-4 mb-2 font-medium uppercase tracking-wider">Výsledek ocenění (JSON)</p>
      <textarea value={JSON.stringify(data.result || {}, null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('result', JSON.parse(e.target.value)) } catch {} }} />
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">Metody ocenění (JSON)</p>
      <textarea value={JSON.stringify(data.methods || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('methods', JSON.parse(e.target.value)) } catch {} }} />
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">Akční kroky (JSON)</p>
      <textarea value={JSON.stringify(data.steps || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('steps', JSON.parse(e.target.value)) } catch {} }} />
    </>
  )
}

// ── INVESTOR FORM ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InvestorForm({ data, onChange }: { data: Record<string, any>; onChange: (k: string, v: unknown) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Název" value={data.title || ''} onChange={v => onChange('title', v)} />
        <Field label="Podtitul" value={data.subtitle || ''} onChange={v => onChange('subtitle', v)} />
      </div>
      <p className="text-[0.68rem] text-rose mt-4 mb-2 font-medium uppercase tracking-wider">Checklist (JSON)</p>
      <textarea value={JSON.stringify(data.checklist || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('checklist', JSON.parse(e.target.value)) } catch {} }} />
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">Metriky (JSON)</p>
      <textarea value={JSON.stringify(data.metrics || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-28 outline-none focus:border-rose"
        onChange={e => { try { onChange('metrics', JSON.parse(e.target.value)) } catch {} }} />
      <Field label="MRR cíl" value={data.mrr_target || ''} onChange={v => onChange('mrr_target', v)} />
      <p className="text-[0.68rem] text-rose mt-2 mb-2 font-medium uppercase tracking-wider">MRR projekce (čísla oddělená čárkou, v %)</p>
      <input value={(data.mrr_projection || []).join(', ')} className="w-full border-b-[1.5px] border-black/10 bg-transparent py-2 text-sm outline-none focus:border-rose"
        onChange={e => onChange('mrr_projection', e.target.value.split(',').map(Number).filter(n => !isNaN(n)))} />
    </>
  )
}

// ── MENTORING FORM ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MentoringForm({ data, onChange }: { data: Record<string, any>; onChange: (k: string, v: unknown) => void }) {
  return (
    <>
      <Field label="Název" value={data.title || ''} onChange={v => onChange('title', v)} />
      <p className="text-[0.68rem] text-rose mt-4 mb-2 font-medium uppercase tracking-wider">Sessions (JSON)</p>
      <textarea value={JSON.stringify(data.sessions || [], null, 2)} className="w-full font-mono text-xs p-3 border border-black/10 rounded-lg bg-sand h-48 outline-none focus:border-rose"
        onChange={e => { try { onChange('sessions', JSON.parse(e.target.value)) } catch {} }} />
      <p className="text-[0.55rem] text-mid mt-1">Formát: [{"{"}&quot;num&quot;:&quot;01&quot;, &quot;topic&quot;:&quot;...&quot;, &quot;date&quot;:&quot;...&quot;, &quot;notes&quot;:&quot;...&quot;, &quot;tasks&quot;:[{"{"}&quot;text&quot;:&quot;...&quot;,&quot;done&quot;:true{"}"}]{"}"}]</p>
    </>
  )
}