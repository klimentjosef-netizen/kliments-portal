'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
        <p className="text-sm text-mid mb-9">Klientský portál · Finanční poradenství</p>

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
            className="w-full border-b-[1.5px] border-black/10 bg-transparent py-3 text-[0.95rem] text-ink outline-none focus:border-rose transition-colors mb-8"
            required
          />

          {error && (
            <p className="text-rose-deep text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-rose text-white py-3.5 rounded-full text-[0.82rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50"
          >
            {loading ? 'Přihlašuji...' : 'Přihlásit se →'}
          </button>
        </form>
      </div>
    </div>
  )
}