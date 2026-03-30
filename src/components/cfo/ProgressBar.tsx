interface ProgressBarProps {
  value: number
  max: number
  label?: string
  showPercent?: boolean
}

export default function ProgressBar({ value, max, label, showPercent = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color = pct > 95 ? 'bg-rose-deep' : pct > 75 ? 'bg-amber' : 'bg-green'

  return (
    <div>
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[0.68rem] text-mid">{label}</span>
          {showPercent && <span className="text-[0.68rem] font-medium text-ink">{Math.round(pct)} %</span>}
        </div>
      )}
      <div className="h-2 bg-sand-deep rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
