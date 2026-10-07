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

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }> }

async function getUser(nickname: string) {
  const u = await prisma.user.findFirst({
    where: { nickname: { equals: (safeDecode(nickname) ?? ''), mode: 'insensitive' }, bannedAt: null },
  })
  return u && !isLimited(u) ? u : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const u = await getUser((await params).nickname)
  if (!u) return { title: 'Profil nenalezen' }
  const s = await ratingSummary(u.id)
  const title = `Hodnocení ${u.nickname}`
  const description = s.total
    ? `${s.pos}× 👍, ${s.neg}× 👎 (${s.percent} % kladných). Obchodoval(a) jsi s ${u.nickname}? Ohodnoť ho/ji.`
    : `Obchodoval(a) jsi s ${u.nickname}? Buď první, kdo ho/ji ohodnotí.`
  return {
    title,
    description,
    robots: u.indexable ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'pokemon.jede.online', locale: 'cs_CZ' },
  }
}

export default async function RatingsPage({ params }: Props) {
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
  const back = `/u/${encodeURIComponent(nick)}/hodnoceni`

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/u/${encodeURIComponent(nick)}`} className="text-sm text-slate-500 hover:underline">
        ← Profil {nick}
      </Link>
      <h1 className="mt-3 text-3xl font-black tracking-tight">Hodnocení {nick}</h1>

      <div className="mt-5 flex flex-wrap gap-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 dark:border-green-500/30 dark:bg-green-500/10">
          <p className="text-xs text-green-800 dark:text-green-300">Kladná</p>
          <p className="text-2xl font-black text-green-700 dark:text-green-400">👍 {summary.pos}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-xs text-red-800 dark:text-red-300">Záporná</p>
          <p className="text-2xl font-black text-red-700 dark:text-red-400">👎 {summary.neg}</p>
        </div>
        {summary.percent !== null && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500">Spokojenost</p>
            <p className="text-2xl font-black">{summary.percent} %</p>
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500">Z výměn přes web</p>
          <p className="text-2xl font-black">✓ {verified}</p>
        </div>
      </div>

      {own && (
        <div className="mt-6 rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-500/40 dark:bg-blue-500/10">
          <p className="mb-1 font-bold text-blue-900 dark:text-blue-200">Požádej o hodnocení</p>
          <p className="mb-3 text-sm text-blue-900/80 dark:text-blue-200/80">
            Pošli tenhle odkaz lidem, se kterými jsi už obchodoval(a) — třeba přes Facebook. Po registraci tě můžou ohodnotit.
          </p>
          <CopyLink url={`https://pokemon.jede.online${back}`} title={`Ohodnoť ${nick} na pokemon.jede.online`} />
        </div>
      )}

      {!own && (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">{mine ? 'Tvoje hodnocení' : `Obchodoval(a) jsi s ${nick}?`}</h2>
          {!viewer ? (
            <p className="mt-2 text-sm">
              Hodnotit mohou jen registrovaní uživatelé.{' '}
              <Link href={`/registrace?next=${encodeURIComponent(back)}`} className="font-semibold underline">
                Zaregistruj se
              </Link>{' '}
              (zdarma) nebo se{' '}
              <Link href={`/prihlaseni?next=${encodeURIComponent(back)}`} className="font-semibold underline">
                přihlas
              </Link>
              .
            </p>
          ) : tradeRated ? (
            <p className="mt-2 text-sm text-slate-500">
              {nick} už máš ohodnoceného po výměně přes web (✓). Hodnocení upravíš v detailu poptávky.
            </p>
          ) : !canRate ? (
            <p className="mt-2 text-sm text-slate-500">
              Hodnotit můžeš po potvrzení e-mailu{viewer.isMinor && !viewer.parentConsentAt ? ' a souhlasu rodiče' : ''}.
            </p>
          ) : (
            <ActionForm action={rateUser} className="mt-3 space-y-3">
              <input type="hidden" name="toId" value={u.id} />
              <div className="flex flex-wrap gap-3">
                <label className="space-y-1 text-sm">
                  <span className="block text-slate-500">Jak to proběhlo?</span>
                  <select name="positive" defaultValue={mine ? (mine.positive ? '1' : '0') : '1'} className={inputCls}>
                    <option value="1">👍 Dobře</option>
                    <option value="0">👎 Špatně</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-slate-500">Nejvíc sedí</span>
                  <select name="tag" defaultValue={mine?.tag ?? ''} className={inputCls}>
                    <option value="">–</option>
                    {Object.entries(TAG_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="block text-slate-500">Komentář (nepovinné, max 300 znaků)</span>
                <textarea name="comment" maxLength={300} rows={3} defaultValue={mine?.comment ?? ''} className={inputCls} />
              </label>
              <p className="text-xs text-slate-500">
                Hodnocení uvidí všichni pod tvou přezdívkou. Každého můžeš hodnotit jednou, později ho jde upravit.
              </p>
              <Submit>{mine ? 'Upravit hodnocení' : 'Ohodnotit'}</Submit>
            </ActionForm>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Všechna hodnocení ({ratings.length})</h2>
        {ratings.length ? (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg">{r.positive ? '👍' : '👎'}</span>
                  {r.from.bannedAt ? (
                    <span className="text-slate-400">zablokovaný uživatel</span>
                  ) : (
                    <Link href={`/u/${encodeURIComponent(r.from.nickname)}`} className="font-semibold hover:underline">
                      {r.from.nickname}
                    </Link>
                  )}
                  {r.requestId && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-300">
                      ✓ výměna přes web
                    </span>
                  )}
                  {r.tag && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{TAG_LABEL[r.tag]}</span>}
                  <span className="ml-auto text-xs text-slate-400">{r.updatedAt.toLocaleDateString('cs-CZ')}</span>
                </div>
                {r.comment && <p className="mt-2 whitespace-pre-wrap">„{r.comment}“</p>}
                {own && !r.from.bannedAt && (
                  <Link
                    href={`/u/${encodeURIComponent(r.from.nickname)}?nahlasit=1#nahlasit`}
                    className="mt-2 inline-block text-xs text-slate-400 hover:text-red-600 hover:underline"
                  >
                    Nesedí? Nahlásit
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">Zatím žádné hodnocení.</p>
        )}
      </section>
    </main>
  )
}
