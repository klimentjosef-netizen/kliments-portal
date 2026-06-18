'use client'

import { useEffect } from 'react'

// Záchytný error boundary pro celý portál · místo bílé stránky ukáže
// srozumitelnou hlášku a (pro nás) detail chyby k rychlé opravě.
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // do konzole i na server (Vercel logy)
    console.error('[portal-error]', error?.message, error?.stack)
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || '',
          stack: (error?.stack || '').slice(0, 2000),
          digest: error?.digest || '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {}
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-sand-pale">
      <div className="max-w-lg w-full bg-white rounded-[20px] p-7 border border-black/[0.06]">
        <h2 className="font-serif text-xl text-ink font-light mb-2">Něco se zaseklo</h2>
        <p className="text-[0.85rem] text-mid mb-4 leading-relaxed">
          Omlouváme se · stránku se nepodařilo načíst. Zkuste to prosím znovu. Pokud to přetrvává,
          ukažte prosím Josefovi text níže, ať to hned opraví.
        </p>
        <div className="bg-sand-pale rounded-xl p-3 text-[0.72rem] text-rose-deep font-mono break-words mb-4">
          {error?.message || 'Neznámá chyba'}
          {error?.digest ? ` · ${error.digest}` : ''}
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="bg-rose text-white rounded-full px-5 py-2 text-[0.8rem] font-medium hover:bg-rose-deep transition-colors">Zkusit znovu</button>
          <a href="/portal/dashboard" className="bg-white border border-black/[0.1] text-mid rounded-full px-5 py-2 text-[0.8rem] font-medium hover:border-rose-pale transition-colors">Na dashboard</a>
        </div>
      </div>
    </div>
  )
}
