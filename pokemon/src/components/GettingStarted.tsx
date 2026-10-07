import Link from 'next/link'
import { prisma } from '@/lib/prisma'

/**
 * Průvodce „Jak začít“ pro nové uživatele (hlavní stránka a Můj účet po registraci).
 * Kroky se odškrtávají podle skutečných dat; když je hotovo všechno, průvodce zmizí.
 */
export async function GettingStarted({ userId, nickname, emailVerified }: { userId: string; nickname: string; emailVerified: boolean }) {
  const [items, wants, spare, latestSet] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.wantItem.count({ where: { userId } }),
    prisma.collectionItem.count({ where: { userId, spareQty: { gt: 0 } } }),
    prisma.cardSet.findFirst({ where: { game: 'pokemon' }, orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } }, select: { id: true, name: true } }),
  ])
  const steps = [
    {
      done: emailVerified,
      title: 'Potvrď e-mail',
      text: 'Odkaz ti přišel e-mailem (podívej se i do spamu). Bez potvrzení nejde nic nabízet.',
      href: '/ucet',
      cta: 'Můj účet',
    },
    {
      done: items > 0,
      title: 'Odklikej, co máš',
      text: 'Otevři sadu, přepni na „Mám“ a klepej na karty. Nebo napiš čísla karet („1, 5, 23-30“).',
      href: latestSet ? `/sady/${encodeURIComponent(latestSet.id)}` : '/sady',
      cta: latestSet ? `Otevřít ${latestSet.name}` : 'Vybrat sadu',
    },
    {
      done: wants > 0,
      title: 'Označ, co ti chybí',
      text: 'V sadě přepni na „Chybí“, nebo jedním tlačítkem „Vše, co nemám, mi chybí“.',
      href: '/sady',
      cta: 'Vybrat sadu',
    },
    {
      done: spare > 0,
      title: 'Nabídni karty navíc',
      text: 'Režim „Navíc“: karty, které máš víckrát, uvidí ostatní a můžou si o ně napsat.',
      href: '/sady',
      cta: 'Vybrat sadu',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const next = steps.find((s) => !s.done)!

  return (
    <section className="mb-10 rounded-2xl border-2 border-yellow-400 bg-yellow-50 p-5 dark:bg-yellow-400/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Vítej, {nickname}! Jak začít</h2>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          hotovo {doneCount} ze {steps.length}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-yellow-200 dark:bg-yellow-900/40">
        <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`rounded-xl border p-3 text-sm ${
              s.done
                ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200'
                : s === next
                  ? 'border-yellow-400 bg-white dark:bg-slate-900'
                  : 'border-slate-200 bg-white opacity-70 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <p className="font-semibold">
              {s.done ? '✓' : `${i + 1}.`} {s.title}
            </p>
            {!s.done && (
              <>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{s.text}</p>
                {s === next && (
                  <Link
                    href={s.href}
                    className="mt-2 inline-block rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-yellow-300"
                  >
                    {s.cta} →
                  </Link>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
