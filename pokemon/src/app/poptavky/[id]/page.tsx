import type { Metadata } from 'next'
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

export const metadata: Metadata = { title: 'Poptávka', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function RequestDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ odeslano?: string }>
}) {
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <Link href="/poptavky" className="text-sm text-slate-500 hover:underline">
        ← Poptávky
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">
          {iAmBuyer ? 'Poptávka pro ' : 'Poptávka od '}
          <Link href={`/u/${encodeURIComponent(other.nickname)}`} className="hover:underline">
            {other.nickname}
          </Link>
        </h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS[req.status].cls}`}>
          {STATUS[req.status].label}
        </span>
      </div>
      <p className="-mt-3 text-xs">
        <Link
          href={`/u/${encodeURIComponent(other.nickname)}?nahlasit=1#nahlasit`}
          className="text-slate-400 hover:text-red-600 hover:underline"
        >
          Něco nesedí? Nahlásit {other.nickname}
        </Link>
      </p>
      {odeslano && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900 dark:bg-green-500/10 dark:text-green-200">
          Odesláno! {other.nickname} dostal(a) e-mail. Jakmile odpoví, dáme ti vědět e-mailem (může skončit ve složce Spam / Nevyžádaná pošta). Stav uvidíš i tady v Poptávkách.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-bold">{iAmBuyer ? 'Chci od něj/ní' : 'Chce ode mě'}</h2>
        <RequestItems items={wanted} />
        {offered.length > 0 && (
          <>
            <h2 className="mt-5 font-bold">{iAmBuyer ? 'Nabízím na výměnu' : 'Nabízí na výměnu'}</h2>
            <RequestItems items={offered} />
          </>
        )}
      </section>

      {/* Kontakt až po přijetí. */}
      {(req.status === 'ACCEPTED' || req.status === 'COMPLETED') && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
          <h2 className="font-bold">Kontakt na {other.nickname}</h2>
          <p className="mt-2 text-sm">
            E-mail:{' '}
            <a href={`mailto:${other.email}`} className="font-semibold underline">
              {other.email}
            </a>
            {other.isMinor && other.parentEmail && (
              <>
                {' '}
                · rodič:{' '}
                <a href={`mailto:${other.parentEmail}`} className="underline">
                  {other.parentEmail}
                </a>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
            Domluvte se na předání nebo zaslání. Web neřeší platby. Neposílej peníze předem někomu, komu nevěříš, a u dětí
            nechte domluvu na rodičích.
          </p>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {req.status === 'PENDING' && !iAmBuyer && (
          <>
            <ActionForm action={respondRequest} className="contents">
              <input type="hidden" name="requestId" value={req.id} />
              <input type="hidden" name="decision" value="accept" />
              <Submit>Přijmout</Submit>
            </ActionForm>
            <ActionForm action={respondRequest} className="contents">
              <input type="hidden" name="requestId" value={req.id} />
              <input type="hidden" name="decision" value="decline" />
              <Submit variant="ghost">Odmítnout</Submit>
            </ActionForm>
          </>
        )}
        {req.status === 'ACCEPTED' && (
          <ActionForm action={markDone} className="contents">
            <input type="hidden" name="requestId" value={req.id} />
            {myDone ? (
              <p className="text-sm text-slate-500">Potvrdil(a) jsi dokončení, čekáme na {other.nickname}.</p>
            ) : (
              <Submit>Výměna proběhla</Submit>
            )}
          </ActionForm>
        )}
        {(req.status === 'PENDING' || req.status === 'ACCEPTED') && (
          <ActionForm action={cancelRequest} className="contents">
            <input type="hidden" name="requestId" value={req.id} />
            <Submit variant="ghost">Zrušit poptávku</Submit>
          </ActionForm>
        )}
      </div>

      {req.status === 'COMPLETED' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">Hodnocení</h2>
          <ActionForm action={rateRequest} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="requestId" value={req.id} />
            <label className="space-y-1 text-sm">
              <span className="block text-slate-500">Jak to proběhlo s {other.nickname}?</span>
              <select name="positive" defaultValue={myRating ? (myRating.positive ? '1' : '0') : '1'} className={inputCls}>
                <option value="1">👍 Dobře</option>
                <option value="0">👎 Špatně</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block text-slate-500">Nejvíc sedí</span>
              <select name="tag" defaultValue={myRating?.tag ?? ''} className={inputCls}>
                <option value="">–</option>
                {Object.entries(TAG_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <Submit>{myRating ? 'Upravit hodnocení' : 'Ohodnotit'}</Submit>
          </ActionForm>
          {theirRating && (
            <p className="mt-3 text-sm text-slate-500">
              {other.nickname} tě ohodnotil(a): {theirRating.positive ? '👍' : '👎'}
              {theirRating.tag && ` · ${TAG_LABEL[theirRating.tag]}`}
            </p>
          )}
        </section>
      )}
    </main>
  )
}
