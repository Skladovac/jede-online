import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ChevronRight, ExternalLink, EyeOff, Flag, Gavel, Trash2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { auctionInclude, auctionSite } from '@/lib/auctions'
import { deleteAuction, reportAuction, toggleAuctionHidden } from '@/app/actions/auctions'
import { AuctionCountdown } from '@/components/AuctionCountdown'
import { ActionForm } from '@/components/ActionForm'
import { CardImg } from '@/components/CardImg'
import { Submit, inputCls } from '@/components/ui'
import { btnPrimary, btnSecondary, panel } from '@/components/design'
import { cardImage, productImage } from '@/lib/format'
import { getT, getLocale } from '@/lib/i18n/server'
import { LOCALE_INFO } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ id: string }> }

async function load(id: string) {
  return prisma.auction.findUnique({ where: { id }, include: { ...auctionInclude, user: { select: { id: true, nickname: true, bannedAt: true, isMinor: true, parentConsentAt: true } } } })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load((await params).id)
  const t = await getT()
  if (!a || a.hiddenAt) return { title: t('Aukce nenalezena'), robots: { index: false } }
  return { title: `${a.title} · ${t('Aukce')}`, description: t('Aukce od {name} na webu {site}.', { name: a.user.nickname, site: auctionSite(a.url) ?? '' }) }
}

export default async function AuctionPage({ params }: Props) {
  const [a, viewer, t, locale] = await Promise.all([load((await params).id), getCurrentUser(), getT(), getLocale()])
  if (!a) notFound()
  const own = viewer?.id === a.userId
  const sellerVisible = !a.user.bannedAt && (!a.user.isMinor || !!a.user.parentConsentAt)
  // Skrytou aukci (admin) nebo aukci skrytého prodejce vidí jen majitel a admin.
  if ((a.hiddenAt || !sellerVisible) && !own && !viewer?.isAdmin) notFound()
  const ended = a.endsAt.getTime() <= Date.now()
  const site = auctionSite(a.url)
  const endText = a.endsAt.toLocaleString(LOCALE_INFO[locale].intl, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague' })

  return (
    <main className="mx-auto max-w-page px-4 pb-10 pt-6 sm:px-6">
      <nav aria-label={t('Drobečková navigace')} className="flex items-center gap-1.5 text-sm text-subtle">
        <Link href="/aukce" className="text-muted hover:text-fg">
          {t('Aukce')}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate text-fg">{a.title}</span>
      </nav>

      {a.hiddenAt && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-4 py-3 text-sm text-danger">
          <EyeOff className="h-4 w-4" aria-hidden />
          {t('Aukce je skrytá administrátorem — ostatní ji nevidí.')}
        </p>
      )}

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="eyebrow">
            {t('Aukce')} · {site}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold text-fg sm:text-[40px] sm:leading-[1.08]">{a.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {t('Dražitel:')}{' '}
            <Link href={`/@${encodeURIComponent(a.user.nickname)}`} className="font-semibold text-accent hover:underline">
              {a.user.nickname}
            </Link>
          </p>

          <h2 className="mt-8 text-xl font-bold text-fg">{t('Co se draží ({n})', { n: a.items.length })}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {a.items.map((i) => {
              const href = i.card ? `/karta/${encodeURIComponent(i.card.id)}` : `/produkt/${i.product!.id}`
              const img = i.card ? cardImage(i.card.imageUrl) : productImage(i.product!.imageUrl)
              const name = i.card?.name ?? i.product!.name
              return (
                <li key={i.id}>
                  <Link href={href} className="card-tile group block">
                    <div className="card-frame aspect-[63/88]">
                      <CardImg src={img} alt={name} />
                    </div>
                    <p className="mt-3 truncate text-[14.5px] font-semibold text-fg">{name}</p>
                    {i.card && (
                      <p className="truncate text-xs text-muted">
                        {i.card.set.name} ·{' '}
                        <span className="font-mono">
                          {i.card.set.code ? `${i.card.set.code} ` : ''}
                          {i.card.localId}
                          {i.card.set.officialCount ? `/${i.card.set.officialCount}` : ''}
                        </span>
                      </p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
          {a.note && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-fg">{t('Poznámka prodejce')}</h2>
              <p className="mt-2 whitespace-pre-wrap text-muted">{a.note}</p>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className={`${panel} p-6`}>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
                <Gavel className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <p className={`font-display text-xl font-bold ${ended ? 'text-muted' : 'text-fg'}`}>
                  <AuctionCountdown endsAt={a.endsAt.toISOString()} />
                </p>
                <p className="text-sm text-muted">
                  {ended ? t('Skončila {date}', { date: endText }) : t('Konec {date}', { date: endText })}
                </p>
              </div>
            </div>
            {a.startPriceCzk != null && (
              <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
                {t('Vyvolávací cena')}
                <span className="block font-display text-2xl font-bold tabular-nums text-fg">{a.startPriceCzk.toLocaleString('cs-CZ')} Kč</span>
              </p>
            )}
            <a href={a.url} target="_blank" rel="nofollow noopener noreferrer ugc" className={`${ended ? btnSecondary : btnPrimary} mt-5 w-full`}>
              <ExternalLink aria-hidden />
              {ended ? t('Podívat se, jak dopadla ({site})', { site: site ?? '' }) : t('Přihodit na {site}', { site: site ?? '' })}
            </a>
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-subtle">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('Aukce probíhá na jiném webu, za její průběh, platbu ani doručení neručíme. Plať jen ověřeným způsobem a u dětí nechte domluvu na rodičích.')}
            </p>
          </div>

          {own && (
            <form action={deleteAuction} className="mt-4">
              <input type="hidden" name="id" value={a.id} />
              <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline">
                <Trash2 className="h-4 w-4" aria-hidden />
                {t('Smazat aukci')}
              </button>
            </form>
          )}
          {viewer?.isAdmin && (
            <form action={toggleAuctionHidden} className="mt-3">
              <input type="hidden" name="id" value={a.id} />
              <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
                <EyeOff className="h-4 w-4" aria-hidden />
                {a.hiddenAt ? t('Admin: znovu zobrazit') : t('Admin: skrýt aukci')}
              </button>
            </form>
          )}
          {viewer && !own && (
            <details className="mt-4">
              <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-subtle hover:text-fg">
                <Flag className="h-4 w-4" aria-hidden />
                {t('Nahlásit aukci')}
              </summary>
              <ActionForm action={reportAuction} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={a.id} />
                <textarea name="reason" required minLength={10} maxLength={400} rows={3} placeholder={t('Co je s aukcí špatně? (podvod, nevhodný obsah, špatný odkaz…)')} className={`${inputCls} py-3`} />
                <Submit variant="danger">{t('Odeslat nahlášení')}</Submit>
              </ActionForm>
            </details>
          )}
        </aside>
      </div>
    </main>
  )
}
