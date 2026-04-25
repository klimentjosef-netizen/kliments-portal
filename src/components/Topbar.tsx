'use client'

interface TopbarProps {
  title: string
}

export default function Topbar({ title }: TopbarProps) {
  return (
    <header className="bg-sand/90 backdrop-blur-md border-b border-black/[0.06] px-4 lg:px-9 h-[76px] flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <a href="https://www.kliments.cz" className="font-serif text-[1.35rem] text-ink no-underline tracking-[0.02em] flex items-center hover:opacity-80 transition-opacity">
          Kliments<span className="text-rose text-[1.8rem] leading-none -mb-1">.</span>
        </a>
        <span className="hidden md:block h-5 w-px bg-black/10" />
        <h1 className="hidden md:block text-[0.73rem] tracking-[0.13em] uppercase text-mid font-normal">{title}</h1>
      </div>
      <nav className="flex items-center gap-6">
        <a href="https://www.kliments.cz/#services" className="hidden lg:block text-[0.73rem] tracking-[0.13em] uppercase text-mid no-underline hover:text-ink transition-colors">Sluzby</a>
        <a href="https://www.kliments.cz/#contact" className="hidden lg:block text-[0.73rem] tracking-[0.13em] uppercase text-mid no-underline hover:text-ink transition-colors">Kontakt</a>
        <span className="text-[0.73rem] tracking-[0.13em] uppercase text-rose font-medium">Portal</span>
      </nav>
    </header>
  )
}
