import type { StepListBlock as Props } from './types'

export default function StepListBlock({ title, items, layout = 'cards' }: Props) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5">
      {title && (
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-mid font-medium mb-4">
          {title}
        </p>
      )}

      {layout === 'timeline' ? (
        <ol className="relative border-l-2 border-rose/30 ml-3 space-y-5">
          {items.map((s, i) => (
            <li key={s.id || i} className="pl-5 relative">
              <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-rose" />
              <div className="flex items-baseline gap-2 mb-1">
                {s.num !== undefined && (
                  <span className="font-serif italic text-rose text-sm">
                    {String(s.num).padStart(2, '0')}
                  </span>
                )}
                {s.deadline && (
                  <span className="text-[0.6rem] tracking-wider uppercase text-mid">
                    {s.deadline}
                  </span>
                )}
              </div>
              <p className={`text-[0.92rem] font-medium ${s.done ? 'text-mid line-through' : 'text-ink'}`}>
                {s.title}
              </p>
              {s.desc && <p className="text-[0.78rem] text-mid mt-1">{s.desc}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((s, i) => (
            <div
              key={s.id || i}
              className={`rounded-[10px] border p-4 ${s.done ? 'border-[#6b9d7a]/30 bg-[#eef6f1]/40' : 'border-black/[0.06] bg-sand-light/40'}`}
            >
              {(s.num !== undefined || s.deadline) && (
                <div className="flex items-baseline gap-2 mb-2">
                  {s.num !== undefined && (
                    <span className="font-serif italic text-rose text-sm">
                      {String(s.num).padStart(2, '0')}
                    </span>
                  )}
                  {s.deadline && (
                    <span className="text-[0.58rem] tracking-wider uppercase text-mid">
                      {s.deadline}
                    </span>
                  )}
                </div>
              )}
              <p className={`text-[0.88rem] font-medium ${s.done ? 'text-mid line-through' : 'text-ink'}`}>
                {s.title}
              </p>
              {s.desc && <p className="text-[0.74rem] text-mid mt-1">{s.desc}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
