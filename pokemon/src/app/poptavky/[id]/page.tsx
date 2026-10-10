import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cancelRequest, markDone, rateRequest, respondRequest } from '@/app/actions/requests'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { RequestItems } from '@/components/RequestItems'
import { STATUS } from '@/lib/request-status'
import { TAG_LABEL } from '@/lib/rating-tags'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'
import { TradeChat } from '@/components/TradeChat'
import { panel } from '@/components/design'
import { ArrowLeft, Check, Mail, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Výměna'), robots: { index: false, follow: false } }
}
export const dynamic = 'force-dynamic'

export default async function RequestDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ odeslano?: string }>
}) {
  const t = await getT()
  const user = await getCurrentUser()
  const { id } = await params
  if (!user) redirect(`/prihlaseni?next=/poptavky/${id}`)
  const req = await prisma.tradeRequest.findUnique({
    where: { id },
    include: { from: true, to: true, items: { orderBy: { id: 'asc' } }, ratings: true },
  })
  if (!req || (req.fromId !== user.id && req.toId !== user.id) || req.status === 'DRAFT') notFound()

  const iAmBuyer = req.fromId === user.id
  const other = iAmBuyer ? req.to : req.from
  const wanted = req.items.filter((i) => !i.fromRequester)
  const offered = req.items.filter((i) => i.fromRequester)
  const myDone = iAmBuyer ? req.fromDoneAt : req.toDoneAt
  const myRating = req.ratings.find((r) => r.fromId === user.id)
  const theirRating = req.ratings.find((r) => r.fromId !== user.id)
  const { odeslano } = await searchParams

  // Chat: zprávy k výměně (od přijetí). Co mi přišlo, je otevřením stránky přečtené.
  const chatOpen = req.status === 'ACCEPTED' || req.status === 'COMPLETED'
  const messages = chatOpen ? await prisma.tradeMessage.findMany({ where: { requestId: req.id }, orderBy: { createdAt: 'asc' }, take: 500 }) : []
  if (messages.some((m) => m.fromId !== user.id && !m.readAt))
    await prisma.tradeMessage.updateMany({ where: { requestId: req.id, fromId: { not: user.id }, readAt: null }, data: { readAt: new Date() } })
  const locale = await getLocale()

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/poptavky" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('Výměny')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold text-fg sm:text-4xl">
          {iAmBuyer ? t('Žádost o výměnu pro') : t('Žádost o výměnu od')}{' '}
          <Link href={`/@${encodeURIComponent(other.nickname)}`} className="hover:underline">
            {other.nickname}
          </Link>
        </h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS[req.status].cls}`}>
          {t(STATUS[req.status].label)}
        </span>
      </div>
      <p className="-mt-3 text-xs">
        <Link
          href={`/@${encodeURIComponent(other.nickname)}?nahlasit=1#nahlasit`}
          className="text-subtle hover:text-danger hover:underline"
        >
          {t('Něco nesedí? Nahlásit {name}', { name: other.nickname })}
        </Link>
        <span className="text-subtle"> · </span>
        <Link href="/bezpecny-obchod" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {t('Jak obchodovat bezpečně')}
        </Link>
      </p>
      {odeslano && (
        <p className="flex items-start gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] px-4 py-3 text-sm text-fg">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" strokeWidth={2.4} aria-hidden />
          {t('Odesláno! {name} dostal(a) e-mail. Jakmile odpoví, dáme ti vědět e-mailem (může skončit ve složce Spam / Nevyžádaná pošta). Stav uvidíš i tady ve Výměnách.', { name: other.nickname })}
        </p>
      )}

      <section className={`${panel} p-5`}>
        <h2 className="text-xl font-bold text-fg">{iAmBuyer ? t('Chci od něj/ní') : t('Chce ode mě')}</h2>
        <RequestItems items={wanted} />
        {offered.length > 0 && (
          <>
            <h2 className="mt-6 text-xl font-bold text-fg">{iAmBuyer ? t('Nabízím na výměnu') : t('Nabízí na výměnu')}</h2>
            <RequestItems items={offered} />
          </>
        )}
      </section>

      {/* Kontakt až po přijetí. */}
      {(req.status === 'ACCEPTED' || req.status === 'COMPLETED') && !other.bannedAt && (
        <section className={`${panel} p-5`}>
          <h2 className="flex items-center gap-3 text-xl font-bold text-fg">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
              <Mail className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            {t('Kontakt na {name}', { name: other.nickname })}
          </h2>
          <p className="mt-3 text-sm text-fg">
            {t('E-mail:')}{' '}
            <a href={`mailto:${other.email}`} className="font-semibold text-accent underline underline-offset-4">
              {other.email}
            </a>
            {other.isMinor && other.parentEmail && (
              <>
                {' '}
                · {t('rodič:')}{' '}
                <a href={`mailto:${other.parentEmail}`} className="text-accent underline underline-offset-4">
                  {other.parentEmail}
                </a>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-muted">
            {t('Domluvte se na předání nebo zaslání. Web neřeší platby. Neposílej peníze předem někomu, komu nevěříš, a u dětí nechte domluvu na rodičích.')}
          </p>
        </section>
      )}

      {chatOpen && !other.bannedAt && (
        <TradeChat
          requestId={req.id}
          otherName={other.nickname}
          canWrite={req.status === 'ACCEPTED'}
          messages={messages.map((m) => ({
            id: m.id,
            mine: m.fromId === user.id,
            body: m.body,
            at: m.createdAt.toLocaleString(LOCALE_INFO[locale].intl, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' }),
          }))}
        />
      )}

      <div className="flex flex-wrap gap-3">
        {req.status === 'PENDING' && !iAmBuyer && (
          <>
            <ActionForm action={respondRequest} className="contents">
              <input type="hidden" name="requestId" value={req.id} />
              <input type="hidden" name="decision" value="accept" />
              <Submit>{t('Přijmout')}</Submit>
            </ActionForm>
            <ActionForm action={respondRequest} className="contents">
              <input type="hidden" name="requestId" value={req.id} />
              <input type="hidden" name="decision" value="decline" />
              <Submit variant="ghost">{t('Odmítnout')}</Submit>
            </ActionForm>
          </>
        )}
        {req.status === 'ACCEPTED' && (
          <ActionForm action={markDone} className="contents">
            <input type="hidden" name="requestId" value={req.id} />
            {myDone ? (
              <p className="text-sm text-subtle">{t('Potvrdil(a) jsi dokončení, čekáme na {name}.', { name: other.nickname })}</p>
            ) : (
              <Submit>{t('Výměna proběhla')}</Submit>
            )}
          </ActionForm>
        )}
        {(req.status === 'PENDING' || req.status === 'ACCEPTED') && (
          <ActionForm action={cancelRequest} className="contents">
            <input type="hidden" name="requestId" value={req.id} />
            <Submit variant="ghost">{t('Zrušit výměnu')}</Submit>
          </ActionForm>
        )}
      </div>

      {req.status === 'COMPLETED' && (
        <section className={`${panel} p-5`}>
          <h2 className="text-xl font-bold text-fg">{t('Hodnocení')}</h2>
          <ActionForm action={rateRequest} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="requestId" value={req.id} />
            <label className="space-y-1 text-sm">
              <span className="block text-subtle">{t('Jak to proběhlo s {name}?', { name: other.nickname })}</span>
              <select name="positive" defaultValue={myRating ? (myRating.positive ? '1' : '0') : '1'} className={inputCls}>
                <option value="1">{t('Dobře')}</option>
                <option value="0">{t('Špatně')}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-subtle">{t('Nejvíc sedí')}</span>
              <select name="tag" defaultValue={myRating?.tag ?? ''} className={inputCls}>
                <option value="">–</option>
                {Object.entries(TAG_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </label>
            <Submit>{myRating ? t('Upravit hodnocení') : t('Ohodnotit')}</Submit>
          </ActionForm>
          {theirRating && (
            <p className="mt-3 flex flex-wrap items-center gap-1 text-sm text-muted">
              {t('{name} tě ohodnotil(a):', { name: other.nickname })}{' '}
              {theirRating.positive ? (
                <ThumbsUp className="h-4 w-4 text-positive" strokeWidth={1.75} role="img" aria-label={t('Kladná')} />
              ) : (
                <ThumbsDown className="h-4 w-4 text-danger" strokeWidth={1.75} role="img" aria-label={t('Záporná')} />
              )}
              {theirRating.tag && ` · ${t(TAG_LABEL[theirRating.tag])}`}
            </p>
          )}
        </section>
      )}
    </main>
  )
}
