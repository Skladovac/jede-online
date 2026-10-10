import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { panel, panelInteractive } from '@/components/design'

export default async function AdminHome() {
  // Kontrola i na stránce, ne jen v layoutu (Next může layout při částečném vykreslení přeskočit).
  await requireAdmin()
  const day = 86_400_000
  const since7 = new Date(Date.now() - 7 * day)
  const since30 = new Date(Date.now() - 30 * day)
  const [
    users,
    minors,
    waitingConsent,
    unverified,
    banned,
    reg7,
    reg30,
    cardOffers,
    productOffers,
    wants,
    requestsByStatus,
    openReports,
    newBugs,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isMinor: true } }),
    prisma.user.count({ where: { isMinor: true, parentConsentAt: null } }),
    prisma.user.count({ where: { emailVerifiedAt: null } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.collectionItem.count({ where: { spareQty: { gt: 0 }, offerType: { not: null } } }),
    prisma.productItem.count({ where: { spareQty: { gt: 0 }, offerType: { not: null } } }),
    prisma.wantItem.count(),
    prisma.tradeRequest.groupBy({ by: ['status'], _count: true }),
    prisma.report.count({ where: { resolvedAt: null } }),
    prisma.bugReport.count({ where: { status: 'NEW' } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, nickname: true, createdAt: true, isMinor: true, parentConsentAt: true } }),
  ])
  const req = Object.fromEntries(requestsByStatus.map((r) => [r.status, r._count])) as Record<string, number>

  const Tile = ({ label, value, href, warn }: { label: string; value: number; href?: string; warn?: boolean }) => {
    const body = (
      <div
        className={`${href ? panelInteractive : panel} h-full px-4 py-3.5 ${warn && value > 0 ? '!border-[color-mix(in_srgb,var(--danger)_40%,transparent)] !bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]' : ''}`}
      >
        <p className="eyebrow !text-[10.5px]">{label}</p>
        <p className={`mt-1.5 font-display text-[26px] font-bold leading-tight tabular-nums ${warn && value > 0 ? 'text-danger' : 'text-fg'}`}>{value.toLocaleString('cs-CZ')}</p>
      </div>
    )
    return href ? <Link href={href}>{body}</Link> : body
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">Přehled</h1>
      <section>
        <h2 className="mb-3 text-xl font-bold text-fg">Uživatelé</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Tile label="Celkem" value={users} href="/admin/uzivatele" />
          <Tile label="Dětí" value={minors} href="/admin/uzivatele?filtr=deti" />
          <Tile label="Čeká na rodiče" value={waitingConsent} href="/admin/uzivatele?filtr=souhlas" />
          <Tile label="Nepotvrzený e-mail" value={unverified} href="/admin/uzivatele?filtr=email" />
          <Tile label="Zablokovaní" value={banned} href="/admin/uzivatele?filtr=blok" />
          <Tile label="Nových za 7 dní" value={reg7} />
          <Tile label="Nových za 30 dní" value={reg30} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold text-fg">Aktivita</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Tile label="Nabídky karet" value={cardOffers} />
          <Tile label="Nabídky produktů" value={productOffers} />
          <Tile label="Hledané karty" value={wants} />
          <Tile label="Výměny čekají" value={req.PENDING ?? 0} />
          <Tile label="Výměny přijaté" value={req.ACCEPTED ?? 0} />
          <Tile label="Dokončené výměny" value={req.COMPLETED ?? 0} />
          <Tile label="V košících" value={req.DRAFT ?? 0} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold text-fg">K vyřízení</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Otevřená nahlášení" value={openReports} href="/admin/nahlaseni" warn />
          <Tile label="Nové chyby" value={newBugs} href="/admin/chyby" warn />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold text-fg">Poslední registrace</h2>
        <ul className={`divide-y divide-line overflow-hidden ${panel} text-sm`}>
          {recentUsers.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/uzivatele/${u.id}`} className="flex justify-between gap-3 px-4 py-2 hover:bg-card-hover">
                <span className="font-semibold text-fg">
                  {u.nickname}
                  {u.isMinor && (
                    <span className="ml-2 text-xs text-muted">dítě{u.parentConsentAt ? '' : ' · čeká na rodiče'}</span>
                  )}
                </span>
                <span className="tabular-nums text-muted">{u.createdAt.toLocaleString('cs-CZ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
