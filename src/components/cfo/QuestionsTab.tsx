'use client'

import { useState } from 'react'

interface Question {
  question: string
  status: 'open' | 'resolved'
  answer?: string
}

interface QuestionsTabProps {
  data: Record<string, unknown>
  onQuestionsChange: (questions: Question[]) => void
}

export default function QuestionsTab({ data, onQuestionsChange }: QuestionsTabProps) {
  const questions = (data.questions || []) as Question[]
  const [newQuestion, setNewQuestion] = useState('')

  const open = questions.filter(q => q.status === 'open')
  const resolved = questions.filter(q => q.status === 'resolved')

  function addQuestion() {
    if (!newQuestion.trim()) return
    onQuestionsChange([...questions, { question: newQuestion.trim(), status: 'open' }])
    setNewQuestion('')
  }

  function updateQuestion(i: number, patch: Partial<Question>) {
    onQuestionsChange(questions.map((q, j) => j === i ? { ...q, ...patch } : q))
  }

  function removeQuestion(i: number) {
    onQuestionsChange(questions.filter((_, j) => j !== i))
  }

  function toggleResolved(i: number) {
    const q = questions[i]
    updateQuestion(i, { status: q.status === 'open' ? 'resolved' : 'open' })
  }

  // Find the real index in the full array for a filtered item
  function realIndex(filtered: Question[], localIdx: number): number {
    return questions.indexOf(filtered[localIdx])
  }

  return (
    <div className="space-y-6">
      {/* Add new question */}
      <div className="bg-white rounded-[20px] p-6 border border-black/[0.06]">
        <h3 className="font-serif text-base text-ink mb-3">Nový dotaz</h3>
        <div className="flex gap-3">
          <input
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addQuestion()}
            placeholder="Napište svůj dotaz..."
            className="flex-1 bg-transparent border-b border-black/10 py-2 text-sm outline-none focus:border-rose transition-colors"
          />
          <button
            onClick={addQuestion}
            disabled={!newQuestion.trim()}
            className="px-5 py-2 rounded-full text-[0.72rem] font-medium bg-rose text-white hover:bg-rose-deep transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Odeslat
          </button>
        </div>
      </div>

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
            {open.map((q, i) => {
              const ri = realIndex(open, i)
              return (
                <div key={ri} className="p-4 rounded-xl bg-[#fdf0f0] border border-rose/10">
                  <div className="flex items-start gap-2.5">
                    <span className="text-rose text-sm mt-0.5">●</span>
                    <div className="flex-1 space-y-1.5">
                      <input
                        value={q.question}
                        onChange={e => updateQuestion(ri, { question: e.target.value })}
                        className="w-full bg-transparent text-[0.82rem] font-medium text-ink outline-none border-b border-transparent focus:border-rose"
                      />
                      <input
                        value={q.answer || ''}
                        onChange={e => updateQuestion(ri, { answer: e.target.value })}
                        placeholder="Odpověď..."
                        className="w-full bg-transparent text-[0.75rem] text-mid outline-none border-b border-transparent focus:border-rose"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => toggleResolved(ri)}
                        className="text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 rounded bg-green/10 text-green hover:bg-green/20 transition-colors"
                      >
                        Vyřešit
                      </button>
                      <button onClick={() => removeQuestion(ri)} className="text-mid hover:text-rose-deep text-sm">✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
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
            {resolved.map((q, i) => {
              const ri = realIndex(resolved, i)
              return (
                <div key={ri} className="p-4 rounded-xl bg-[#eef6f1] border border-green/10">
                  <div className="flex items-start gap-2.5">
                    <span className="text-green text-sm mt-0.5">✓</span>
                    <div className="flex-1 space-y-1.5">
                      <input
                        value={q.question}
                        onChange={e => updateQuestion(ri, { question: e.target.value })}
                        className="w-full bg-transparent text-[0.82rem] font-medium text-ink outline-none border-b border-transparent focus:border-rose"
                      />
                      {q.answer && (
                        <input
                          value={q.answer}
                          onChange={e => updateQuestion(ri, { answer: e.target.value })}
                          className="w-full bg-transparent text-[0.75rem] text-mid outline-none border-b border-transparent focus:border-rose"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => toggleResolved(ri)}
                        className="text-[0.6rem] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 rounded bg-rose/10 text-rose hover:bg-rose/20 transition-colors"
                      >
                        Znovu otevřít
                      </button>
                      <button onClick={() => removeQuestion(ri)} className="text-mid hover:text-rose-deep text-sm">✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {questions.length === 0 && (
        <p className="text-[0.8rem] text-mid text-center py-4">Žádné dotazy. Přidejte svůj první dotaz výše.</p>
      )}
    </div>
  )
}
