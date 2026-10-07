import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'

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
        className={`rounded-2xl border p-4 ${warn && value > 0 ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}
      >
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-black tabular-nums">{value.toLocaleString('cs-CZ')}</p>
      </div>
    )
    return href ? <Link href={href}>{body}</Link> : body
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-black tracking-tight">Přehled</h1>
      <section>
        <h2 className="mb-3 font-bold">Uživatelé</h2>
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
        <h2 className="mb-3 font-bold">Aktivita</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Tile label="Nabídky karet" value={cardOffers} />
          <Tile label="Nabídky produktů" value={productOffers} />
          <Tile label="Hledané karty" value={wants} />
          <Tile label="Poptávky čekají" value={req.PENDING ?? 0} />
          <Tile label="Poptávky přijaté" value={req.ACCEPTED ?? 0} />
          <Tile label="Dokončené výměny" value={req.COMPLETED ?? 0} />
          <Tile label="V košících" value={req.DRAFT ?? 0} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-bold">K vyřízení</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Otevřená nahlášení" value={openReports} href="/admin/nahlaseni" warn />
          <Tile label="Nové chyby" value={newBugs} href="/admin/chyby" warn />
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-bold">Poslední registrace</h2>
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {recentUsers.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/uzivatele/${u.id}`} className="flex justify-between gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="font-medium">
                  {u.nickname}
                  {u.isMinor && (
                    <span className="ml-2 text-xs text-slate-500">dítě{u.parentConsentAt ? '' : ' · čeká na rodiče'}</span>
                  )}
                </span>
                <span className="text-slate-500">{u.createdAt.toLocaleString('cs-CZ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
