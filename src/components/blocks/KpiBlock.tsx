import type { KpiBlock as Props } from './types'

const INTENT_STYLES: Record<string, string> = {
  default:  'bg-white border-black/[0.06]',
  success:  'bg-[#eef6f1] border-[#6b9d7a]/30',
  warning:  'bg-[#fdf4e8] border-[#d4a347]/30',
  critical: 'bg-rose-blush border-rose-pale',
}

const TREND_ICON: Record<string, { sym: string; cls: string }> = {
  up:      { sym: '↑', cls: 'text-[#4f7a5e]' },
  down:    { sym: '↓', cls: 'text-rose-deep' },
  neutral: { sym: '→', cls: 'text-mid' },
}

export default function KpiBlock({ label, value, sub, trend, intent = 'default' }: Props) {
  return (
    <div className={`rounded-[14px] border p-5 ${INTENT_STYLES[intent]}`}>
      <p className="text-[0.62rem] tracking-[0.14em] uppercase text-mid font-medium mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <p className="font-serif text-2xl lg:text-3xl text-ink leading-none">
          {value}
        </p>
        {trend && (
          <span className={`text-sm font-medium ${TREND_ICON[trend].cls}`}>
            {TREND_ICON[trend].sym}
          </span>
        )}
      </div>
      {sub && <p className="text-[0.72rem] text-mid mt-1.5">{sub}</p>}
    </div>
  )
}
