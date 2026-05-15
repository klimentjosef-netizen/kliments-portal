import type { ProgressBlock as Props } from './types'

const BAR_COLOR: Record<string, string> = {
  default:  'bg-rose',
  success:  'bg-[#6b9d7a]',
  warning:  'bg-[#d4a347]',
  critical: 'bg-rose-deep',
}

export default function ProgressBlock({ label, value, max, sub, intent = 'default' }: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5">
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-[0.85rem] font-medium text-ink">{label}</p>
        <p className="text-[0.78rem] text-mid">{pct.toFixed(0)} %</p>
      </div>
      <div className="h-2 bg-black/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full ${BAR_COLOR[intent]} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub && <p className="text-[0.72rem] text-mid mt-2">{sub}</p>}
    </div>
  )
}
