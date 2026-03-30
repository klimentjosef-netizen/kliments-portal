'use client'

interface Tab {
  id: string
  label: string
}

interface CfoTabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}

export default function CfoTabs({ tabs, active, onChange }: CfoTabsProps) {
  return (
    <div className="flex gap-1 bg-sand-deep rounded-2xl p-1 mb-6">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-5 py-2.5 rounded-xl text-[0.75rem] tracking-[0.06em] font-medium transition-all ${
            active === t.id
              ? 'bg-white text-ink shadow-sm'
              : 'text-mid hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
