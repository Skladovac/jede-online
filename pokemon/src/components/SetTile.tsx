import Link from 'next/link'
import { setLogo } from '@/lib/format'
import { CardBack } from '@/components/CardBack'
import { ProgressMeter, panelInteractive } from '@/components/design'
import { getT } from '@/lib/i18n/server'

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
}

export async function SetTile({ id, name, code, logoUrl, officialCount, cardCount, releaseDate, progress }: Props) {
  const t = await getT()
  const logo = setLogo(logoUrl)
  // Promo sady nemají oficiální počet (0) — ukážeme skutečný počet karet.
  const count = officialCount || cardCount
  return (
    <Link href={`/sady/${encodeURIComponent(id)}`} className={`${panelInteractive} group flex h-full flex-col gap-4 p-4`}>
      <div className="grid h-20 place-items-center rounded-lg bg-surface px-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" loading="lazy" width={160} height={64} className="max-h-14 w-auto max-w-full object-contain" />
        ) : (
          <CardBack className="h-14" />
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <p className="font-semibold leading-snug text-fg">{name}</p>
        <p className="mt-1 text-xs tabular-nums text-muted">
          {[code, releaseDate?.getFullYear(), t('{n} karet', { n: count })].filter(Boolean).join(' · ')}
        </p>
        {progress && progress.total > 0 && (
          <div className="mt-auto pt-3">
            <ProgressMeter owned={progress.owned} total={progress.total} />
          </div>
        )}
      </div>
    </Link>
  )
}
