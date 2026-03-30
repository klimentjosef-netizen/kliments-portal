interface Question {
  question: string
  status: 'open' | 'resolved'
  answer?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function QuestionsTab({ data }: { data: Record<string, any> }) {
  const questions = (data.questions || []) as Question[]

  if (questions.length === 0) return <p className="text-mid text-sm">Žádné otevřené dotazy.</p>

  const open = questions.filter(q => q.status === 'open')
  const resolved = questions.filter(q => q.status === 'resolved')

  return (
    <div className="space-y-6">
      {/* Open questions */}
      {open.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-serif text-base text-ink">Otevřené dotazy</h3>
            <span className="bg-rose/10 text-rose-deep text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2.5 py-0.5 rounded-full">
              {open.length}
            </span>
          </div>
          <div className="space-y-3">
            {open.map((q, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#fdf0f0] border border-rose/10">
                <div className="flex items-start gap-2.5">
                  <span className="text-rose text-sm mt-0.5">●</span>
                  <div>
                    <div className="text-[0.82rem] font-medium text-ink">{q.question}</div>
                    {q.answer && <div className="text-[0.75rem] text-mid mt-1.5 leading-relaxed">{q.answer}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved questions */}
      {resolved.length > 0 && (
        <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-serif text-base text-ink">Vyřešené</h3>
            <span className="bg-green/10 text-green text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2.5 py-0.5 rounded-full">
              {resolved.length}
            </span>
          </div>
          <div className="space-y-3">
            {resolved.map((q, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#eef6f1] border border-green/10">
                <div className="flex items-start gap-2.5">
                  <span className="text-green text-sm mt-0.5">✓</span>
                  <div>
                    <div className="text-[0.82rem] font-medium text-ink">{q.question}</div>
                    {q.answer && <div className="text-[0.75rem] text-mid mt-1.5 leading-relaxed">{q.answer}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
