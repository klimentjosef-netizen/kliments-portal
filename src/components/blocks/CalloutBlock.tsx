import type { CalloutBlock as Props } from './types'

const INTENT_STYLES: Record<string, { tint: string; icon: string; iconColor: string }> = {
  info:     { tint: 'border-rose-pale bg-rose-blush/30',          icon: 'i', iconColor: 'bg-rose text-white' },
  success:  { tint: 'border-[#6b9d7a]/25 bg-[#eef6f1]/40',         icon: '✓', iconColor: 'bg-[#6b9d7a] text-white' },
  warning:  { tint: 'border-[#d4a347]/25 bg-[#fdf4e8]/60',         icon: '!', iconColor: 'bg-[#d4a347] text-white' },
  critical: { tint: 'border-rose/30 bg-rose-blush/60',             icon: '!', iconColor: 'bg-rose text-white' },
}

export default function CalloutBlock({ title, body, intent = 'info' }: Props) {
  const style = INTENT_STYLES[intent]
  return (
    <div className={`rounded-[14px] border p-5 flex gap-4 ${style.tint}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-serif italic text-sm ${style.iconColor}`}>
        {style.icon}
      </div>
      <div className="flex-1">
        {title && <p className="text-[0.92rem] font-medium text-ink mb-1.5">{title}</p>}
        <p className="text-[0.85rem] text-ink-soft leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
