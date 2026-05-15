import type { TextBlock as Props } from './types'

export default function TextBlock({ body, variant = 'normal' }: Props) {
  const cls =
    variant === 'lead' ? 'text-base lg:text-lg leading-relaxed text-ink' :
    variant === 'muted' ? 'text-sm text-mid leading-relaxed' :
    'text-sm lg:text-[0.95rem] text-ink-soft leading-relaxed'

  // Podpora víceřádkovéhо textu (\n = paragraph break)
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

  return (
    <div className={cls + ' space-y-3'}>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  )
}
