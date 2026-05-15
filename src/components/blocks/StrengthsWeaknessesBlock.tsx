import type { StrengthsWeaknessesBlock as Props } from './types'

export default function StrengthsWeaknessesBlock({ strengths, weaknesses }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-[14px] border border-[#6b9d7a]/25 bg-[#eef6f1]/40 p-5">
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-[#4f7a5e] font-medium mb-3">
          ✓ Silné stránky
        </p>
        <ul className="space-y-2">
          {strengths.map((s, i) => (
            <li key={i} className="flex gap-2 text-[0.88rem] text-ink-soft leading-relaxed">
              <span className="text-[#4f7a5e] flex-shrink-0">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[14px] border border-rose-pale bg-rose-blush/40 p-5">
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-rose-deep font-medium mb-3">
          ✕ Slabé stránky
        </p>
        <ul className="space-y-2">
          {weaknesses.map((s, i) => (
            <li key={i} className="flex gap-2 text-[0.88rem] text-ink-soft leading-relaxed">
              <span className="text-rose-deep flex-shrink-0">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
