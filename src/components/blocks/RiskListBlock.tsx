import type { RiskListBlock as Props, RiskItem } from './types'

const LEVEL_STYLES: Record<RiskItem['level'], { badge: string; tint: string; label: string }> = {
  critical: {
    badge: 'bg-rose text-white',
    tint: 'border-rose-pale bg-rose-blush/40',
    label: 'KRITICKÉ',
  },
  medium: {
    badge: 'bg-[#d4a347] text-white',
    tint: 'border-[#d4a347]/30 bg-[#fdf4e8]/60',
    label: 'STŘEDNÍ',
  },
  low: {
    badge: 'bg-[#6b9d7a] text-white',
    tint: 'border-[#6b9d7a]/30 bg-[#eef6f1]/60',
    label: 'NÍZKÉ',
  },
}

export default function RiskListBlock({ title, items }: Props) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5">
      {title && (
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-mid font-medium mb-4">
          {title}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((it, i) => {
          const style = LEVEL_STYLES[it.level]
          return (
            <li
              key={it.id || i}
              className={`flex gap-3 items-start p-3 rounded-[10px] border ${style.tint}`}
            >
              <span className={`flex-shrink-0 text-[0.58rem] font-bold tracking-wider rounded-full px-2.5 py-1 ${style.badge}`}>
                {style.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[0.88rem] font-medium text-ink">{it.title}</p>
                {it.desc && <p className="text-[0.78rem] text-mid mt-0.5">{it.desc}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
