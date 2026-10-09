import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { adminBan, adminDelete, adminHideOffer, adminHideRating, adminRename, adminResolveReport } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { STATUS } from '@/lib/request-status'
import { COUNTRY_LABEL } from '@/lib/regions'

const OFFER = { TRADE: 'vyměním', SELL: 'prodám', GIFT: 'daruji' } as const

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  // Kontrola i na stránce, ne jen v layoutu (Next může layout při částečném vykreslení přeskočit).
  await requireAdmin()
  const { id } = await params
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      items: { include: { card: { include: { set: { select: { name: true } } } } }, orderBy: { updatedAt: 'desc' } },
      productItems: { include: { product: { select: { id: true, name: true } } }, orderBy: { updatedAt: 'desc' } },
      sentRequests: { include: { to: { select: { nickname: true } } }, orderBy: { createdAt: 'desc' }, take: 30 },
      gotRequests: { include: { from: { select: { nickname: true } } }, orderBy: { createdAt: 'desc' }, take: 30 },
      ratingsGot: { include: { from: { select: { nickname: true } } }, orderBy: { updatedAt: 'desc' } },
      reportsAgainst: { include: { from: { select: { nickname: true } } }, orderBy: { createdAt: 'desc' } },
      reportsMade: { include: { against: { select: { nickname: true } } }, orderBy: { createdAt: 'desc' } },
      _count: { select: { wants: true, productWants: true, sessions: true, phoneViewsMade: true, phoneViewsGot: true } },
    },
  })
  if (!u) notFound()
  const offers = u.items.filter((i) => i.spareQty > 0 && i.offerType)
  const productOffers = u.productItems.filter((i) => i.spareQty > 0 && i.offerType)
  const shown = u.ratingsGot.filter((r) => !r.hiddenAt)
  const pos = shown.filter((r) => r.positive).length

  const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  )

  return (
    <div className="space-y-5">
      <Link href="/admin/uzivatele" className="text-sm text-slate-500 hover:underline">
        ← Uživatelé
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-black tracking-tight">{u.nickname}</h1>
        {u.bannedAt && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">ZABLOKOVÁN</span>}
        {u.isAdmin && <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">admin</span>}
        <Link href={`/@${encodeURIComponent(u.nickname)}`} className="text-sm underline">
          veřejný profil
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Box title="Údaje">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-slate-500">E-mail</dt>
            <dd>
              {u.email} {u.emailVerifiedAt ? '✓' : <span className="text-yellow-700">(nepotvrzen)</span>}
            </dd>
            <dt className="text-slate-500">Narození</dt>
            <dd>
              {u.birthMonth}/{u.birthYear} {u.isMinor && '· dítě'}
            </dd>
            {u.isMinor && (
              <>
                <dt className="text-slate-500">Rodič</dt>
                <dd>
                  {u.parentEmail} ·{' '}
                  {u.parentConsentAt
                    ? `souhlas ${u.parentConsentAt.toLocaleDateString('cs-CZ')} (${u.parentConsentName})`
                    : 'čeká na souhlas'}
                </dd>
              </>
            )}
            <dt className="text-slate-500">Místo</dt>
            <dd>{[u.city, u.region, COUNTRY_LABEL[u.country]].filter(Boolean).join(', ')}</dd>
            <dt className="text-slate-500">Telefon</dt>
            <dd>
              {u.phone ?? '—'} · zobrazen {u._count.phoneViewsGot}× · sám zobrazil {u._count.phoneViewsMade}×
            </dd>
            <dt className="text-slate-500">Odkazy</dt>
            <dd className="break-all">
              {[u.facebookUrl, u.instagramUrl, u.aukroUrl].filter(Boolean).join(' · ') || '—'}
              {u.linksApprovedAt ? ' (schváleno)' : ''}
            </dd>
            <dt className="text-slate-500">Registrace</dt>
            <dd>{u.createdAt.toLocaleString('cs-CZ')}</dd>
            <dt className="text-slate-500">Aktivní přihlášení</dt>
            <dd>{u._count.sessions}</dd>
            <dt className="text-slate-500">Hodnocení</dt>
            <dd>
              👍 {pos} · 👎 {shown.length - pos}
            </dd>
          </dl>
        </Box>

        <Box title={`Hodnocení (${u.ratingsGot.length})`}>
          {u.ratingsGot.length ? (
            <ul className="space-y-2 text-sm">
              {u.ratingsGot.map((r) => (
                <li key={r.id} className={r.hiddenAt ? 'opacity-50' : ''}>
                  {r.positive ? '👍' : '👎'} <strong>{r.from.nickname}</strong>
                  {r.requestId ? ' · ✓ výměna' : ' · volné'}
                  {r.comment && <span className="text-slate-500"> · „{r.comment}“</span>}
                  <ActionForm action={adminHideRating} className="inline">
                    <input type="hidden" name="ratingId" value={r.id} />
                    <input type="hidden" name="hide" value={r.hiddenAt ? '0' : '1'} />
                    <button className="ml-2 text-xs text-red-600 underline">{r.hiddenAt ? 'zobrazit' : 'skrýt'}</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Žádná.</p>
          )}
        </Box>

        <Box title="Zásahy">
          <div className="space-y-5">
            <ActionForm action={adminRename} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <Field label="Přezdívka">
                <input name="nickname" defaultValue={u.nickname} className={inputCls} />
              </Field>
              <Submit variant="ghost">Přejmenovat</Submit>
            </ActionForm>
            <ActionForm action={adminBan} className="space-y-2">
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="ban" value={u.bannedAt ? '0' : '1'} />
              <p className="text-xs text-slate-500">
                Zablokovaný se nepřihlásí, jeho profil a nabídky nejsou vidět. Data zůstávají.
              </p>
              <Submit variant={u.bannedAt ? 'ghost' : 'danger'}>{u.bannedAt ? 'Odblokovat' : 'Zablokovat a odhlásit'}</Submit>
            </ActionForm>
            <details>
              <summary className="cursor-pointer text-sm text-red-600 underline">Smazat účet…</summary>
              <ActionForm action={adminDelete} className="mt-3 space-y-2">
                <input type="hidden" name="userId" value={u.id} />
                <Field label={`Pro potvrzení opiš přezdívku: ${u.nickname}`}>
                  <input name="confirmNick" className={inputCls} />
                </Field>
                <Submit variant="danger">Smazat natrvalo</Submit>
              </ActionForm>
            </details>
          </div>
        </Box>
      </div>

      <Box title={`Nahlášení na uživatele (${u.reportsAgainst.length})`}>
        {u.reportsAgainst.length ? (
          <ul className="space-y-3 text-sm">
            {u.reportsAgainst.map((r) => (
              <li key={r.id} className={r.resolvedAt ? 'opacity-50' : ''}>
                <p>
                  <strong>{r.from.nickname}</strong> · {r.createdAt.toLocaleString('cs-CZ')}
                  {r.resolvedAt && ' · vyřízeno'}
                </p>
                <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{r.reason}</p>
                <ActionForm action={adminResolveReport} className="mt-1">
                  <input type="hidden" name="reportId" value={r.id} />
                  <input type="hidden" name="resolved" value={r.resolvedAt ? '0' : '1'} />
                  <button className="text-xs underline">{r.resolvedAt ? 'Otevřít znovu' : 'Označit jako vyřízené'}</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Žádná.</p>
        )}
        {u.reportsMade.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">
            Sám nahlásil: {u.reportsMade.map((r) => r.against.nickname).join(', ')}
          </p>
        )}
      </Box>

      <Box title={`Nabídky (${offers.length + productOffers.length})`}>
        {offers.length + productOffers.length ? (
          <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {[
              ...offers.map((o) => ({
                id: o.id,
                kind: 'card',
                href: `/karta/${encodeURIComponent(o.cardId)}`,
                title: `${o.card.name} (${o.card.set.name} ${o.card.localId})`,
                o,
              })),
              ...productOffers.map((o) => ({ id: o.id, kind: 'product', href: `/produkt/${o.productId}`, title: o.product.name, o })),
            ].map(({ id, kind, href, title, o }) => (
              <li key={id} className={`flex flex-wrap items-center gap-3 py-2 ${o.hiddenAt ? 'opacity-50' : ''}`}>
                <Link href={href} className="min-w-0 flex-1 hover:underline">
                  {title}
                </Link>
                <span>
                  {o.spareQty}× {o.offerType === 'SELL' ? `${o.priceCzk} Kč` : OFFER[o.offerType!]}
                  {o.note && <em className="text-slate-500"> „{o.note}“</em>}
                </span>
                <ActionForm action={adminHideOffer}>
                  <input type="hidden" name="itemId" value={id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="hide" value={o.hiddenAt ? '0' : '1'} />
                  <button className="text-xs underline">{o.hiddenAt ? 'Zobrazit' : 'Skrýt'}</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Žádné.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Sbírka: {u.items.length} řádků karet, {u.productItems.length} produktů · hledá {u._count.wants} karet a{' '}
          {u._count.productWants} produktů
        </p>
      </Box>

      <Box title="Výměny">
        <ul className="space-y-1 text-sm">
          {[
            ...u.sentRequests.map((r) => ({ r, text: `→ ${r.to.nickname}` })),
            ...u.gotRequests.map((r) => ({ r, text: `← ${r.from.nickname}` })),
          ]
            .sort((a, b) => b.r.createdAt.getTime() - a.r.createdAt.getTime())
            .map(({ r, text }) => (
              <li key={r.id} className="flex gap-3">
                <span className="w-40 text-slate-500">{r.createdAt.toLocaleString('cs-CZ')}</span>
                <span className="flex-1">{text}</span>
                <span className={`rounded-full px-2 text-xs ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              </li>
            ))}
        </ul>
        {!u.sentRequests.length && !u.gotRequests.length && <p className="text-sm text-slate-500">Žádné.</p>}
      </Box>
    </div>
  )
}
