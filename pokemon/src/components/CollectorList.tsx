import Link from 'next/link'
import type { Collector } from '@/lib/matches'
import { cardImage } from '@/lib/format'
import { COUNTRY_LABEL } from '@/lib/regions'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'

/** Žebříček sběratelů podle shod (stránka /sberatele a blok na hlavní stránce). */
export async function CollectorList({ collectors }: { collectors: Collector[] }) {
  const t = await getT()
  return (
    <ul className="space-y-3">
      {collectors.map((c) => (
        <li key={c.user.id}>
          <Link
            href={`/u/${encodeURIComponent(c.user.nickname)}#shoda`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-yellow-400 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yellow-400 font-black text-slate-900">
                {c.user.nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="font-bold">{c.user.nickname}</span>
              <BadgeIcon nickname={c.user.nickname} />
              {c.trade && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-300">
                  🔁 {t('Výměna možná')}
                </span>
              )}
              <span className="text-xs text-slate-500">
                {[c.user.city, c.user.region, t(COUNTRY_LABEL[c.user.country])].filter(Boolean).join(', ')}
                {c.rating.pos + c.rating.neg > 0 && ` · 👍 ${c.rating.pos} · 👎 ${c.rating.neg}`}
              </span>
            </div>
            <p className="mt-2 text-sm">
              {c.offered > 0 && (
                <span className="font-semibold text-blue-700 dark:text-blue-400">{t('nabízí {n} z toho, co ti chybí', { n: c.offered })}</span>
              )}
              {c.offered > 0 && c.owned > 0 && ' · '}
              {c.owned > 0 && <span className="text-slate-600 dark:text-slate-300">{t('{n} má ve sbírce (můžeš se zeptat)', { n: c.owned })}</span>}
              {c.theyWant > 0 && (
                <span className="text-slate-600 dark:text-slate-300"> · {t('shání {n} z tvých nabídek', { n: c.theyWant })}</span>
              )}
            </p>
            {c.preview.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-hidden">
                {c.preview.map((p) => {
                  const img = cardImage(p.imageUrl)
                  return (
                    <div
                      key={p.id}
                      title={p.name}
                      className={`aspect-[63/88] w-12 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-slate-800 ${p.offered ? 'ring-2 ring-blue-500' : 'opacity-70'}`}
                    >
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
