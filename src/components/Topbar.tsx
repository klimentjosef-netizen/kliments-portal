'use client'

interface TopbarProps {
  title: string
}

export default function Topbar({ title }: TopbarProps) {
  return (
    <header className="bg-sand/90 backdrop-blur-md border-b border-black/[0.06] px-9 h-16 flex items-center justify-between sticky top-0 z-40">
      <h1 className="font-serif text-lg text-ink">{title}</h1>
    </header>
  )
}