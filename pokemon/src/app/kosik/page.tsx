import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isLimited } from '@/lib/auth'
import { offerMyItem, sendRequest, setCartQty } from '@/app/actions/requests'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { RequestItems } from '@/components/RequestItems'

export const metadata: Metadata = { title: 'Košík' }
export const dynamic = 'force-dynamic'

export default async function CartPage() {
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
    ? 'Žádosti o výměnu půjde posílat, až rodič potvrdí tvůj účet.'
    : !user.emailVerifiedAt
      ? 'Před odesláním potvrď svůj e-mail (najdeš na stránce Můj účet).'
      : null

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Košík</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Každému sběrateli se posílá samostatná žádost o výměnu. Když ji přijme, uvidíte navzájem e-mail a domluvíte se na
          předání. Web neřeší platby ani dopravu.{' '}
          <Link href="/bezpecny-obchod" className="font-medium underline">
            🛡️ Jak obchodovat bezpečně
          </Link>
        </p>
      </div>
      {blocked && (
        <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
          {blocked}
        </p>
      )}

      {drafts.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          Košík je prázdný. U karty v sekci „Kdo ji nabízí“ klikni na <strong>Chci</strong>.
        </p>
      )}

      {drafts.map((d) => {
        const wanted = d.items.filter((i) => !i.fromRequester)
        const offered = d.items.filter((i) => i.fromRequester)
        const offeredIds = new Set(offered.map((i) => (i.productItemId ? `p:${i.productItemId}` : `c:${i.collectionItemId}`)))
        const options = [
          ...mySpare.map((m) => ({ v: `c:${m.id}`, l: `${m.card.name} (${m.card.set.name} ${m.card.localId}) · ${m.spareQty}× navíc` })),
          ...mySpareProducts.map((m) => ({ v: `p:${m.id}`, l: `${m.product.name} · ${m.spareQty}× navíc` })),
        ].filter((o) => !offeredIds.has(o.v))
        const hasTrade = wanted.some((i) => i.offerType === 'TRADE')
        return (
          <section key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold">
              Od{' '}
              <Link href={`/u/${encodeURIComponent(d.to.nickname)}`} className="hover:underline">
                {d.to.nickname}
              </Link>
              <span className="text-sm font-normal text-slate-500"> · {d.to.city ?? d.to.region ?? 'neuvedeno'}</span>
            </h2>
            <RequestItems
              items={wanted}
              action={(i) => (
                <ActionForm action={setCartQty} className="mt-1 flex items-center justify-end gap-2">
                  <input type="hidden" name="itemId" value={i.id} />
                  <input type="hidden" name="quantity" value={0} />
                  <button className="text-xs text-red-600 underline">Odebrat</button>
                </ActionForm>
              )}
            />

            {(hasTrade || offered.length > 0) && (
              <div className="mt-5 rounded-xl bg-blue-50 p-4 dark:bg-blue-500/10">
                <h3 className="text-sm font-semibold">Na výměnu nabízím</h3>
                {offered.length > 0 ? (
                  <RequestItems
                    items={offered}
                    action={(i) => (
                      <ActionForm action={setCartQty} className="mt-1 flex justify-end">
                        <input type="hidden" name="itemId" value={i.id} />
                        <input type="hidden" name="quantity" value={0} />
                        <button className="text-xs text-red-600 underline">Odebrat</button>
                      </ActionForm>
                    )}
                  />
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Zatím nic. Vyber ze svých karet navíc.</p>
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
                    <Submit variant="ghost">Přidat</Submit>
                  </ActionForm>
                ) : (
                  !offered.length && (
                    <p className="mt-2 text-xs text-slate-500">
                      Nemáš žádné karty navíc. Označ je v sadě v režimu „Navíc“.
                    </p>
                  )
                )}
              </div>
            )}

            {!blocked && (
              <ActionForm action={sendRequest} className="mt-5 space-y-3">
                <input type="hidden" name="requestId" value={d.id} />
                <Submit>Odeslat žádost</Submit>
              </ActionForm>
            )}
          </section>
        )
      })}
    </main>
  )
}
