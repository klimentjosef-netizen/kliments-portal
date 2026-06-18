'use client'

import { useState } from 'react'

/**
 * OnboardingWizard
 *
 * 4-krokovy wizard pro pridani noveho klienta. Misto puveho 'Pridat klienta'
 * formulare projde adminem strukturovany dotaznik a po dokonceni vytvori:
 *  - auth user (Supabase Auth)
 *  - profile row (name, service, role=client, active=true)
 *  - report CFO se zakladnimi daty (tiers, fixed_costs, business_profile)
 *
 * Wizard ma vlastni state. Po Save zavolat onComplete(clientId, summary)
 * · admin page si pak refresne klienty.
 */

type Step = 1 | 2 | 3 | 4

interface OnboardingData {
  // Krok 1: zakladni info
  name: string
  email: string
  password: string
  phone: string
  // Krok 2: business profile
  ico: string
  entity_type: 'sro' | 'osvc' | 'a_s' | 'jiny'
  vat_payer: boolean
  industry: string
  employees: string  // '1-5' | '6-15' | '16-50' | '50+'
  annual_revenue: string  // do 5 mil / 5-30 mil / 30-100 mil / 100-500 mil / 500+
  // Krok 3: sluzby + cile
  services: string[]
  goals: string[]
  // Krok 4: tiers + fixed costs
  tiers: { name: string; price: number; quantity: number }[]
  fixed_costs: { name: string; amount: number }[]
}

const SERVICES = [
  'CFO na volné noze',
  'Valuace',
  'Firemní audit',
  'Startup kit',
  'Příprava na investora',
  'Mentoring',
] as const

const GOALS = [
  { id: 'cashflow',  label: 'Lepší přehled o cashflow',           desc: 'Vědět, kolik mám peněz a kam tečou' },
  { id: 'margins',   label: 'Zvýšit marže',                       desc: 'Identifikovat ztrátové produkty / klienty' },
  { id: 'growth',    label: 'Strategicky růst',                   desc: 'Rozhodovat se podle dat, ne podle pocitu' },
  { id: 'exit',      label: 'Připravit firmu na prodej',          desc: 'V horizontu 1-5 let' },
  { id: 'investor',  label: 'Přibrat investora',                  desc: 'Připravit finanční podklady' },
  { id: 'cleanup',   label: 'Vyčistit účetnictví a procesy',      desc: 'Mít data v pořádku pro rozhodování' },
]

const INDUSTRIES = [
  'Výroba a strojírenství',
  'Stavebnictví',
  'Auto-servis / autopůjčovna',
  'E-shop a obchod',
  'Gastronomie a hotelnictví',
  'IT a software',
  'Marketing a kreativa',
  'Zdravotnictví a wellness',
  'Vzdělávání',
  'Zemědělství',
  'Doprava a logistika',
  'Služby B2B',
  'Jiné',
]

const initialData: OnboardingData = {
  name: '',
  email: '',
  password: '',
  phone: '',
  ico: '',
  entity_type: 'sro',
  vat_payer: true,
  industry: '',
  employees: '1-5',
  annual_revenue: 'do_5',
  services: ['CFO na volné noze'],
  goals: [],
  tiers: [{ name: '', price: 0, quantity: 0 }],
  fixed_costs: [{ name: '', amount: 0 }],
}

export default function OnboardingWizard({
  onCancel,
  onComplete,
}: {
  onCancel: () => void
  onComplete: () => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<OnboardingData>(initialData)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function toggleService(s: string) {
    update('services', data.services.includes(s)
      ? data.services.filter(x => x !== s)
      : [...data.services, s])
  }

  function toggleGoal(id: string) {
    update('goals', data.goals.includes(id)
      ? data.goals.filter(x => x !== id)
      : [...data.goals, id])
  }

  function setTier(i: number, field: keyof OnboardingData['tiers'][0], v: string | number) {
    const next = [...data.tiers]
    next[i] = { ...next[i], [field]: v }
    update('tiers', next)
  }
  function addTier() { update('tiers', [...data.tiers, { name: '', price: 0, quantity: 0 }]) }
  function removeTier(i: number) { update('tiers', data.tiers.filter((_, j) => j !== i)) }

  function setCost(i: number, field: keyof OnboardingData['fixed_costs'][0], v: string | number) {
    const next = [...data.fixed_costs]
    next[i] = { ...next[i], [field]: v }
    update('fixed_costs', next)
  }
  function addCost() { update('fixed_costs', [...data.fixed_costs, { name: '', amount: 0 }]) }
  function removeCost(i: number) { update('fixed_costs', data.fixed_costs.filter((_, j) => j !== i)) }

  // Validace per step
  function isStepValid(s: Step): boolean {
    if (s === 1) return !!data.name && !!data.email && data.password.length >= 6
    if (s === 2) return !!data.industry
    if (s === 3) return data.services.length > 0
    return true
  }

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      // 1. Vytvorit auth user + profile pres existujici endpoint
      const createRes = await fetch('/portal/api/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          name: data.name,
          password: data.password,
          service: data.services.join(', '),
        }),
      })
      const createJson = await createRes.json()
      if (!createRes.ok || !createJson.userId) {
        throw new Error(createJson.error || 'Vytvoření klienta selhalo.')
      }

      // 2. Vytvorit CFO report pokud je mezi sluzbami
      if (data.services.includes('CFO na volné noze')) {
        await fetch('/portal/api/onboarding-create-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: createJson.userId,
            onboarding: data,
          }),
        })
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neznámá chyba')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] w-full max-w-[720px] max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header s progress barem */}
        <div className="sticky top-0 bg-white border-b border-black/[0.06] px-6 py-5 z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[0.62rem] tracking-[0.16em] uppercase text-rose font-medium mb-1">Onboarding klienta · krok {step} ze 4</p>
              <h2 className="font-serif text-xl text-ink">
                {step === 1 && 'Základní informace'}
                {step === 2 && 'Profil firmy'}
                {step === 3 && 'Služby a cíle'}
                {step === 4 && 'První čísla'}
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="text-mid hover:text-ink p-2 -mr-2"
              aria-label="Zavřít"
            >
              ✕
            </button>
          </div>
          {/* Progress dots */}
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(n => (
              <div
                key={n}
                className={`h-1.5 rounded-full transition-all ${
                  n <= step ? 'bg-rose flex-[2]' : 'bg-black/[0.08] flex-1'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6 space-y-5">

          {step === 1 && (
            <>
              <Field label="Název firmy *" hint="Tak jak ho zobrazujeme v portálu">
                <input value={data.name} onChange={e => update('name', e.target.value)} className={inputCls} placeholder="TechCars Servis s.r.o." />
              </Field>
              <Field label="E-mail klienta *" hint="Bude se s ním přihlašovat">
                <input type="email" value={data.email} onChange={e => update('email', e.target.value)} className={inputCls} placeholder="info@firma.cz" />
              </Field>
              <Field label="Telefon" hint="Volitelně, pro urgentní záležitosti">
                <input type="tel" value={data.phone} onChange={e => update('phone', e.target.value)} className={inputCls} placeholder="+420 ..." />
              </Field>
              <Field label="Heslo pro první přihlášení *" hint="Min. 6 znaků. Klient si pak změní v portálu.">
                <input type="text" value={data.password} onChange={e => update('password', e.target.value)} className={inputCls} placeholder="" />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="IČO" hint="Volitelně, pro smlouvu a fakturaci">
                <input value={data.ico} onChange={e => update('ico', e.target.value)} className={inputCls} placeholder="12345678" />
              </Field>
              <Field label="Právní forma">
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 'sro', l: 's.r.o.' },
                    { v: 'osvc', l: 'OSVČ' },
                    { v: 'a_s', l: 'a.s.' },
                    { v: 'jiny', l: 'jiný' },
                  ].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => update('entity_type', v as OnboardingData['entity_type'])}
                      className={chipCls(data.entity_type === v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Plátce DPH?">
                <div className="flex gap-2">
                  <button onClick={() => update('vat_payer', true)} className={chipCls(data.vat_payer)}>Ano</button>
                  <button onClick={() => update('vat_payer', false)} className={chipCls(!data.vat_payer)}>Ne</button>
                </div>
              </Field>
              <Field label="Obor *" hint="Vybereme dashboard šablonu na míru">
                <select value={data.industry} onChange={e => update('industry', e.target.value)} className={inputCls}>
                  <option value="">Vyberte obor...</option>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Velikost firmy">
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: '1-5', l: '1 až 5 zaměstnanců' },
                    { v: '6-15', l: '6 až 15' },
                    { v: '16-50', l: '16 až 50' },
                    { v: '50+', l: '50+' },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => update('employees', v)} className={chipCls(data.employees === v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Roční obrat (orientačně)">
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 'do_5',     l: 'do 5 mil. Kč' },
                    { v: '5_30',    l: '5 až 30 mil.' },
                    { v: '30_100',  l: '30 až 100 mil.' },
                    { v: '100_500', l: '100 až 500 mil.' },
                    { v: '500_plus', l: '500+ mil.' },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => update('annual_revenue', v)} className={chipCls(data.annual_revenue === v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Které služby klient bere? *" hint="Vyberte jednu nebo víc">
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(s => (
                    <button key={s} onClick={() => toggleService(s)} className={chipCls(data.services.includes(s))}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Hlavní cíle klienta" hint="Pomůže nám naladit dashboard a priority. Volitelně, vyberte víc.">
                <div className="space-y-2 mt-2">
                  {GOALS.map(g => (
                    <button
                      key={g.id}
                      onClick={() => toggleGoal(g.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        data.goals.includes(g.id)
                          ? 'border-rose bg-rose-blush/20'
                          : 'border-black/[0.06] hover:border-rose-pale bg-white'
                      }`}
                    >
                      <p className="text-[0.85rem] font-medium text-ink">{g.label}</p>
                      <p className="text-[0.72rem] text-mid mt-0.5">{g.desc}</p>
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-[0.85rem] text-mid leading-relaxed">
                První čísla, ať dashboard nestartuje na nule. Nemusí být přesná, naladíme po prvním měsíci. Můžete přeskočit a doplnit později.
              </p>

              <Field label="Hlavní zdroje tržeb" hint="Cca 2 až 5 hlavních produktů nebo služeb">
                {data.tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr,110px,110px,32px] gap-2 mb-2">
                    <input value={t.name} onChange={e => setTier(i, 'name', e.target.value)}
                      placeholder="např. Mechanické opravy" className={inputCls} />
                    <input type="number" value={t.price || ''} onChange={e => setTier(i, 'price', +e.target.value || 0)}
                      placeholder="Cena Kč" className={inputCls} />
                    <input type="number" value={t.quantity || ''} onChange={e => setTier(i, 'quantity', +e.target.value || 0)}
                      placeholder="ks/měs" className={inputCls} />
                    <button onClick={() => removeTier(i)} className="text-rose-deep text-sm hover:bg-rose-blush rounded-lg">×</button>
                  </div>
                ))}
                <button onClick={addTier} className="text-[0.78rem] text-rose hover:text-rose-deep">+ Přidat tier</button>
              </Field>

              <Field label="Měsíční fixní náklady" hint="Nájem, mzdy, leasingy, pojištění...">
                {data.fixed_costs.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr,130px,32px] gap-2 mb-2">
                    <input value={c.name} onChange={e => setCost(i, 'name', e.target.value)}
                      placeholder="např. Nájem" className={inputCls} />
                    <input type="number" value={c.amount || ''} onChange={e => setCost(i, 'amount', +e.target.value || 0)}
                      placeholder="Kč/měs" className={inputCls} />
                    <button onClick={() => removeCost(i)} className="text-rose-deep text-sm hover:bg-rose-blush rounded-lg">×</button>
                  </div>
                ))}
                <button onClick={addCost} className="text-[0.78rem] text-rose hover:text-rose-deep">+ Přidat náklad</button>
              </Field>

              {error && (
                <div className="bg-rose-blush border border-rose-pale rounded-xl px-4 py-3 text-[0.85rem] text-rose-deep">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="sticky bottom-0 bg-white border-t border-black/[0.06] px-6 py-4 flex justify-between items-center gap-3">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as Step) : onCancel()}
            className="text-[0.78rem] text-mid hover:text-ink px-4 py-2"
          >
            {step === 1 ? 'Zrušit' : '← Zpět'}
          </button>
          {step < 4 ? (
            <button
              onClick={() => isStepValid(step) && setStep((step + 1) as Step)}
              disabled={!isStepValid(step)}
              className="bg-rose hover:bg-rose-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white px-6 py-2.5 rounded-full text-[0.78rem] tracking-[0.04em] font-medium"
            >
              Pokračovat →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="bg-rose hover:bg-rose-deep disabled:opacity-40 transition-colors text-white px-6 py-2.5 rounded-full text-[0.78rem] tracking-[0.04em] font-medium"
            >
              {submitting ? 'Vytvářím...' : 'Vytvořit klienta ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── helpers ──

const inputCls = 'w-full bg-sand-pale/40 border border-black/[0.06] rounded-xl px-3 py-2.5 text-[0.88rem] text-ink outline-none focus:border-rose-pale focus:bg-white transition-colors'

const chipCls = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-[0.78rem] font-medium transition-colors border ${
    active
      ? 'bg-rose text-white border-rose'
      : 'bg-white text-mid border-black/[0.08] hover:border-rose-pale'
  }`

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[0.7rem] tracking-[0.14em] uppercase text-mid font-medium mb-1">{label}</label>
      {hint && <p className="text-[0.72rem] text-mid mb-2 opacity-80">{hint}</p>}
      {children}
    </div>
  )
}
