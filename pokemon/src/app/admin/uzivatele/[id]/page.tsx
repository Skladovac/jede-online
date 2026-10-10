import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { adminBan, adminDelete, adminHideOffer, adminHideRating, adminRename, adminResolveReport } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'
import { Field, Submit, inputCls } from '@/components/ui'
import { STATUS } from '@/lib/request-status'
import { COUNTRY_LABEL } from '@/lib/regions'
import { ArrowLeft, ArrowRight, Check, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Badge, panel } from '@/components/design'

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
    <section className={`${panel} p-5`}>
      <h2 className="mb-3 text-xl font-bold text-fg">{title}</h2>
      {children}
    </section>
  )

  return (
    <div className="space-y-5">
      <Link href="/admin/uzivatele" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Uživatelé
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{u.nickname}</h1>
        {u.bannedAt && <Badge tone="red">ZABLOKOVÁN</Badge>}
        {u.isAdmin && <Badge tone="yellow">admin</Badge>}
        <Link href={`/@${encodeURIComponent(u.nickname)}`} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
          veřejný profil
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Box title="Údaje">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">E-mail</dt>
            <dd>
              {u.email}{' '}
              {u.emailVerifiedAt ? (
                <Check className="inline h-4 w-4 align-[-3px] text-positive" strokeWidth={2} aria-label="potvrzen" />
              ) : (
                <span className="text-warning">(nepotvrzen)</span>
              )}
            </dd>
            <dt className="text-muted">Narození</dt>
            <dd>
              {u.birthMonth}/{u.birthYear} {u.isMinor && '· dítě'}
            </dd>
            {u.isMinor && (
              <>
                <dt className="text-muted">Rodič</dt>
                <dd>
                  {u.parentEmail} ·{' '}
                  {u.parentConsentAt
                    ? `souhlas ${u.parentConsentAt.toLocaleDateString('cs-CZ')} (${u.parentConsentName})`
                    : 'čeká na souhlas'}
                </dd>
              </>
            )}
            <dt className="text-muted">Místo</dt>
            <dd>{[u.city, u.region, COUNTRY_LABEL[u.country]].filter(Boolean).join(', ')}</dd>
            <dt className="text-muted">Telefon</dt>
            <dd>
              {u.phone ?? '—'} · zobrazen {u._count.phoneViewsGot}× · sám zobrazil {u._count.phoneViewsMade}×
            </dd>
            <dt className="text-muted">Odkazy</dt>
            <dd className="break-all">
              {[u.facebookUrl, u.instagramUrl, u.aukroUrl].filter(Boolean).join(' · ') || '—'}
              {u.linksApprovedAt ? ' (schváleno)' : ''}
            </dd>
            <dt className="text-muted">Registrace</dt>
            <dd>{u.createdAt.toLocaleString('cs-CZ')}</dd>
            <dt className="text-muted">Aktivní přihlášení</dt>
            <dd>{u._count.sessions}</dd>
            <dt className="text-muted">Hodnocení</dt>
            <dd className="flex items-center gap-3 tabular-nums">
              <span className="inline-flex items-center gap-1 text-positive">
                <ThumbsUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span className="sr-only">kladná</span>
                {pos}
              </span>
              <span className="inline-flex items-center gap-1 text-danger">
                <ThumbsDown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span className="sr-only">záporná</span>
                {shown.length - pos}
              </span>
            </dd>
          </dl>
        </Box>

        <Box title={`Hodnocení (${u.ratingsGot.length})`}>
          {u.ratingsGot.length ? (
            <ul className="space-y-2 text-sm">
              {u.ratingsGot.map((r) => (
                <li key={r.id} className={r.hiddenAt ? 'opacity-50' : ''}>
                  {r.positive ? (
                    <ThumbsUp className="mr-1 inline h-4 w-4 align-[-3px] text-positive" strokeWidth={1.75} aria-label="kladné" />
                  ) : (
                    <ThumbsDown className="mr-1 inline h-4 w-4 align-[-3px] text-danger" strokeWidth={1.75} aria-label="záporné" />
                  )}
                  <strong>{r.from.nickname}</strong>
                  {r.requestId ? (
                    <>
                      {' · '}
                      <Check className="inline h-3.5 w-3.5 align-[-2px] text-positive" strokeWidth={1.75} aria-hidden /> výměna
                    </>
                  ) : (
                    ' · volné'
                  )}
                  {r.comment && <span className="text-muted"> · „{r.comment}“</span>}
                  <ActionForm action={adminHideRating} className="inline">
                    <input type="hidden" name="ratingId" value={r.id} />
                    <input type="hidden" name="hide" value={r.hiddenAt ? '0' : '1'} />
                    <button className="ml-2 text-xs font-semibold text-danger underline underline-offset-4">{r.hiddenAt ? 'zobrazit' : 'skrýt'}</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Žádná.</p>
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
              <p className="text-xs text-muted">
                Zablokovaný se nepřihlásí, jeho profil a nabídky nejsou vidět. Data zůstávají.
              </p>
              <Submit variant={u.bannedAt ? 'ghost' : 'danger'}>{u.bannedAt ? 'Odblokovat' : 'Zablokovat a odhlásit'}</Submit>
            </ActionForm>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-danger underline underline-offset-4">Smazat účet…</summary>
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
                <p className="whitespace-pre-wrap text-muted">{r.reason}</p>
                <ActionForm action={adminResolveReport} className="mt-1">
                  <input type="hidden" name="reportId" value={r.id} />
                  <input type="hidden" name="resolved" value={r.resolvedAt ? '0' : '1'} />
                  <button className="text-xs font-semibold text-accent underline underline-offset-4">{r.resolvedAt ? 'Otevřít znovu' : 'Označit jako vyřízené'}</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Žádná.</p>
        )}
        {u.reportsMade.length > 0 && (
          <p className="mt-4 text-xs text-muted">
            Sám nahlásil: {u.reportsMade.map((r) => r.against.nickname).join(', ')}
          </p>
        )}
      </Box>

      <Box title={`Nabídky (${offers.length + productOffers.length})`}>
        {offers.length + productOffers.length ? (
          <ul className="divide-y divide-line text-sm">
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
                  {o.note && <em className="text-muted"> „{o.note}“</em>}
                </span>
                <ActionForm action={adminHideOffer}>
                  <input type="hidden" name="itemId" value={id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="hide" value={o.hiddenAt ? '0' : '1'} />
                  <button className="text-xs font-semibold text-accent underline underline-offset-4">{o.hiddenAt ? 'Zobrazit' : 'Skrýt'}</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Žádné.</p>
        )}
        <p className="mt-3 text-xs text-muted">
          Sbírka: {u.items.length} řádků karet, {u.productItems.length} produktů · hledá {u._count.wants} karet a{' '}
          {u._count.productWants} produktů
        </p>
      </Box>

      <Box title="Výměny">
        <ul className="space-y-1 text-sm">
          {[
            ...u.sentRequests.map((r) => ({ r, out: true, text: r.to.nickname })),
            ...u.gotRequests.map((r) => ({ r, out: false, text: r.from.nickname })),
          ]
            .sort((a, b) => b.r.createdAt.getTime() - a.r.createdAt.getTime())
            .map(({ r, out, text }) => (
              <li key={r.id} className="flex gap-3">
                <span className="w-40 tabular-nums text-muted">{r.createdAt.toLocaleString('cs-CZ')}</span>
                <span className="inline-flex flex-1 items-center gap-1.5 text-fg">
                  {out ? (
                    <ArrowRight className="h-4 w-4 text-muted" strokeWidth={1.75} aria-label="odeslaná" />
                  ) : (
                    <ArrowLeft className="h-4 w-4 text-muted" strokeWidth={1.75} aria-label="přijatá" />
                  )}
                  {text}
                </span>
                <span className={`rounded-full px-2 text-xs ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              </li>
            ))}
        </ul>
        {!u.sentRequests.length && !u.gotRequests.length && <p className="text-sm text-muted">Žádné.</p>}
      </Box>
    </div>
  )
}
