'use client'

interface Risk {
  level: 'critical' | 'medium' | 'low'
  title: string
  desc: string
}

interface Step {
  num: string
  deadline: string
  title: string
  desc: string
  done?: boolean
}

interface RisksTabProps {
  data: Record<string, unknown>
  onRisksChange: (risks: Risk[]) => void
  onStepsChange: (steps: Step[]) => void
}

const LEVEL_OPTIONS: { value: Risk['level']; label: string }[] = [
  { value: 'critical', label: 'Kritické' },
  { value: 'medium', label: 'Střední' },
  { value: 'low', label: 'Nízké' },
]

export default function RisksTab({ data, onRisksChange, onStepsChange }: RisksTabProps) {
  const risks = (data.risks || []) as Risk[]
  const steps = (data.steps || []) as Step[]

  function updateRisk(i: number, patch: Partial<Risk>) {
    onRisksChange(risks.map((r, j) => j === i ? { ...r, ...patch } : r))
  }

  function addRisk() {
    onRisksChange([...risks, { level: 'medium', title: '', desc: '' }])
  }

  function removeRisk(i: number) {
    onRisksChange(risks.filter((_, j) => j !== i))
  }

  function updateStep(i: number, patch: Partial<Step>) {
    onStepsChange(steps.map((s, j) => j === i ? { ...s, ...patch } : s))
  }

  function addStep() {
    onStepsChange([...steps, { num: String(steps.length + 1), deadline: '', title: '', desc: '', done: false }])
  }

  function removeStep(i: number) {
    onStepsChange(steps.filter((_, j) => j !== i))
  }

  return (
    <div className="space-y-6">
      {/* Risks */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Aktuální rizika</h3>
          <button onClick={addRisk} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
            + Přidat riziko
          </button>
        </div>

        {risks.length === 0 && <p className="text-[0.8rem] text-mid">Žádná rizika. Přidejte první riziko tlačítkem výše.</p>}

        <div className="space-y-2.5">
          {risks.map((r, i) => (
            <div key={i} className={`p-4 rounded-lg ${
              r.level === 'critical' ? 'bg-[#fdf0f0]' : r.level === 'medium' ? 'bg-[#fff8f0]' : 'bg-[#eef6f1]'
            }`}>
              <div className="flex items-start gap-3">
                <select
                  value={r.level}
                  onChange={e => updateRisk(i, { level: e.target.value as Risk['level'] })}
                  className={`text-[0.58rem] tracking-[0.1em] font-semibold px-2 py-1 rounded flex-shrink-0 outline-none cursor-pointer ${
                    r.level === 'critical' ? 'bg-rose/20 text-rose-deep' : r.level === 'medium' ? 'bg-amber/20 text-amber' : 'bg-green/20 text-green'
                  }`}
                >
                  {LEVEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="flex-1 space-y-1.5">
                  <input
                    value={r.title}
                    onChange={e => updateRisk(i, { title: e.target.value })}
                    placeholder="Název rizika"
                    className="w-full bg-transparent text-[0.82rem] font-medium text-ink outline-none border-b border-transparent focus:border-rose"
                  />
                  <input
                    value={r.desc}
                    onChange={e => updateRisk(i, { desc: e.target.value })}
                    placeholder="Popis a dopad"
                    className="w-full bg-transparent text-[0.75rem] text-mid outline-none border-b border-transparent focus:border-rose"
                  />
                </div>
                <button onClick={() => removeRisk(i)} className="text-mid hover:text-rose-deep text-sm flex-shrink-0">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action plan */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-base text-ink">Akční plán</h3>
          <button onClick={addStep} className="text-[0.72rem] px-4 py-1.5 rounded-full border border-black/10 text-mid hover:border-rose hover:text-rose transition-colors">
            + Přidat krok
          </button>
        </div>

        {steps.length === 0 && <p className="text-[0.8rem] text-mid">Žádné kroky. Přidejte první akční krok.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {steps.map((s, i) => (
            <div key={i} className={`rounded-[14px] p-5 border border-black/[0.06] ${s.done ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="font-serif text-3xl font-light text-rose-pale">{s.num}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStep(i, { done: !s.done })}
                    className={`text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      s.done ? 'bg-green/10 text-green' : 'bg-black/5 text-mid hover:bg-green/10 hover:text-green'
                    }`}
                  >
                    {s.done ? 'Hotovo' : 'Označit'}
                  </button>
                  <button onClick={() => removeStep(i)} className="text-mid hover:text-rose-deep text-sm">✕</button>
                </div>
              </div>
              <input
                value={s.deadline}
                onChange={e => updateStep(i, { deadline: e.target.value })}
                placeholder="Termín (např. Do 15. dubna)"
                className="w-full bg-transparent text-[0.62rem] tracking-[0.12em] uppercase text-rose font-medium mb-1.5 outline-none border-b border-transparent focus:border-rose"
              />
              <input
                value={s.title}
                onChange={e => updateStep(i, { title: e.target.value })}
                placeholder="Název kroku"
                className={`w-full bg-transparent text-[0.85rem] font-medium text-ink mb-1 outline-none border-b border-transparent focus:border-rose ${s.done ? 'line-through' : ''}`}
              />
              <input
                value={s.desc}
                onChange={e => updateStep(i, { desc: e.target.value })}
                placeholder="Popis"
                className="w-full bg-transparent text-[0.75rem] text-mid leading-relaxed outline-none border-b border-transparent focus:border-rose"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
