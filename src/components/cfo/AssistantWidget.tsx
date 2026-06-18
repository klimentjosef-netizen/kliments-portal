'use client'

import { useState, useRef, useEffect } from 'react'

// CFO kecálek · plovoucí průvodce. Streamuje odpovědi z /api/cfo-assistant,
// uzemněné v datech klienta. Drží se palety portálu (ink/sand/rose).

type Msg = { role: 'user' | 'assistant'; content: string }
type Insight = { id: string; title: string; detail: string; severity: 'good' | 'info' | 'warn' | 'critical'; prompt: string }

interface Props {
  clientId?: string
  clientName?: string
}

const SEV: Record<Insight['severity'], { dot: string; ring: string }> = {
  critical: { dot: 'bg-rose-deep', ring: 'hover:border-rose/40' },
  warn: { dot: 'bg-amber-500', ring: 'hover:border-amber-300' },
  info: { dot: 'bg-sky-500', ring: 'hover:border-sky-300' },
  good: { dot: 'bg-green', ring: 'hover:border-green/40' },
}

const STARTERS = [
  'Jak na tom firma celkově je?',
  'Kde nejvíc utíkají peníze?',
  'Co je teď moje největší riziko?',
  'Co můžu udělat pro lepší zisk?',
]

export default function AssistantWidget({ clientId, clientName }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const insightsLoaded = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const storageKey = `klimentik-chat-${clientId || 'self'}`

  // Paměť konverzace · přežije refresh (lokálně v prohlížeči, per klient)
  useEffect(() => {
    try {
      const s = localStorage.getItem(storageKey)
      if (s) setMessages(JSON.parse(s))
    } catch {}
  }, [storageKey])
  useEffect(() => {
    try {
      if (messages.length) localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)))
    } catch {}
  }, [messages, storageKey])

  function clearChat() {
    setMessages([])
    try { localStorage.removeItem(storageKey) } catch {}
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    if (insightsLoaded.current) return
    insightsLoaded.current = true
    fetch('/api/cfo-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, mode: 'insights' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.insights) setInsights(d.insights) })
      .catch(() => {})
  }, [open, clientId])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const history = [...messages, { role: 'user' as const, content: q }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)
    try {
      const res = await fetch('/api/cfo-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, messages: history }),
      })
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => '')
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: msg || 'Něco se nepovedlo. Zkuste to prosím znovu.' }
          return copy
        })
        setBusy(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: acc }
          return copy
        })
      }
    } catch {
      setMessages((m) => {
        const copy = [...m]
        copy[copy.length - 1] = { role: 'assistant', content: 'Spojení se přerušilo. Zkuste to prosím znovu.' }
        return copy
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-ink text-sand rounded-full pl-4 pr-5 py-3 shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Otevřít CFO Klimentíka"
        >
          <span className="grid place-items-center w-7 h-7 rounded-full bg-rose text-white font-serif italic text-sm">K</span>
          <span className="text-[0.82rem] font-medium">Zeptat se Klimentíka</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed z-40 left-3 right-3 bottom-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[400px] h-[min(82vh,620px)] bg-sand-pale rounded-[22px] shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-ink text-sand px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-rose text-white font-serif italic">K</span>
              <div>
                <div className="font-serif text-[0.95rem] leading-tight">CFO Klimentík</div>
                <div className="text-[0.64rem] text-white/45 leading-tight">{clientName ? `firma ${clientName}` : 'váš finanční parťák'}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clearChat} className="text-white/45 hover:text-white text-[0.64rem] px-2 py-1 rounded-full border border-white/15" aria-label="Nová konverzace">Nová</button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-lg leading-none px-1" aria-label="Zavřít">×</button>
            </div>
          </div>

          {/* Zprávy */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 text-[0.84rem] text-ink leading-relaxed border border-black/[0.05]">
                  Dobrý den. Jsem CFO Klimentík · rozumím číslům vaší firmy. Zeptejte se mě na cokoli, nebo zkuste jednu z otázek níže.
                  <div className="mt-2 text-[0.7rem] text-mid">Vycházím z dat v portálu. Uzavřené roky jsou historie; letošní rok je živá verze.</div>
                </div>

                {insights.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid px-1">Čeho jsem si všiml</div>
                    {insights.map((it) => (
                      <button key={it.id} onClick={() => send(it.prompt)}
                        className={`w-full text-left bg-white border border-black/[0.06] rounded-xl px-3.5 py-2.5 transition-colors ${SEV[it.severity].ring}`}>
                        <div className="flex items-start gap-2">
                          <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${SEV[it.severity].dot}`} />
                          <div>
                            <div className="text-[0.8rem] font-medium text-ink leading-snug">{it.title}</div>
                            <div className="text-[0.72rem] text-mid leading-snug mt-0.5">{it.detail}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="text-[0.6rem] tracking-[0.1em] uppercase text-mid px-1">Nebo se zeptejte</div>
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="text-left text-[0.8rem] text-ink bg-white border border-black/[0.06] rounded-xl px-3.5 py-2.5 hover:border-rose-pale hover:bg-rose/[0.03] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={
                  m.role === 'user'
                    ? 'bg-rose text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[0.84rem] leading-relaxed max-w-[85%] whitespace-pre-wrap'
                    : 'bg-white text-ink rounded-2xl rounded-tl-sm px-4 py-3 text-[0.84rem] leading-relaxed max-w-[90%] border border-black/[0.05] whitespace-pre-wrap'
                }>
                  {m.content || (busy && i === messages.length - 1 ? <Dots /> : '')}
                </div>
              </div>
            ))}
          </div>

          {/* Vstup */}
          <div className="shrink-0 border-t border-black/[0.06] bg-white px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
                }}
                rows={1}
                placeholder="Napište dotaz…"
                className="flex-1 resize-none bg-sand-pale rounded-xl px-3.5 py-2.5 text-[0.84rem] text-ink outline-none focus:ring-1 focus:ring-rose max-h-28"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-ink text-sand disabled:opacity-30 hover:bg-black transition-colors"
                aria-label="Odeslat"
              >
                ↑
              </button>
            </div>
            <div className="text-[0.6rem] text-mid mt-1.5 px-1">AI průvodce · může se splést, klíčová rozhodnutí ověřte s Josefem.</div>
          </div>
        </div>
      )}
    </>
  )
}

function Dots() {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-mid/50 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-mid/50 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-mid/50 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}
