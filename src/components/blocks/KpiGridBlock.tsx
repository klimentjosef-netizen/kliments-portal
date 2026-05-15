import type { KpiGridBlock as Props } from './types'
import KpiBlock from './KpiBlock'

export default function KpiGridBlock({ items, columns = 4 }: Props) {
  const colsClass =
    columns === 2 ? 'sm:grid-cols-2' :
    columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' :
    'sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid grid-cols-1 ${colsClass} gap-3`}>
      {items.map((item, i) => (
        <KpiBlock
          key={item.label + i}
          {...item}
          type="kpi"
        />
      ))}
    </div>
  )
}
