import { QuestionnaireForm } from '@/components/admin/QuestionnaireForm'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { QUESTIONS, readAnswers, type Answers } from '@/lib/questionnaire'

export const metadata = { title: 'Dotazník' }

export default async function QuestionnairePage() {
  const user = await requireUser()
  const all = await prisma.questionnaire.findMany({ include: { user: { select: { id: true, name: true } } } })
  const mine = all.find((q) => q.userId === user.id)
  const partner = all.find((q) => q.userId !== user.id)
  // Společné otázky: odpověď druhého makléře.
  const team: Answers = {}
  const partnerAnswers = readAnswers(partner?.answers)
  for (const q of QUESTIONS) if (q.scope === 'team' && partnerAnswers[q.key]) team[q.key] = partnerAnswers[q.key]

  return (
    <div>
      <p className="label text-gold-deep">Dotazník</p>
      <h1 className="mt-2 font-serif text-4xl">Pár otázek pro texty na web</h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-stone">
        Z vašich odpovědí napíšeme příběh na vaši osobní stránku, představení na úvod a stránku O nás. Odpovědi se ukládají samy, takže
        můžete kdykoli přestat a vrátit se. Až budete mít hotovo, klikněte dole na <strong>Odeslat</strong>.
      </p>
      <div className="mt-8">
        <QuestionnaireForm
          initial={readAnswers(mine?.answers)}
          team={team}
          partnerName={partner?.user.name.split(' ')[0] ?? null}
          submittedAt={mine?.submittedAt?.toISOString() ?? null}
        />
      </div>
    </div>
  )
}
