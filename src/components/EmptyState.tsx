import Link from 'next/link'

const SERVICE_MESSAGES: Record<string, { icon: string; title: string; desc: string }> = {
  'CFO na volné noze': {
    icon: '📈',
    title: 'Váš finanční model se připravuje',
    desc: 'Brzy tu budete moci upravovat tarify, náklady a sledovat cashflow projekce.',
  },
  'Finanční diagnóza': {
    icon: '🔍',
    title: 'Diagnóza se připravuje',
    desc: 'Josef analyzuje vaše finanční data. Report s metrikami a SWOT analýzou bude brzy připraven.',
  },
  'Prodej za maximum': {
    icon: '⭐',
    title: 'Valuace se připravuje',
    desc: 'Josef vypočítává hodnotu vašeho podnikání pomocí tří oceňovacích metod.',
  },
  'Příprava na investora': {
    icon: '📋',
    title: 'Investor readiness se připravuje',
    desc: 'Josef připravuje checklist připravenosti a MRR projekce pro investory.',
  },
  'Mentoring': {
    icon: '👤',
    title: 'Váš mentoring začíná',
    desc: 'Po prvním sezení tu najdete záznamy, poznámky a úkoly z mentoringu.',
  },
}

const DEFAULT_MSG = {
  icon: '📋',
  title: 'Zatím žádná data',
  desc: 'Josef připravuje váš první report. Brzy tu bude.',
}

export default function EmptyState({ service }: { service?: string }) {
  const msg = (service && SERVICE_MESSAGES[service]) || DEFAULT_MSG

  return (
    <div className="text-center py-16 text-mid">
      <div className="text-4xl mb-4">{msg.icon}</div>
      <p className="text-lg font-serif text-ink mb-2">{msg.title}</p>
      <p className="text-sm mb-6">{msg.desc}</p>
      <Link
        href="/zpravy"
        className="inline-block px-6 py-2.5 rounded-full text-[0.75rem] tracking-[0.1em] uppercase font-medium bg-rose text-white hover:bg-rose-deep transition-colors"
      >
        Napsat Josefovi →
      </Link>
    </div>
  )
}
