import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { offerMyItem, sendRequest, setCartQty } from '@/app/actions/requests'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { RequestItems } from '@/components/RequestItems'
import { getT } from '@/lib/i18n/server'
import { EmptyState, panel } from '@/components/design'
import { AlertTriangle, ArrowLeftRight, ShieldCheck } from 'lucide-react'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Košík') }
}
export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const t = await getT()
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/kosik')

  const [drafts, mySpare, mySpareProducts] = await Promise.all([
    prisma.tradeRequest.findMany({
      where: { fromId: user.id, status: 'DRAFT' },
      include: { to: { select: { nickname: true, city: true, region: true } }, items: { orderBy: { id: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.collectionItem.findMany({
      where: { userId: user.id, spareQty: { gt: 0 } },
      include: { card: { select: { name: true, localId: true, set: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.productItem.findMany({
      where: { userId: user.id, spareQty: { gt: 0 } },
      include: { product: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const blocked = isLimited(user)
    ? t('Žádosti o výměnu půjde posílat, až rodič potvrdí tvůj účet.')
    : !user.emailVerifiedAt
      ? t('Před odesláním potvrď svůj e-mail (najdeš na stránce Můj účet).')
      : null

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Košík')}</h1>
        <p className="mt-2 text-muted">
          {t('Každému sběrateli se posílá samostatná žádost o výměnu. Když ji přijme, uvidíte navzájem e-mail a domluvíte se na předání. Web neřeší platby ani dopravu.')}{' '}
          <Link href="/bezpecny-obchod" className="inline-flex items-center gap-1 font-medium text-accent underline-offset-4 hover:underline">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {t('Jak obchodovat bezpečně')}
          </Link>
        </p>
      </div>
      {blocked && (
        <p className="flex items-start gap-2.5 rounded-xl bg-[#fff6d6] px-4 py-3 text-sm text-[#7a5600] ring-1 ring-inset ring-[#f5e19a] dark:bg-[rgba(255,203,5,0.12)] dark:text-[#ffd95c] dark:ring-[rgba(255,203,5,0.3)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          {blocked}
        </p>
      )}

      {drafts.length === 0 && (
        <EmptyState>
          {t('Košík je prázdný. U karty v sekci „Kdo ji nabízí“ klikni na')} <strong>{t('Chci')}</strong>.
        </EmptyState>
      )}

      {drafts.map((d) => {
        const wanted = d.items.filter((i) => !i.fromRequester)
        const offered = d.items.filter((i) => i.fromRequester)
        const offeredIds = new Set(offered.map((i) => (i.productItemId ? `p:${i.productItemId}` : `c:${i.collectionItemId}`)))
        const options = [
          ...mySpare.map((m) => ({ v: `c:${m.id}`, l: `${m.card.name} (${m.card.set.name} ${m.card.localId}) · ${m.spareQty}× ${t('navíc')}` })),
          ...mySpareProducts.map((m) => ({ v: `p:${m.id}`, l: `${m.product.name} · ${m.spareQty}× ${t('navíc')}` })),
        ].filter((o) => !offeredIds.has(o.v))
        const hasTrade = wanted.some((i) => i.offerType === 'TRADE')
        return (
          <section key={d.id} className={`${panel} p-5`}>
            <h2 className="text-xl font-bold text-fg">
              {t('Od')}{' '}
              <Link href={`/@${encodeURIComponent(d.to.nickname)}`} className="hover:underline">
                {d.to.nickname}
              </Link>
              <span className="text-sm font-normal text-subtle"> · {d.to.city ?? d.to.region ?? t('neuvedeno')}</span>
            </h2>
            <RequestItems
              items={wanted}
              action={(i) => (
                <ActionForm action={setCartQty} className="mt-1 flex items-center justify-end gap-2">
                  <input type="hidden" name="itemId" value={i.id} />
                  <input type="hidden" name="quantity" value={0} />
                  <button className="min-h-8 text-xs text-danger underline underline-offset-2">{t('Odebrat')}</button>
                </ActionForm>
              )}
            />

            {(hasTrade || offered.length > 0) && (
              <div className="mt-5 rounded-xl border border-line bg-surface p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <ArrowLeftRight className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden />
                  {t('Na výměnu nabízím')}
                </h3>
                {offered.length > 0 ? (
                  <RequestItems
                    items={offered}
                    action={(i) => (
                      <ActionForm action={setCartQty} className="mt-1 flex justify-end">
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="quantity" value={0} />
                        <button className="min-h-8 text-xs text-danger underline underline-offset-2">{t('Odebrat')}</button>
                      </ActionForm>
                    )}
                  />
                ) : (
                  <p className="mt-1 text-xs text-subtle">{t('Zatím nic. Vyber ze svých karet navíc.')}</p>
                )}
                {options.length > 0 ? (
                  <ActionForm action={offerMyItem} className="mt-3 flex gap-2">
                    <input type="hidden" name="requestId" value={d.id} />
                    <select name="mine" className={inputCls + ' text-sm'}>
                      {options.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                    <Submit variant="ghost">{t('Přidat')}</Submit>
                  </ActionForm>
                ) : (
                  !offered.length && (
                    <p className="mt-2 text-xs text-subtle">
                      {t('Nemáš žádné karty navíc. Označ je v sadě v režimu „Navíc“.')}
                    </p>
                  )
                )}
              </div>
            )}

            {!blocked && (
              <ActionForm action={sendRequest} className="mt-5 space-y-3">
                <input type="hidden" name="requestId" value={d.id} />
                <Submit>{t('Odeslat žádost')}</Submit>
              </ActionForm>
            )}
          </section>
        )
      })}
    </main>
  )
}
