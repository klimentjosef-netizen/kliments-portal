import type { HeadingBlock as Props } from './types'

export default function HeadingBlock({ level, text, sub, eyebrow }: Props) {
  const sizeClass =
    level === 1 ? 'text-3xl lg:text-4xl' :
    level === 2 ? 'text-2xl lg:text-3xl' :
    'text-xl lg:text-2xl'

  return (
    <div className="mb-2">
      {eyebrow && (
        <p className="text-[0.65rem] tracking-[0.18em] uppercase text-rose font-medium mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className={`font-serif ${sizeClass} text-ink font-light leading-tight`}>
        {text}
      </h2>
      {sub && <p className="text-mid mt-2 text-sm lg:text-base">{sub}</p>}
    </div>
  )
}
