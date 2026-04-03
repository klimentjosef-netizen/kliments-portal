'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Heslo musí mít alespoň 6 znaků'); return }
    if (password !== confirm) { setError('Hesla se neshodují'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) { setError('Nepodařilo se změnit heslo. Zkuste to znovu.'); return }
    setDone(true)
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand relative overflow-hidden">
      <div className="absolute w-[600px] h-[600px] rounded-full -top-24 -right-24 opacity-100"
        style={{ background: 'radial-gradient(circle, rgba(201,123,132,0.15) 0%, transparent 70%)' }} />

      <div className="bg-white rounded-[28px] p-12 shadow-xl border border-black/5 w-full max-w-[420px] relative z-10">
        <div className="font-serif text-3xl text-ink mb-2 flex items-center gap-0.5">
          Kliments<span className="text-rose text-4xl leading-none -mb-1">.</span>
        </div>
        <p className="text-sm text-mid mb-9">Nastavení nového hesla</p>

        {done ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">✓</div>
            <p className="text-[0.88rem] font-medium text-ink mb-2">Heslo změněno</p>
            <p className="text-[0.78rem] text-mid">Přesměrováváme vás do portálu...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Nové heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border-b-[1.5px] border-black/10 bg-transparent py-3 text-[0.95rem] text-ink outline-none focus:border-rose transition-colors mb-6"
              required
              minLength={6}
            />

            <label className="text-[0.62rem] tracking-[0.16em] uppercase text-mid block mb-1.5">Potvrdit heslo</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full border-b-[1.5px] border-black/10 bg-transparent py-3 text-[0.95rem] text-ink outline-none focus:border-rose transition-colors mb-8"
              required
              minLength={6}
            />

            {error && <p className="text-rose-deep text-sm mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rose text-white py-3.5 rounded-full text-[0.82rem] tracking-[0.1em] uppercase font-medium hover:bg-rose-deep transition-colors disabled:opacity-50"
            >
              {loading ? 'Ukládám...' : 'Nastavit heslo →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
