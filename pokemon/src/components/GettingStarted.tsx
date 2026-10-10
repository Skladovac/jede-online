import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getT } from '@/lib/i18n/server'
import { btnPrimary, panel } from '@/components/design'
import { ArrowRight, Check } from 'lucide-react'

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
    <section className={`mb-10 ${panel} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold text-fg">{t('Vítej, {nickname}! Jak začít', { nickname })}</h2>
        <span className="font-mono text-xs tabular-nums text-subtle">
          {t('hotovo {done} ze {total}', { done: doneCount, total: steps.length })}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-blue-dark dark:from-accent dark:to-brand-blue" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`rounded-xl border p-4 text-sm ${
              s.done
                ? 'border-[color-mix(in_srgb,var(--positive)_25%,transparent)] bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] text-positive'
                : s === next
                  ? 'border-line-strong bg-surface'
                  : 'border-line bg-surface opacity-70'
            }`}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              {s.done ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} aria-hidden /> : <span className="font-mono text-xs text-subtle">{i + 1}.</span>}
              <span className={s.done ? '' : 'text-fg'}>{s.title}</span>
            </p>
            {!s.done && (
              <>
                <p className="mt-1 text-muted">{s.text}</p>
                {s === next && (
                  <Link href={s.href} className={`${btnPrimary} mt-3 !min-h-9 !px-4 !py-1.5 text-sm`}>
                    {s.cta}
                    <ArrowRight aria-hidden />
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
