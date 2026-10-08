import Link from 'next/link'
import { topRated } from '@/lib/market'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('Nejlépe hodnocení sběratelé') }
}
export const dynamic = 'force-dynamic'

export default async function TopRatedPage() {
  const t = await getT()
  const rows = await topRated(50)
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight">{t('Nejlépe hodnocení sběratelé')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {t('Řazeno podle počtu kladných hodnocení. ✓ = hodnocení z výměn přes web (ověřené).')}
      </p>
      {rows.length ? (
        <ol className="mt-6 space-y-2">
          {rows.map((r, i) => (
            <li key={r.user.id}>
              <Link
                href={`/u/${encodeURIComponent(r.user.nickname)}/hodnoceni`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-yellow-400 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className={`w-8 text-center text-lg font-black ${i < 3 ? 'text-yellow-500' : 'text-slate-400'}`}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.user.nickname}</span>
                  <span className="text-xs text-slate-500">{r.user.city ?? r.user.region ?? t('neuvedeno')}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="font-semibold text-green-700 dark:text-green-400">👍 {r.pos}</span>
                  {r.neg > 0 && <span className="ml-2 text-red-600">👎 {r.neg}</span>}
                  <span className="block text-xs text-slate-500">
                    {r.percent} % · ✓ {r.verified}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-8 text-slate-500">{t('Zatím tu nikdo není. Hodnocení přibudou po prvních výměnách.')}</p>
      )}
    </main>
  )
}
