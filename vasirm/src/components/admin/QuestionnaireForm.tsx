'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Send } from 'lucide-react'
import { saveAnswer, submitQuestionnaire } from '@/app/actions/admin'
import { QUESTIONS, SECTIONS, progress, type Answers } from '@/lib/questionnaire'

/** Dotazník: každá odpověď se uloží sama po opuštění pole; „Odeslat“ pošle vše správci webu. */
export function QuestionnaireForm({
  initial,
  team,
  partnerName,
  submittedAt,
}: {
  initial: Answers
  /** odpovědi druhého makléře na společné otázky */
  team: Answers
  partnerName: string | null
  submittedAt: string | null
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answers>(initial)
  const current = useRef<Answers>({ ...initial })
  const saved = useRef<Answers>({ ...initial })
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [status, setStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({})
  const [sent, setSent] = useState(submittedAt)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const { done, total } = progress(answers, team)

  // Ukládá se 1,5 s po dopsání a při opuštění pole (kdyby někdo zavřel stránku uprostřed psaní).
  function change(key: string, value: string) {
    current.current = { ...current.current, [key]: value }
    setAnswers(current.current)
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => persist(key), 1500)
  }

  async function persist(key: string) {
    clearTimeout(timers.current[key])
    const value = current.current[key] ?? ''
    if (value === (saved.current[key] ?? '')) return
    setStatus((s) => ({ ...s, [key]: 'saving' }))
    const res = await saveAnswer(key, value).catch(() => ({ error: 'Nepovedlo se uložit.' }))
    if ('error' in res) return setStatus((s) => ({ ...s, [key]: 'error' }))
    saved.current[key] = value
    setStatus((s) => ({ ...s, [key]: 'saved' }))
  }

  return (
    <div className="space-y-8 pb-28">
      {SECTIONS.map((section) => (
        <section key={section.title} className="border border-ink/10 bg-white p-5 sm:p-7">
          <h2 className="font-serif text-3xl">{section.title}</h2>
          {section.intro && <p className="mt-1 max-w-2xl text-sm text-stone">{section.intro}</p>}
          <div className="mt-6 space-y-7">
            {section.questions.map((q) => {
              const id = `q-${q.key}`
              const partner = q.scope === 'team' ? (team[q.key] ?? '').trim() : ''
              const st = status[q.key]
              return (
                <div key={q.key}>
                  <label htmlFor={id} className="block font-medium">
                    {q.label}
                    {q.optional && <span className="ml-2 text-xs font-normal text-stone">nepovinné</span>}
                    {q.scope === 'team' && <span className="ml-2 text-xs font-normal text-gold-deep">společná otázka</span>}
                  </label>
                  {q.hint && <p className="mt-0.5 text-sm text-stone">{q.hint}</p>}
                  {partner && (
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-gold bg-paper-2 px-4 py-2.5 text-sm">
                      <span className="font-semibold">{partnerName ?? 'Kolega'} odpověděl(a):</span> {partner}
                    </p>
                  )}
                  {q.kind === 'long' ? (
                    <textarea
                      id={id}
                      value={answers[q.key] ?? ''}
                      onChange={(e) => change(q.key, e.target.value)}
                      onBlur={() => persist(q.key)}
                      rows={4}
                      placeholder={partner ? 'Chcete něco doplnit? (nepovinné)' : ''}
                      className="field mt-2 leading-relaxed"
                    />
                  ) : (
                    <input
                      id={id}
                      value={answers[q.key] ?? ''}
                      onChange={(e) => change(q.key, e.target.value)}
                      onBlur={() => persist(q.key)}
                      inputMode={q.kind === 'number' ? 'numeric' : undefined}
                      className={`field mt-2 ${q.kind === 'number' ? 'max-w-[12rem]' : ''}`}
                    />
                  )}
                  <p className="mt-1 h-4 text-xs" aria-live="polite">
                    {st === 'saving' && <span className="text-stone">Ukládám…</span>}
                    {st === 'saved' && <span className="text-emerald-700">Uloženo</span>}
                    {st === 'error' && <span className="text-red-700">Nepovedlo se uložit — zkuste to znovu.</span>}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <section className="border border-ink/10 bg-white p-5 sm:p-7">
        <h2 className="font-serif text-3xl">Reference od klientů</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-stone">
          Napadne vás 3–5 spokojených klientů? Pošlete jim krátkou zprávu, třeba takovou. Až odpoví, vložte jejich slova v administraci do
          sekce <strong>Reference</strong> a zaškrtněte souhlas.
        </p>
        <p className="mt-4 whitespace-pre-wrap border-l-2 border-gold bg-paper-2 px-4 py-3 text-[0.95rem] leading-relaxed">
          Dobrý den, připravujeme nový web a moc rádi bychom na něm měli i pár vět od klientů, se kterými jsme spolupracovali. Napsal(a)
          byste nám, jak jste byl(a) spokojen(a)? Stačí 2–3 věty. Zveřejnili bychom je se jménem ve tvaru „Jana K., Zlín“ — pokud s tím
          souhlasíte, napište prosím i to. Moc děkujeme!
        </p>
      </section>

      {/* Lišta s průběhem a odesláním */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="text-sm">
            <p>
              Vyplněno <strong className="tabular-nums">{done}</strong> z <strong className="tabular-nums">{total}</strong> povinných otázek
            </p>
            {sent && (
              <p className="flex items-center gap-1 text-emerald-800">
                <Check className="h-4 w-4" aria-hidden /> Odesláno {new Date(sent).toLocaleDateString('cs-CZ')} — úpravy můžete poslat znovu.
              </p>
            )}
            {error && <p className="text-red-700">{error}</p>}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError('')
                Object.values(timers.current).forEach(clearTimeout)
                const res = await submitQuestionnaire(current.current).catch(() => null)
                if (!res?.ok) return setError('Odeslání se nepovedlo. Odpovědi jsou uložené, zkuste to prosím znovu.')
                saved.current = { ...current.current }
                setSent(new Date().toISOString())
                router.refresh()
              })
            }
            className="btn-gold shrink-0 disabled:opacity-70"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {sent ? 'Odeslat znovu' : done < total ? 'Odeslat rozpracované' : 'Odeslat dotazník'}
          </button>
        </div>
      </div>
      <p className="sr-only">Otázek celkem: {QUESTIONS.length}</p>
    </div>
  )
}
