interface StatCardProps {
  label: string
  value: string
  sub?: string
  trend?: string
  trendUp?: boolean
}

export default function StatCard({ label, value, sub, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.06]">
      <div className="text-[0.68rem] tracking-[0.1em] uppercase text-mid mb-2">{label}</div>
      <div className="font-serif text-3xl font-light text-rose leading-none">{value}</div>
      {sub && <div className="text-[0.72rem] text-mid mt-1">{sub}</div>}
      {trend && (
        <div className={`text-[0.68rem] font-medium mt-1.5 ${trendUp ? 'text-green' : 'text-rose-deep'}`}>
          {trend}
        </div>
      )}
    </div>
  )
}