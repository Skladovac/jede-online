import Link from 'next/link'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site'

export const metadata = { title: 'Realman' }

export default async function RealmanPage() {
  const [logs, problems, counts] = await Promise.all([
    prisma.realmanLog.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
    prisma.listing.findMany({
      where: { source: 'REALMAN', syncState: { not: 'ok' } },
      select: { id: true, title: true, syncState: true, syncError: true },
    }),
    prisma.listing.groupBy({ by: ['source'], _count: true }),
  ])
  const fromRealman = counts.find((c) => c.source === 'REALMAN')?._count ?? 0
  const manual = counts.find((c) => c.source === 'MANUAL')?._count ?? 0
  const keySet = (process.env.REALMAN_API_KEY ?? '').length >= 32

  return (
    <div>
      <p className="label text-gold-deep">Realman</p>
      <h1 className="mt-2 font-serif text-4xl">Export z Realmanu</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone">
        Zakázky se zadávají v Realmanu a tlačítkem „Exportovat na web“ se během chvíle objeví tady i na webu. Ručně zadané nemovitosti
        zůstávají jako záloha.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="border border-ink/10 bg-white p-5">
          <p className="text-sm text-stone">Z Realmanu</p>
          <p className="mt-1 font-serif text-4xl">{fromRealman}</p>
        </div>
        <div className="border border-ink/10 bg-white p-5">
          <p className="text-sm text-stone">Zadané ručně</p>
          <p className="mt-1 font-serif text-4xl">{manual}</p>
        </div>
        <div className={`border p-5 ${keySet ? 'border-ink/10 bg-white' : 'border-amber-500 bg-amber-50'}`}>
          <p className="text-sm text-stone">Napojení</p>
          <p className="mt-2 flex items-center gap-2 font-semibold">
            {keySet ? <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden /> : <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden />}
            {keySet ? 'Klíč nastaven' : 'Chybí klíč (REALMAN_API_KEY)'}
          </p>
        </div>
      </div>

      <section className="mt-6 border border-ink/10 bg-white p-5 text-sm sm:p-7">
        <h2 className="font-serif text-2xl">Nastavení v Realmanu</h2>
        <p className="mt-2 text-stone">Tyto údaje zadá podpora Realmanu do „můstku“ v licenci:</p>
        <dl className="mt-3 grid gap-2">
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-stone">Adresa (URL)</dt>
            <dd className="break-all font-mono">{SITE_URL}/import/estate/</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-stone">apikey</dt>
            <dd>vlastní klíč webu (je uložený jen na serveru, správce ho předá podpoře Realmanu)</dd>
          </div>
        </dl>
      </section>

      {problems.length > 0 && (
        <section className="mt-6 border-l-2 border-amber-500 bg-amber-50 p-5 text-sm">
          <h2 className="font-semibold text-amber-900">Nemovitosti s nedokončenými fotkami</h2>
          <ul className="mt-2 space-y-1 text-amber-900">
            {problems.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/nemovitosti/${p.id}`} className="underline">
                  {p.title}
                </Link>{' '}
                — {p.syncState === 'pending' ? 'stahuje se' : p.syncError || 'chyba'}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-amber-900/80">Když odkazy z Realmanu vyprší, pomůže zakázku v Realmanu znovu exportovat na web.</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-serif text-2xl">Poslední exporty</h2>
        {logs.length ? (
          <ul className="mt-4 divide-y divide-ink/10 border border-ink/10 bg-white text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                {l.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-label="v pořádku" /> : <XCircle className="h-4 w-4 text-red-600" aria-label="chyba" />}
                <span className="w-14 font-mono text-xs text-stone">{l.method}</span>
                <span className="font-mono text-xs text-stone">#{l.externalId}</span>
                {l.listingId ? (
                  <Link href={`/admin/nemovitosti/${l.listingId}`} className="font-medium hover:text-gold-deep">
                    {l.message}
                  </Link>
                ) : (
                  <span className={l.ok ? '' : 'text-red-700'}>{l.message}</span>
                )}
                <span className="ml-auto tabular-nums text-stone">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border border-dashed border-ink/20 px-5 py-8 text-center text-stone">Z Realmanu zatím nic nepřišlo.</p>
        )}
      </section>
    </div>
  )
}
