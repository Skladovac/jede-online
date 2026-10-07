import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { findCollectors, parsePlace } from '@/lib/matches'
import { COUNTRY_LABEL, REGIONS } from '@/lib/regions'
import { CollectorList } from '@/components/CollectorList'

export const metadata: Metadata = { title: 'Najdi sběratele', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CollectorsPage({ searchParams }: { searchParams: Promise<{ kde?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/sberatele')
  const { key, place } = parsePlace((await searchParams).kde, user.region)
  const { collectors, total, mine } = await findCollectors(user.id, place)
  const nothingWanted = !mine.wantCards.length && !mine.wantProducts.length

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">Najdi sběratele</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Lidé, kteří mají nejvíc z toho, co ti chybí. Napřed ti, se kterými jde udělat výměnu oběma směry.
      </p>

      <form className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="kde" className="font-medium">
          Kde:
        </label>
        <select
          id="kde"
          name="kde"
          defaultValue={key}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="vse">Celé Česko a Slovensko</option>
          {(['CZ', 'SK'] as const).map((c) => (
            <optgroup key={c} label={COUNTRY_LABEL[c]}>
              <option value={c}>Celé {c === 'CZ' ? 'Česko' : 'Slovensko'}</option>
              {REGIONS[c].map((r) => (
                <option key={r} value={`r:${r}`}>
                  {r}
                  {r === user.region ? ' (můj kraj)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-white dark:bg-yellow-400 dark:text-slate-900">
          Hledat
        </button>
      </form>

      <div className="mt-8">
        {nothingWanted ? (
          <p className="text-slate-500">
            Nejdřív si označ, co ti chybí: otevři{' '}
            <Link href="/sady" className="underline">
              sadu
            </Link>
            , přepni na „Chybí“ a klepni na karty (nebo použij „Vše, co nemám, mi chybí“).
          </p>
        ) : collectors.length ? (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {total} {total === 1 ? 'sběratel' : total >= 2 && total <= 4 ? 'sběratelé' : 'sběratelů'}
              {total > collectors.length && ` (zobrazeno prvních ${collectors.length})`}
            </p>
            <CollectorList collectors={collectors} />
          </>
        ) : (
          <p className="text-slate-500">
            Tady zatím nikdo nemá nic z toho, co ti chybí.{' '}
            {key !== 'vse' && (
              <Link href="/sberatele?kde=vse" className="underline">
                Zkus celé Česko a Slovensko.
              </Link>
            )}
          </p>
        )}
      </div>
    </main>
  )
}
