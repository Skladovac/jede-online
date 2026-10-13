import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'
import { createListing } from '@/app/actions/admin'
import { requireUser } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from '@/lib/labels'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Přehled' }

export default async function Dashboard() {
  const user = await requireUser()
  const [active, reserved, sold, drafts, newLeads, leads, missingEnergy] = await Promise.all([
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.listing.count({ where: { status: 'RESERVED' } }),
    prisma.listing.count({ where: { status: 'SOLD' } }),
    prisma.listing.count({ where: { status: 'DRAFT' } }),
    prisma.lead.count({ where: { status: 'NEW' } }),
    prisma.lead.findMany({ where: { status: { not: 'SPAM' } }, orderBy: { createdAt: 'desc' }, take: 6, include: { listing: { select: { title: true } } } }),
    prisma.listing.findMany({ where: { status: { in: ['ACTIVE', 'RESERVED'] }, energyClass: null }, select: { id: true, title: true } }),
  ])
  const stats = [
    { label: 'V nabídce', value: active, href: '/admin/nemovitosti' },
    { label: 'Rezervováno', value: reserved, href: '/admin/nemovitosti' },
    { label: 'Prodáno', value: sold, href: '/admin/nemovitosti' },
    { label: 'Nové poptávky', value: newLeads, href: '/admin/poptavky', hot: newLeads > 0 },
  ]

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label text-gold-deep">Přehled</p>
          <h1 className="mt-2 font-serif text-4xl">Dobrý den, {user.name.split(' ')[0]}</h1>
        </div>
        <form action={createListing}>
          <button type="submit" className="btn-ink">
            <Plus className="h-4 w-4" aria-hidden /> Přidat nemovitost
          </button>
        </form>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`border p-5 transition hover:border-ink/40 ${s.hot ? 'border-gold bg-gold/10' : 'border-ink/10 bg-white'}`}>
            <p className="text-sm text-stone">{s.label}</p>
            <p className="mt-1 font-serif text-4xl tabular-nums">{s.value}</p>
          </Link>
        ))}
      </div>
      {drafts > 0 && <p className="mt-3 text-sm text-stone">Rozpracované koncepty: {drafts}</p>}

      {missingEnergy.length > 0 && (
        <div className="mt-6 border-l-2 border-amber-500 bg-amber-50 px-5 py-4 text-sm">
          <p className="font-semibold text-amber-900">Chybí třída energetické náročnosti (PENB) — v inzerci je povinná:</p>
          <ul className="mt-1 list-disc pl-5 text-amber-900">
            {missingEnergy.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/nemovitosti/${l.id}`} className="underline">
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-2xl">Poslední poptávky</h2>
          <Link href="/admin/poptavky" className="flex items-center gap-1 text-sm font-semibold hover:text-gold-deep">
            Všechny <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {leads.length ? (
          <ul className="mt-4 divide-y divide-ink/10 border border-ink/10 bg-white">
            {leads.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/poptavky?id=${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-paper-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${l.status === 'NEW' ? 'bg-gold text-ink' : 'bg-paper-2 text-stone'}`}>
                    {LEAD_STATUS_LABEL[l.status]}
                  </span>
                  <span className="font-semibold">{l.name}</span>
                  <span className="text-sm text-stone">
                    {LEAD_TYPE_LABEL[l.type]}
                    {l.listing ? ` · ${l.listing.title}` : ''}
                  </span>
                  <span className="ml-auto text-sm tabular-nums text-stone">{formatDateTime(l.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border border-dashed border-ink/20 px-5 py-8 text-center text-stone">Zatím žádné poptávky.</p>
        )}
      </section>
    </div>
  )
}
