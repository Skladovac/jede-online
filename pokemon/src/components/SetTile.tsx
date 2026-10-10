import Link from 'next/link'
import { setLogo } from '@/lib/format'
import { CardBack } from '@/components/CardBack'
import { ProgressMeter, panelInteractive } from '@/components/design'
import { getT } from '@/lib/i18n/server'
import { setDisplayName } from '@/lib/format'

type Props = {
  id: string
  name: string
  code: string | null
  logoUrl: string | null
  officialCount: number
  cardCount: number
  releaseDate: Date | null
  /** Postup přihlášeného uživatele (vlastní / celkem), pokud ho stránka zná. */
  progress?: { owned: number; total: number } | null
  /** Štítek podsady se stejným logem jako hlavní sada (např. „Classic Collection“). */
  subLabel?: string
}

export async function SetTile({ id, name, code, logoUrl, officialCount, cardCount, releaseDate, progress, subLabel }: Props) {
  const t = await getT()
  const logo = setLogo(logoUrl)
  // Promo sady nemají oficiální počet (0) — ukážeme skutečný počet karet.
  const count = officialCount || cardCount
  return (
    <Link href={`/sady/${encodeURIComponent(id)}`} className={`${panelInteractive} group flex h-full flex-col gap-4 p-5 hover:shadow-[0_2px_4px_rgba(14,27,46,0.05),0_8px_24px_-6px_rgba(14,27,46,0.12)]`}>
      <div className="relative grid h-[72px] place-items-center px-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" loading="lazy" width={160} height={64} className="max-h-16 w-auto max-w-[85%] object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <CardBack className="h-14" />
        )}
        {subLabel && (
          <span className="absolute -bottom-1 right-0 max-w-[85%] truncate rounded-md bg-brand-yellow px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink)] shadow-sm">
            {subLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <p className="font-bold leading-snug text-fg">{setDisplayName({ id, name })}</p>
        <p className="mt-1 font-mono text-[11.5px] text-subtle">
          {[code, releaseDate?.getFullYear(), t('{n} karet', { n: count })].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-auto pt-3">
          {progress && progress.total > 0 && <ProgressMeter owned={progress.owned} total={progress.total} />}
        </div>
      </div>
    </Link>
  )
}
