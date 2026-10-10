import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'

/**
 * Průvodce „Jak začít“ pro nové uživatele (hlavní stránka a Můj účet po registraci).
 * Kroky se odškrtávají podle skutečných dat; když je hotovo všechno, průvodce zmizí.
 */
export async function GettingStarted({ userId, nickname, emailVerified }: { userId: string; nickname: string; emailVerified: boolean }) {
  const t = await getT()
  const [items, wants, spare, latestSet] = await Promise.all([
    prisma.collectionItem.count({ where: { userId } }),
    prisma.wantItem.count({ where: { userId } }),
    prisma.collectionItem.count({ where: { userId, spareQty: { gt: 0 } } }),
    prisma.cardSet.findFirst({ where: { game: 'pokemon' }, orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } }, select: { id: true, name: true } }),
  ])
  const steps = [
    {
      done: emailVerified,
      title: t('Potvrď e-mail'),
      text: t('Odkaz ti přišel e-mailem (podívej se i do spamu). Bez potvrzení nejde nic nabízet.'),
      href: '/ucet',
      cta: t('Můj účet'),
    },
    {
      done: items > 0,
      title: t('Odklikej, co máš'),
      text: t('Otevři sadu, přepni na „Mám“ a klepej na karty. Nebo napiš čísla karet („1, 5, 23-30“).'),
      href: latestSet ? `/sady/${encodeURIComponent(latestSet.id)}` : '/sady',
      cta: latestSet ? t('Otevřít {name}', { name: latestSet.name }) : t('Vybrat sadu'),
    },
    {
      done: wants > 0,
      title: t('Označ, co ti chybí'),
      text: t('V sadě přepni na „Chybí“, nebo jedním tlačítkem „Vše, co nemám, mi chybí“.'),
      href: '/sady',
      cta: t('Vybrat sadu'),
    },
    {
      done: spare > 0,
      title: t('Nabídni karty navíc'),
      text: t('Režim „Navíc“: karty, které máš víckrát, uvidí ostatní a můžou si o ně napsat.'),
      href: '/sady',
      cta: t('Vybrat sadu'),
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const next = steps.find((s) => !s.done)!

  return (
    <section className="mb-10 rounded-panel border-2 border-accent bg-accent-soft p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">{t('Vítej, {nickname}! Jak začít', { nickname })}</h2>
        <span className="text-sm text-muted">
          {t('hotovo {done} ze {total}', { done: doneCount, total: steps.length })}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-accent-strong" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`rounded-xl border p-3 text-sm ${
              s.done
                ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200'
                : s === next
                  ? 'border-accent bg-card'
                  : 'border-line bg-card opacity-70'
            }`}
          >
            <p className="font-semibold">
              {s.done ? '✓' : `${i + 1}.`} {s.title}
            </p>
            {!s.done && (
              <>
                <p className="mt-1 text-muted">{s.text}</p>
                {s === next && (
                  <Link
                    href={s.href}
                    className="mt-2 inline-block rounded-full bg-accent-strong px-3 py-1 text-xs font-semibold text-on-accent hover:bg-accent-hover"
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
