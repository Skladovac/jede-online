import Link from 'next/link'
import type { Collector } from '@/lib/matches'
import { cardImage } from '@/lib/format'
import { COUNTRY_LABEL } from '@/lib/regions'
import { getT } from '@/lib/i18n/server'
import { BadgeIcon } from '@/components/Badges'
import { CardImg } from '@/components/CardImg'
import { Badge, panelInteractive } from '@/components/design'
import { Eye, Repeat, ThumbsDown, ThumbsUp } from 'lucide-react'

/** Žebříček sběratelů podle shod (stránka /sberatele a blok na hlavní stránce). */
export async function CollectorList({ collectors }: { collectors: Collector[] }) {
  const t = await getT()
  return (
    <ul className="space-y-3">
      {collectors.map((c) => (
        <li key={c.user.id}>
          <Link
            href={`/@${encodeURIComponent(c.user.nickname)}#shoda`}
            className={`${panelInteractive} block p-4`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] font-extrabold text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
                {c.user.nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="font-bold text-fg">{c.user.nickname}</span>
              <BadgeIcon nickname={c.user.nickname} />
              {c.followed && (
                <Badge tone="yellow">
                  <Eye aria-hidden />
                  {t('Sleduješ')}
                </Badge>
              )}
              {c.trade && (
                <Badge tone="positive">
                  <Repeat aria-hidden />
                  {t('Výměna možná')}
                </Badge>
              )}
              <span className="inline-flex flex-wrap items-center gap-x-1 text-xs tabular-nums text-subtle">
                {[c.user.city, c.user.region, t(COUNTRY_LABEL[c.user.country])].filter(Boolean).join(', ')}
                {c.rating.pos + c.rating.neg > 0 && (
                  <>
                    {' · '}
                    <ThumbsUp className="h-3.5 w-3.5 text-positive" strokeWidth={1.75} role="img" aria-label={t('Kladná')} /> {c.rating.pos} ·{' '}
                    <ThumbsDown className="h-3.5 w-3.5 text-danger" strokeWidth={1.75} role="img" aria-label={t('Záporná')} /> {c.rating.neg}
                  </>
                )}
              </span>
            </div>
            <p className="mt-2 text-sm">
              {c.offered > 0 && (
                <span className="font-semibold text-accent">{t('nabízí {n} z toho, co ti chybí', { n: c.offered })}</span>
              )}
              {c.offered > 0 && c.owned > 0 && ' · '}
              {c.owned > 0 && <span className="text-muted">{t('{n} má ve sbírce (můžeš se zeptat)', { n: c.owned })}</span>}
              {c.theyWant > 0 && (
                <span className="text-muted"> · {t('shání {n} z tvých nabídek', { n: c.theyWant })}</span>
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
                      className={`card-frame aspect-[63/88] w-12 shrink-0 ${p.offered ? 'ring-2 ring-accent' : 'opacity-70'}`}
                    >
                      {img && (
                        <CardImg src={img} alt={p.name} />
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
