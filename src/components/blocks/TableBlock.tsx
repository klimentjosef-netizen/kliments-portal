import type { TableBlock as Props } from './types'

export default function TableBlock({ title, headers, rows, footer }: Props) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white p-5 overflow-x-auto">
      {title && (
        <p className="text-[0.65rem] tracking-[0.16em] uppercase text-mid font-medium mb-3">
          {title}
        </p>
      )}
      <table className="w-full min-w-[480px] text-left text-[0.85rem]">
        <thead>
          <tr className="border-b border-black/[0.06]">
            {headers.map((h, i) => (
              <th key={i} className="py-2.5 pr-4 text-[0.62rem] uppercase tracking-[0.14em] text-mid font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-black/[0.04] last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2.5 pr-4 text-ink-soft">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <p className="text-[0.72rem] text-mid mt-3">{footer}</p>}
    </div>
  )
}
