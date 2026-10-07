import Link from 'next/link'
import { setLogo } from '@/lib/format'

type Props = {
  id: string
  name: string
  code: string | null
  logoUrl: string | null
  officialCount: number
  releaseDate: Date | null
}

export function SetTile({ id, name, code, logoUrl, officialCount, releaseDate }: Props) {
  const logo = setLogo(logoUrl)
  return (
    <Link
      href={`/sady/${encodeURIComponent(id)}`}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-yellow-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid h-16 place-items-center">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" loading="lazy" className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-2xl font-black text-slate-300">{code ?? '★'}</span>
        )}
      </div>
      <div>
        <p className="font-semibold leading-tight group-hover:text-yellow-700 dark:group-hover:text-yellow-400">{name}</p>
        <p className="mt-1 text-xs text-slate-500">
          {[code, `${officialCount} karet`, releaseDate?.getFullYear()].filter(Boolean).join(' · ')}
        </p>
      </div>
    </Link>
  )
}
