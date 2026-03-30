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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RisksTab({ data }: { data: Record<string, any> }) {
  const risks = (data.risks || []) as Risk[]
  const steps = (data.steps || []) as Step[]

  return (
    <div className="space-y-6">
      {/* Risks */}
      {risks.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Aktuální rizika</h3>
          <div className="space-y-2.5">
            {risks.map((r, i) => (
              <div key={i} className={`flex gap-3 items-start p-3 rounded-lg ${
                r.level === 'critical' ? 'bg-[#fdf0f0]' : r.level === 'medium' ? 'bg-[#fff8f0]' : 'bg-[#eef6f1]'
              }`}>
                <span className={`text-[0.58rem] tracking-[0.1em] font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                  r.level === 'critical' ? 'bg-rose/20 text-rose-deep' : r.level === 'medium' ? 'bg-amber/20 text-amber' : 'bg-green/20 text-green'
                }`}>
                  {r.level === 'critical' ? 'KRITICKÉ' : r.level === 'medium' ? 'STŘEDNÍ' : 'NÍZKÉ'}
                </span>
                <div>
                  <div className="text-[0.8rem] font-medium text-ink">{r.title}</div>
                  <div className="text-[0.72rem] text-mid">{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action plan */}
      {steps.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <h3 className="font-serif text-base text-ink mb-4">Akční plán</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {steps.map((s, i) => (
              <div key={i} className={`rounded-[14px] p-5 border border-black/[0.06] ${s.done ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="font-serif text-3xl font-light text-rose-pale">{s.num}</div>
                  {s.done && (
                    <span className="bg-green/10 text-green text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 rounded">Hotovo</span>
                  )}
                </div>
                <div className="text-[0.62rem] tracking-[0.12em] uppercase text-rose font-medium mb-1.5">{s.deadline}</div>
                <div className={`text-[0.85rem] font-medium text-ink mb-1 ${s.done ? 'line-through' : ''}`}>{s.title}</div>
                <div className="text-[0.75rem] text-mid leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
