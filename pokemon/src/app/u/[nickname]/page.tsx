import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { reportUser } from '@/app/actions/requests'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { COUNTRY_LABEL } from '@/lib/regions'
import { collectionOverview } from '@/lib/collection-view'
import { CollectionOverview } from '@/components/CollectionOverview'
import { ensureEurCzk } from '@/lib/fx'
import { pairMatches } from '@/lib/matches'
import { isAdult } from '@/lib/age'
import { PhoneReveal } from '@/components/PhoneReveal'
import { MatchSection } from '@/components/MatchSection'
import { TradeProposal } from '@/components/TradeProposal'
import { tradeProposal } from '@/lib/trade-proposal'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import { BadgeIcon, BadgeShelf } from '@/components/Badges'
import { refreshBadges } from '@/lib/badges'
import { FollowButton } from '@/components/Social'
import { CopyLink } from '@/components/CopyLink'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }>; searchParams?: Promise<{ nahlasit?: string; ukaz?: string }> }

async function getProfile(nickname: string) {
  const user = await prisma.user.findFirst({
    where: { nickname: { equals: (safeDecode(nickname) ?? ''), mode: 'insensitive' }, bannedAt: null },
  })
  // Omezený účet (dítě bez souhlasu rodiče) navenek neexistuje.
  return user && !isLimited(user) ? user : null
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const t = await getT()
  const user = await getProfile((await params).nickname)
  if (!user) return { title: t('Profil nenalezen') }
  // Náhled pro Facebook podle přepínače (?ukaz=hledam / nabizim); bez volby to, co profil ukáže jako první.
  const ukaz = (await searchParams)?.ukaz
  const offers = await prisma.collectionItem.count({ where: { userId: user.id, spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } })
  const view = ukaz === 'hledam' || ukaz === 'nabizim' ? ukaz : offers ? 'nabizim' : 'hledam'
  const title = view === 'hledam' ? t('Co hledá {name}', { name: user.nickname }) : t('Co nabízí {name}', { name: user.nickname })
  const description = t('Sbírka a výměny Pokémon karet na pokemon.jede.online. Máš něco z toho? Napiš mu přes web.')
  const image = `https://pokemon.jede.online/og/profil?nick=${encodeURIComponent(user.nickname)}&ukaz=${view}`
  return {
    title: user.nickname,
    robots: user.indexable ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: 'profile', siteName: 'pokemon.jede.online', images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function ProfilePage({ params, searchParams }: Props) {
  await ensureEurCzk() // kurz ČNB pro korunové částky u cen
  const t = await getT()
  const locale = await getLocale()
  const user = await getProfile((await params).nickname)
  if (!user) notFound()

  const [viewer, ratings, completed, followers, inviter] = await Promise.all([
    getCurrentUser(),
    prisma.rating.groupBy({ by: ['positive'], where: { toId: user.id, hiddenAt: null, from: { bannedAt: null } }, _count: true }),
    prisma.tradeRequest.count({ where: { status: 'COMPLETED', OR: [{ fromId: user.id }, { toId: user.id }] } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    user.invitedById ? prisma.user.findFirst({ where: { id: user.invitedById, bannedAt: null }, select: { nickname: true } }) : null,
  ])
  const iFollow =
    viewer && viewer.id !== user.id
      ? !!(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.id, followingId: user.id } } }))
      : false
  // Vlastní profil: odznaky přepočítat hned (a ukázat i ty, které ještě chybí).
  const own = viewer?.id === user.id ? await refreshBadges(user.id).catch(() => null) : null
  const overview = await collectionOverview(user.id)
  const ukaz = (await searchParams)?.ukaz
  const pos = ratings.find((r) => r.positive)?._count ?? 0
  const neg = ratings.find((r) => !r.positive)?._count ?? 0

  // Telefon jen u dospělých; samotné číslo se do stránky nevypisuje, načte se až po kliknutí.
  const hasPhone = !!user.phone && isAdult(user)

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
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight">
            {user.nickname}
            <BadgeIcon nickname={user.nickname} />
          </h1>
          <p className="text-sm text-subtle">
            {[user.city, user.region, t(COUNTRY_LABEL[user.country])].filter(Boolean).join(', ')} · {t('členem od')}{' '}
            {user.createdAt.toLocaleDateString(LOCALE_INFO[locale].intl, { month: 'numeric', year: 'numeric' })}
          </p>
          <p className="mt-1 text-sm">
            {completed} {completed === 1 ? t('dokončená výměna') : completed >= 2 && completed <= 4 ? t('dokončené výměny') : t('dokončených výměn')}
            {pos + neg > 0 && (
              <>
                {' '}
                · 👍 {pos} · 👎 {neg} ({t('{percent} % kladných', { percent: Math.round((pos / (pos + neg)) * 100) })})
              </>
            )}{' '}
            ·{' '}
            <Link href={`/@${encodeURIComponent(user.nickname)}/hodnoceni`} className="font-medium text-accent underline">
              {pos + neg > 0 ? t('Zobrazit hodnocení') : t('Ohodnotit')}
            </Link>
          </p>
          <p className="mt-1 text-sm text-subtle">
            👀 {t('Sledujících: {count}', { count: followers })}
            {inviter && (
              <>
                {' '}
                · 🎁 {t('Pozval(a):')}{' '}
                <Link href={`/@${encodeURIComponent(inviter.nickname)}`} className="underline">
                  {inviter.nickname}
                </Link>
              </>
            )}
          </p>
          {viewer?.id !== user.id && (
            <div className="mt-3">
              <FollowButton userId={user.id} following={iFollow} />
            </div>
          )}
        </div>
      </div>

      {(links.length > 0 || hasPhone) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {hasPhone && <PhoneReveal ownerId={user.id} />}
          {links.map(([k, v]) => (
            <a
              key={k}
              href={v}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="rounded-full border border-line-strong px-3 py-1 text-sm hover:border-line-strong"
            >
              {k} ↗
            </a>
          ))}
        </div>
      )}

      <BadgeShelf userId={user.id} values={own?.values} />

      {viewer && viewer.id !== user.id && !isLimited(viewer) && (
        <MatchSection
          data={await pairMatches(viewer.id, user.id)}
          nickname={user.nickname}
          proposal={await tradeProposal(viewer.id, user.id).then((p) => (p ? <TradeProposal proposal={p} otherId={user.id} nickname={user.nickname} /> : null))}
        />
      )}

      <div id="karty" className="mt-6 scroll-mt-24">
        {(() => {
          // Přepínač Nabízím / Hledám: výchozí je to, co má uživatel neprázdné (nabídky napřed). Volba je v URL, jde sdílet.
          const counts = { nabizim: overview.offers.length + overview.productItems.filter((i) => i.spareQty > 0 && i.offerType).length, hledam: overview.wanted.length + overview.productWants.length }
          const view = ukaz === 'hledam' || ukaz === 'nabizim' ? ukaz : counts.nabizim || !counts.hledam ? 'nabizim' : 'hledam'
          const tab = (id: 'nabizim' | 'hledam', label: string, active: string, idle: string) => (
            <Link
              href={`/@${encodeURIComponent(user.nickname)}?ukaz=${id}#karty`}
              scroll={false}
              aria-current={view === id ? 'page' : undefined}
              className={`flex-1 rounded-panel px-4 py-4 text-center text-lg font-black transition sm:text-xl ${view === id ? active : idle}`}
            >
              {label}
              <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-sm font-bold dark:bg-white/15">{counts[id]}</span>
            </Link>
          )
          // Majitel vidí „Nabízím / Hledám“, ostatní „Nabízí / Hledá“.
          const own = viewer?.id === user.id
          return (
            <>
              {own && (
                <div className="mb-4 rounded-panel border border-line bg-card p-4 shadow-soft">
                  <p className="mb-2 text-sm font-semibold text-fg">
                    🔗 {t('Sdílej svůj profil — kdo odkaz otevře, uvidí přepínač Nabízí / Hledá:')}
                  </p>
                  <CopyLink url={`https://pokemon.jede.online/@${encodeURIComponent(user.nickname)}?ukaz=${view}`} title={t('Co nabízím a co hledám')} />
                </div>
              )}
              <div className="mb-8 flex gap-3">
                {tab('nabizim', `🏷️ ${own ? t('Nabízím') : t('Nabízí')}`, 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-200 dark:ring-blue-500/30', 'border-2 border-blue-200 bg-card text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300')}
                {tab('hledam', `🔍 ${own ? t('Hledám') : t('Hledá')}`, 'bg-orange-500 text-white shadow-lg ring-4 ring-orange-200 dark:ring-orange-500/30', 'border-2 border-orange-200 bg-card text-orange-700 hover:bg-orange-50 dark:border-orange-500/30 dark:text-orange-300')}
              </div>
              <CollectionOverview data={overview} own={false} view={view} />
            </>
          )
        })()}
      </div>

      {viewer && viewer.id !== user.id && (
        <details id="nahlasit" className="mt-12 text-sm" open={!!(await searchParams)?.nahlasit}>
          <summary className="cursor-pointer text-subtle underline">{t('Nahlásit uživatele')}</summary>
          <ActionForm action={reportUser} className="mt-3 max-w-lg space-y-3">
            <input type="hidden" name="againstId" value={user.id} />
            <textarea
              name="reason"
              required
              minLength={10}
              maxLength={500}
              rows={4}
              placeholder={t('Co se stalo? (podvod, nevhodné chování, karty neodpovídaly…)')}
              className={inputCls}
            />
            <Submit variant="danger">{t('Odeslat nahlášení')}</Submit>
          </ActionForm>
        </details>
      )}
    </main>
  )
}
