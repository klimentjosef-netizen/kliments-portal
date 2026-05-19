import type { DataCompletenessBlock as Props } from './types'

const CELL_STYLES: Record<string, { bg: string; sym: string; label: string }> = {
  complete: { bg: 'bg-[#6b9d7a] text-white',         sym: '✓', label: 'kompletní' },
  partial:  { bg: 'bg-[#d4a347] text-white',         sym: '◐', label: 'částečné' },
  missing:  { bg: 'bg-rose-blush text-rose-deep',    sym: '○', label: 'chybí' },
}

export default function DataCompletenessBlock({ title, columns, rows, summary }: Props) {
  if (columns.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-rose-pale bg-rose-blush/10 p-5 text-sm text-mid">
        {title && <p className="font-medium text-ink mb-1">{title}</p>}
        Žádná data k zobrazení.
      </div>
    )
  }

  // Spocitat celkovou kompletnost
  const totalCells = rows.reduce((s, r) => s + r.cells.length, 0)
  const completeCells = rows.reduce(
    (s, r) => s + r.cells.filter(c => c.status === 'complete').length,
    0
  )
  const partialCells = rows.reduce(
    (s, r) => s + r.cells.filter(c => c.status === 'partial').length,
    0
  )
  const pctComplete = totalCells > 0
    ? Math.round(((completeCells + partialCells * 0.5) / totalCells) * 100)
    : 0

  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5 overflow-x-auto">
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        {title && (
          <p className="text-[0.65rem] tracking-[0.16em] uppercase text-mid font-medium">
            {title}
          </p>
        )}
        <div className="flex items-center gap-2 text-[0.78rem]">
          <span className="text-mid">Kompletnost:</span>
          <span className={`font-medium tabular-nums ${
            pctComplete >= 80 ? 'text-[#4f7a5e]' :
            pctComplete >= 50 ? 'text-[#9a6b1e]' :
            'text-rose-deep'
          }`}>
            {pctComplete} %
          </span>
        </div>
      </div>

      <table className="w-full min-w-[480px] text-left">
        <caption className="sr-only">Přehled kompletnosti dat napříč kategoriemi a obdobími</caption>
        <thead>
          <tr className="border-b border-black/[0.06]">
            <th scope="col" className="py-2 pr-4 text-[0.62rem] uppercase tracking-[0.12em] text-mid font-medium">
              Kategorie
            </th>
            {columns.map((c, i) => (
              <th key={i} scope="col" className="py-2 px-2 text-center text-[0.62rem] uppercase tracking-[0.12em] text-mid font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-black/[0.04] last:border-0">
              <th scope="row" className="py-2.5 pr-4 text-[0.82rem] text-ink font-normal text-left">
                {r.label}
              </th>
              {r.cells.map((c, j) => {
                const style = CELL_STYLES[c.status] || CELL_STYLES.missing
                return (
                  <td key={j} className="py-2 px-2 text-center" title={c.note || style.label}>
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[0.85rem] font-bold ${style.bg}`}
                      aria-label={`${r.label}, ${columns[j]}: ${style.label}${c.note ? '. ' + c.note : ''}`}
                    >
                      {style.sym}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-4 text-[0.72rem] text-mid flex-wrap">
        {Object.entries(CELL_STYLES).map(([key, s]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[0.65rem] font-bold ${s.bg}`}>
              {s.sym}
            </span>
            <span>{s.label}</span>
          </span>
        ))}
      </div>

      {summary && <p className="text-[0.78rem] text-mid mt-3">{summary}</p>}
    </div>
  )
}
