import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { ratingSummary } from '@/lib/ratings'
import { TAG_LABEL } from '@/lib/rating-tags'
import { rateUser } from '@/app/actions/ratings'
import { ActionForm } from '@/components/ActionForm'
import { CopyLink } from '@/components/CopyLink'
import { Submit, inputCls } from '@/components/ui'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import { Badge, StatCard, panel } from '@/components/design'
import { ArrowLeft, Check, Link2, ThumbsDown, ThumbsUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }> }

async function getUser(nickname: string) {
  const u = await prisma.user.findFirst({
    where: { nickname: { equals: (safeDecode(nickname) ?? ''), mode: 'insensitive' }, bannedAt: null },
  })
  return u && !isLimited(u) ? u : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getT()
  const u = await getUser((await params).nickname)
  if (!u) return { title: t('Profil nenalezen') }
  const s = await ratingSummary(u.id)
  const title = t('Hodnocení {name}', { name: u.nickname })
  const description = s.total
    ? `${s.pos}× 👍, ${s.neg}× 👎 (${t('{percent} % kladných', { percent: s.percent ?? 0 })}). ${t('Obchodoval(a) jsi s {name}? Ohodnoť ho/ji.', { name: u.nickname })}`
    : t('Obchodoval(a) jsi s {name}? Buď první, kdo ho/ji ohodnotí.', { name: u.nickname })
  return {
    title,
    description,
    robots: u.indexable ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'pokemon.jede.online', locale: LOCALE_INFO[await getLocale()].intl.replace('-', '_') },
  }
}

export default async function RatingsPage({ params }: Props) {
  const t = await getT()
  const intl = LOCALE_INFO[await getLocale()].intl
  const u = await getUser((await params).nickname)
  if (!u) notFound()
  const [viewer, summary, ratings] = await Promise.all([
    getCurrentUser(),
    ratingSummary(u.id),
    prisma.rating.findMany({
      where: { toId: u.id, hiddenAt: null, from: { bannedAt: null } },
      include: { from: { select: { nickname: true, bannedAt: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ])
  const verified = ratings.filter((r) => r.requestId).length
  const own = viewer?.id === u.id
  const mine = viewer && !own ? ratings.find((r) => r.fromId === viewer.id && !r.requestId) : undefined
  const tradeRated = viewer && !own && ratings.some((r) => r.fromId === viewer.id && r.requestId)
  const canRate = viewer && !own && viewer.emailVerifiedAt && !isLimited(viewer)
  const nick = u.nickname
  const back = `/@${encodeURIComponent(nick)}/hodnoceni`

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/@${encodeURIComponent(nick)}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('Profil {name}', { name: nick })}
      </Link>
      <h1 className="mt-3 text-4xl font-extrabold text-fg sm:text-[44px]">{t('Hodnocení {name}', { name: nick })}</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('Kladná')}
          tone="positive"
          value={
            <span className="inline-flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" strokeWidth={1.75} aria-hidden /> {summary.pos}
            </span>
          }
        />
        <div className={`${panel} px-4 py-3.5`}>
          <p className="eyebrow !text-[10.5px]">{t('Záporná')}</p>
          <p className="mt-1.5 inline-flex items-center gap-2 font-display text-[26px] font-bold leading-tight tabular-nums text-danger">
            <ThumbsDown className="h-5 w-5" strokeWidth={1.75} aria-hidden /> {summary.neg}
          </p>
        </div>
        {summary.percent !== null && <StatCard label={t('Spokojenost')} value={`${summary.percent} %`} />}
        <StatCard
          label={t('Z výměn přes web')}
          value={
            <span className="inline-flex items-center gap-2">
              <Check className="h-5 w-5 text-positive" strokeWidth={2.4} aria-hidden /> {verified}
            </span>
          }
        />
      </div>

      {own && (
        <div className={`${panel} mt-6 p-5`}>
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
              <Link2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 font-bold text-fg">{t('Požádej o hodnocení')}</p>
              <p className="mb-3 text-sm text-muted">
                {t('Pošli tenhle odkaz lidem, se kterými jsi už obchodoval(a) — třeba přes Facebook. Po registraci tě můžou ohodnotit.')}
              </p>
              <CopyLink url={`https://pokemon.jede.online${back}`} title={t('Ohodnoť {name} na pokemon.jede.online', { name: nick })} />
            </div>
          </div>
        </div>
      )}

      {!own && (
        <section className={`${panel} mt-8 p-5`}>
          <h2 className="text-xl font-bold text-fg">{mine ? t('Tvoje hodnocení') : t('Obchodoval(a) jsi s {name}?', { name: nick })}</h2>
          {!viewer ? (
            <p className="mt-2 text-sm">
              {t('Hodnotit mohou jen registrovaní uživatelé.')}{' '}
              <Link href={`/registrace?next=${encodeURIComponent(back)}`} className="font-semibold text-accent underline underline-offset-4">
                {t('Zaregistruj se')}
              </Link>{' '}
              {t('(zdarma) nebo se')}{' '}
              <Link href={`/prihlaseni?next=${encodeURIComponent(back)}`} className="font-semibold text-accent underline underline-offset-4">
                {t('přihlas')}
              </Link>
              .
            </p>
          ) : tradeRated ? (
            <p className="mt-2 text-sm text-muted">
              {t('{name} už máš ohodnoceného po výměně přes web. Hodnocení upravíš v detailu výměny.', { name: nick })}
            </p>
          ) : !canRate ? (
            <p className="mt-2 text-sm text-muted">
              {viewer.isMinor && !viewer.parentConsentAt ? t('Hodnotit můžeš po potvrzení e-mailu a souhlasu rodiče.') : t('Hodnotit můžeš po potvrzení e-mailu.')}
            </p>
          ) : (
            <ActionForm action={rateUser} className="mt-3 space-y-3">
              <input type="hidden" name="toId" value={u.id} />
              <div className="flex flex-wrap gap-3">
                <label className="space-y-1 text-sm">
                  <span className="block text-subtle">{t('Jak to proběhlo?')}</span>
                  <select name="positive" defaultValue={mine ? (mine.positive ? '1' : '0') : '1'} className={inputCls}>
                    <option value="1">{t('Dobře')}</option>
                    <option value="0">{t('Špatně')}</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-subtle">{t('Nejvíc sedí')}</span>
                  <select name="tag" defaultValue={mine?.tag ?? ''} className={inputCls}>
                    <option value="">–</option>
                    {Object.entries(TAG_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {t(v)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="block text-subtle">{t('Komentář (nepovinné, max 300 znaků)')}</span>
                <textarea name="comment" maxLength={300} rows={3} defaultValue={mine?.comment ?? ''} className={inputCls} />
              </label>
              <p className="text-xs text-subtle">
                {t('Hodnocení uvidí všichni pod tvou přezdívkou. Každého můžeš hodnotit jednou, později ho jde upravit.')}
              </p>
              <Submit>{mine ? t('Upravit hodnocení') : t('Ohodnotit')}</Submit>
            </ActionForm>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-fg">
          {t('Všechna hodnocení')} <span className="tabular-nums text-muted">({ratings.length})</span>
        </h2>
        {ratings.length ? (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className={`${panel} p-4 text-sm`}>
                <div className="flex flex-wrap items-center gap-2">
                  {r.positive ? (
                    <ThumbsUp className="h-5 w-5 text-positive" strokeWidth={1.75} role="img" aria-label={t('Kladná')} />
                  ) : (
                    <ThumbsDown className="h-5 w-5 text-danger" strokeWidth={1.75} role="img" aria-label={t('Záporná')} />
                  )}
                  {r.from.bannedAt ? (
                    <span className="text-subtle">{t('zablokovaný uživatel')}</span>
                  ) : (
                    <Link href={`/@${encodeURIComponent(r.from.nickname)}`} className="font-semibold text-fg hover:underline">
                      {r.from.nickname}
                    </Link>
                  )}
                  {r.requestId && (
                    <Badge tone="positive">
                      <Check strokeWidth={2.6} aria-hidden />
                      {t('výměna přes web')}
                    </Badge>
                  )}
                  {r.tag && <Badge>{t(TAG_LABEL[r.tag])}</Badge>}
                  <span className="ml-auto font-mono text-[11.5px] tabular-nums text-subtle">{r.updatedAt.toLocaleDateString(intl)}</span>
                </div>
                {r.comment && <p className="mt-2 whitespace-pre-wrap text-fg">„{r.comment}“</p>}
                {own && !r.from.bannedAt && (
                  <Link
                    href={`/@${encodeURIComponent(r.from.nickname)}?nahlasit=1#nahlasit`}
                    className="mt-2 inline-block text-xs text-subtle hover:text-danger hover:underline"
                  >
                    {t('Nesedí? Nahlásit')}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-subtle">{t('Zatím žádné hodnocení.')}</p>
        )}
      </section>
    </main>
  )
}
