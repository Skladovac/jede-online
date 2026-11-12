import Link from 'next/link'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Reference' }

export default async function ReferencesAdmin() {
  const items = await prisma.testimonial.findMany({
    orderBy: [{ published: 'desc' }, { sort: 'asc' }, { createdAt: 'desc' }],
    include: { agent: { select: { name: true } } },
  })
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="label text-gold-deep">Reference</p>
          <h1 className="mt-2 font-serif text-4xl">Co říkají klienti</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone">
            Na webu se ukážou jen zveřejněné reference se souhlasem klienta — na úvodu, na stránce Reference a na osobní stránce makléře.
          </p>
        </div>
        <Link href="/admin/reference/nova" className="btn-ink">
          <Plus className="h-4 w-4" aria-hidden /> Přidat referenci
        </Link>
      </div>
      <ul className="mt-8 space-y-3">
        {items.map((t) => (
          <li key={t.id}>
            <Link href={`/admin/reference/${t.id}`} className="block border border-ink/10 bg-white p-5 transition hover:border-ink/40">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className={`rounded-full px-2.5 py-0.5 ${t.published && t.consent ? 'bg-emerald-100 text-emerald-900' : 'bg-paper-2 text-stone'}`}>
                  {t.published && t.consent ? 'Na webu' : 'Skrytá'}
                </span>
                {!t.consent && <span className="text-amber-700">bez souhlasu klienta</span>}
              </div>
              <p className="mt-2 line-clamp-2 font-serif text-xl">„{t.quote}“</p>
              <p className="mt-1 text-sm text-stone">
                {t.clientName}
                {t.clientPlace ? `, ${t.clientPlace}` : ''}
                {t.agent ? ` · ${t.agent.name}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!items.length && (
        <p className="mt-8 border border-dashed border-ink/20 px-5 py-10 text-center text-stone">
          Zatím žádné reference. Po každém prodeji poproste klienta o pár vět a souhlas se zveřejněním.
        </p>
      )}
    </div>
  )
}
