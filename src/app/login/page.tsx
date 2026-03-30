'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nesprávný email nebo heslo')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Zadejte e-mail'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/portal/reset-password`,
    })

    setLoading(false)
    if (error) { setError('Nepodařilo se odeslat e-mail'); return }
    setResetSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute w-[600px] h-[600px] rounded-full -top-24 -right-24 opacity-100"
        style={{ background: 'radial-gradient(circle, rgba(201,123,132,0.15) 0%, transparent 70%)' }} />
      <div className="absolute w-[400px] h-[400px] rounded-full -bottom-12 -left-12"
        style={{ background: 'radial-gradient(circle, rgba(212,184,150,0.2) 0%, transparent 70%)' }} />

      <div className="bg-white rounded-[28px] p-12 shadow-xl border border-black/5 w-full max-w-[420px] relative z-10">
        <div className="font-serif text-3xl text-ink mb-2 flex items-center gap-0.5">
          Kliments<span className="text-rose text-4xl leading-none -mb-1">.</span>
        </div>
        <p className="text-sm text-mid mb-9">
          {resetMode ? 'Obnovení hesla' : 'Klientský portál · Finanční poradenství'}
        </p>

        {resetSent ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">✉️</div>
            <p className="text-[0.88rem] font-medium text-ink mb-2">E-mail odeslán</p>
            <p className="text-[0.78rem] text-mid mb-6">Zkontrolujte svou schránku a klikněte na odkaz pro nastavení nového hesla.</p>
            <button
              onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
              className="text-[0.78rem] text-rose hover:text-rose-deep transition-colors"
            >
              ← Zpět na přihlášení
            </button>
          </div>
        ) : resetMode ? (
          <form onSubmit={handleReset}>
            <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@firma.cz"
              className="w-full border-b-[1.5px] border-black/10 bg-transparent py-3 text-[0.95rem] text-ink outline-none focus:border-rose transition-colors mb-8"
              required
            />

            {error && <p className="text-rose-deep text-sm mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose text-white py-3.5 rounded-full text-[0.82rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50 mb-4"
            >
              {loading ? 'Odesílám...' : 'Odeslat odkaz →'}
            </button>
            <button
              type="button"
              onClick={() => { setResetMode(false); setError('') }}
              className="w-full text-[0.78rem] text-mid hover:text-rose transition-colors"
            >
              ← Zpět na přihlášení
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@firma.cz"
              className="w-full border-b-[1.5px] border-black/10 bg-transparent py-3 text-[0.95rem] text-ink outline-none focus:border-rose transition-colors mb-6"
              required
            />

            <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border-b-[1.5px] border-black/10 bg-transparent py-3 text-[0.95rem] text-ink outline-none focus:border-rose transition-colors mb-3"
              required
            />

            <div className="flex justify-end mb-6">
              <button
                type="button"
                onClick={() => { setResetMode(true); setError('') }}
                className="text-[0.72rem] text-mid hover:text-rose transition-colors"
              >
                Zapomenuté heslo?
              </button>
            </div>

            {error && <p className="text-rose-deep text-sm mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose text-white py-3.5 rounded-full text-[0.82rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50"
            >
              {loading ? 'Přihlašuji...' : 'Přihlásit se →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
