import Link from 'next/link'
import type { LeadStatus, Prisma } from '@prisma/client'
import { LeadItem } from '@/components/admin/LeadItem'
import { LEAD_STATUS_LABEL } from '@/lib/labels'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Poptávky' }

const FILTERS: { key: string; label: string; where: Prisma.LeadWhereInput }[] = [
  { key: '', label: 'Otevřené', where: { status: { in: ['NEW', 'IN_PROGRESS'] } } },
  { key: 'vyrizene', label: 'Vyřízené', where: { status: 'DONE' } },
  { key: 'spam', label: 'Spam', where: { status: 'SPAM' } },
  { key: 'vse', label: 'Vše', where: {} },
]

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ f?: string; id?: string }> }) {
  const { f = '', id } = await searchParams
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]
  // Odkaz z e-mailu (?id=…) musí poptávku ukázat i když je v jiném filtru.
  const where: Prisma.LeadWhereInput = id ? { OR: [filter.where, { id }] } : filter.where
  const [leads, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { listing: { select: { title: true, slug: true, locality: true } } },
    }),
    prisma.lead.groupBy({ by: ['status'], _count: true }),
  ])
  const count = (s: LeadStatus[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0)
  const badge: Record<string, number> = {
    '': count(['NEW', 'IN_PROGRESS']),
    vyrizene: count(['DONE']),
    spam: count(['SPAM']),
    vse: count(['NEW', 'IN_PROGRESS', 'DONE', 'SPAM']),
  }

  return (
    <div>
      <p className="label text-gold-deep">Poptávky</p>
      <h1 className="mt-2 font-serif text-4xl">Poptávky z webu</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone">
        Odhady ceny, zájem o prohlídky a dotazy. Nové chodí i e-mailem. Stav „{LEAD_STATUS_LABEL.NEW}“ zmizí, jakmile poptávku převezmete.
      </p>

      <nav aria-label="Filtr" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key ? `/admin/poptavky?f=${x.key}` : '/admin/poptavky'}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${x === filter ? 'border-ink bg-ink text-paper' : 'border-ink/15 bg-white hover:border-ink/40'}`}
          >
            {x.label} <span className="opacity-60">{badge[x.key]}</span>
          </Link>
        ))}
      </nav>

      <ul className="mt-6 space-y-3">
        {leads.map((l) => (
          <LeadItem
            key={l.id}
            open={l.id === id}
            lead={{
              id: l.id,
              type: l.type,
              status: l.status,
              name: l.name,
              email: l.email,
              phone: l.phone,
              message: l.message,
              note: l.note,
              data: (l.data ?? {}) as Record<string, string>,
              createdAt: l.createdAt.toISOString(),
              listing: l.listing,
            }}
          />
        ))}
      </ul>
      {!leads.length && <p className="mt-6 border border-dashed border-ink/20 px-5 py-10 text-center text-stone">Tady zatím nic není.</p>}
    </div>
  )
}
