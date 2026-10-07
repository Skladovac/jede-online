import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { reportUser } from '@/app/actions/requests'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { COUNTRY_LABEL } from '@/lib/regions'
import { collectionOverview } from '@/lib/collection-view'
import { CollectionOverview } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }> }

async function getProfile(nickname: string) {
  const user = await prisma.user.findFirst({
    where: { nickname: { equals: decodeURIComponent(nickname), mode: 'insensitive' }, bannedAt: null },
  })
  // Omezený účet (dítě bez souhlasu rodiče) navenek neexistuje.
  return user && !isLimited(user) ? user : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getProfile((await params).nickname)
  if (!user) return { title: 'Profil nenalezen' }
  return { title: user.nickname, robots: user.indexable ? undefined : { index: false, follow: false } }
}

export default async function ProfilePage({ params }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const user = await getProfile((await params).nickname)
  if (!user) notFound()

  const [viewer, ratings, completed] = await Promise.all([
    getCurrentUser(),
    prisma.rating.groupBy({ by: ['positive'], where: { toId: user.id }, _count: true }),
    prisma.tradeRequest.count({ where: { status: 'COMPLETED', OR: [{ fromId: user.id }, { toId: user.id }] } }),
  ])
  const pos = ratings.find((r) => r.positive)?._count ?? 0
  const neg = ratings.find((r) => !r.positive)?._count ?? 0

  const links = user.linksApprovedAt
    ? ([
        ['Facebook', user.facebookUrl],
        ['Instagram', user.instagramUrl],
        ['Aukro', user.aukroUrl],
      ].filter(([, v]) => v) as [string, string][])
    : []

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-yellow-400 text-2xl font-black text-slate-900">
          {user.nickname.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{user.nickname}</h1>
          <p className="text-sm text-slate-500">
            {[user.city, user.region, COUNTRY_LABEL[user.country]].filter(Boolean).join(', ')} · členem od{' '}
            {user.createdAt.toLocaleDateString('cs-CZ', { month: 'numeric', year: 'numeric' })}
          </p>
          <p className="mt-1 text-sm">
            {completed} {completed === 1 ? 'dokončená výměna' : completed >= 2 && completed <= 4 ? 'dokončené výměny' : 'dokončených výměn'}
            {pos + neg > 0 && (
              <>
                {' '}
                · 👍 {pos} · 👎 {neg} ({Math.round((pos / (pos + neg)) * 100)} % kladných)
              </>
            )}
          </p>
        </div>
      </div>

      {links.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {links.map(([k, v]) => (
            <a
              key={k}
              href={v}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-yellow-400 dark:border-slate-700"
            >
              {k} ↗
            </a>
          ))}
        </div>
      )}

      <div className="mt-10">
        <CollectionOverview data={await collectionOverview(user.id)} own={false} />
      </div>

      {viewer && viewer.id !== user.id && (
        <details className="mt-12 text-sm">
          <summary className="cursor-pointer text-slate-500 underline">Nahlásit uživatele</summary>
          <ActionForm action={reportUser} className="mt-3 max-w-lg space-y-3">
            <input type="hidden" name="againstId" value={user.id} />
            <textarea
              name="reason"
              required
              minLength={10}
              maxLength={500}
              rows={4}
              placeholder="Co se stalo? (podvod, nevhodné chování, karty neodpovídaly…)"
              className={inputCls}
            />
            <Submit variant="danger">Odeslat nahlášení</Submit>
          </ActionForm>
        </details>
      )}
    </main>
  )
}
