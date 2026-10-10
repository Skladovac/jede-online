import Link from 'next/link'
import { topRated } from '@/lib/market'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'
import { EmptyState, panelInteractive } from '@/components/design'
import { Check, Medal, ThumbsDown, ThumbsUp } from 'lucide-react'

const MEDAL = ['text-[#c9a227]', 'text-[#9aa4b2]', 'text-[#b0713b]']

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
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">{t('Nejlépe hodnocení sběratelé')}</h1>
      <p className="mt-2 text-muted">
        {t('Řazeno podle počtu kladných hodnocení.')}{' '}
        <span className="inline-flex items-center gap-1">
          <Check className="h-4 w-4 text-positive" strokeWidth={2.4} aria-hidden />
          {t('= hodnocení z výměn přes web (ověřené).')}
        </span>
      </p>
      {rows.length ? (
        <ol className="mt-6 space-y-2">
          {rows.map((r, i) => (
            <li key={r.user.id}>
              <Link
                href={`/@${encodeURIComponent(r.user.nickname)}/hodnoceni`}
                className={`${panelInteractive} flex items-center gap-4 px-4 py-3`}
              >
                <span className="grid w-8 place-items-center font-mono text-sm font-semibold tabular-nums text-subtle">
                  {i < 3 ? <Medal className={`h-6 w-6 ${MEDAL[i]}`} strokeWidth={1.75} role="img" aria-label={String(i + 1)} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-fg">
                    <span className="truncate">{r.user.nickname}</span>
                    <BadgeIcon nickname={r.user.nickname} />
                  </span>
                  <span className="text-xs text-subtle">{r.user.city ?? r.user.region ?? t('neuvedeno')}</span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold text-positive">
                    <ThumbsUp className="h-4 w-4" strokeWidth={1.75} role="img" aria-label={t('Kladná')} /> {r.pos}
                  </span>
                  {r.neg > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-danger">
                      <ThumbsDown className="h-4 w-4" strokeWidth={1.75} role="img" aria-label={t('Záporná')} /> {r.neg}
                    </span>
                  )}
                  <span className="flex items-center justify-end gap-1 text-xs text-subtle">
                    {r.percent} % · <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2.6} aria-hidden /> {r.verified}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState className="mt-8">{t('Zatím tu nikdo není. Hodnocení přibudou po prvních výměnách.')}</EmptyState>
      )}
    </main>
  )
}
