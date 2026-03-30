interface PnlItem {
  name: string
  amount: number
}

interface PnlTableProps {
  revenues: PnlItem[]
  costs: PnlItem[]
}

function fmt(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

export default function PnlTable({ revenues, costs }: PnlTableProps) {
  const totalRev = revenues.reduce((s, r) => s + r.amount, 0)
  const totalCost = costs.reduce((s, c) => s + c.amount, 0)
  const ebitda = totalRev - totalCost

  return (
    <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
      <h3 className="font-serif text-base text-ink mb-4">Měsíční P&L</h3>
      <table className="w-full text-[0.8rem]">
        <tbody>
          <tr><td colSpan={2} className="text-[0.62rem] tracking-[0.1em] uppercase text-rose font-medium pb-1.5 pt-2">Příjmy</td></tr>
          {revenues.map((r, i) => (
            <tr key={i} className="border-b border-black/[0.04]">
              <td className="py-1.5 text-mid">{r.name}</td>
              <td className="py-1.5 text-ink text-right font-medium">{fmt(r.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-black/[0.08]">
            <td className="py-2 text-ink font-medium">Celkem příjmy</td>
            <td className="py-2 text-ink text-right font-medium">{fmt(totalRev)}</td>
          </tr>

          <tr><td colSpan={2} className="text-[0.62rem] tracking-[0.1em] uppercase text-rose font-medium pb-1.5 pt-4">Náklady</td></tr>
          {costs.map((c, i) => (
            <tr key={i} className="border-b border-black/[0.04]">
              <td className="py-1.5 text-mid">{c.name}</td>
              <td className="py-1.5 text-ink text-right font-medium">{fmt(c.amount)}</td>
            </tr>
          ))}
          <tr className="border-b border-black/[0.08]">
            <td className="py-2 text-ink font-medium">Celkem náklady</td>
            <td className="py-2 text-ink text-right font-medium">{fmt(totalCost)}</td>
          </tr>

          <tr>
            <td className="py-3 font-serif text-base text-ink">EBITDA</td>
            <td className={`py-3 text-right font-serif text-base font-medium ${ebitda >= 0 ? 'text-green' : 'text-rose-deep'}`}>
              {fmt(ebitda)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
