'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useT } from '@/lib/i18n/client'
import { panelInteractive } from '@/components/design'

type S = { id: string; name: string; code: string | null; logo: string | null; count: number; year: number | null; sub: boolean }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Výběr sady pro nováčka: 8 nejnovějších + hledání ve všech. Odkaz vede rovnou do režimu „Mám“. */
export function StartPicker({ sets }: { sets: S[] }) {
  const t = useT()
  const router = useRouter()
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const k = norm(q.trim())
    if (!k) return sets.filter((s) => !s.sub).slice(0, 8)
    return sets.filter((s) => norm(s.name).includes(k) || (s.code && norm(s.code).includes(k))).slice(0, 24)
  }, [q, sets])

  const later = () => {
    // Odložit na den — hlavní stránka pak průvodce nenabízí, dokud sbírka zůstane prázdná.
    document.cookie = 'zacatek=odlozeno; path=/; max-age=86400; samesite=lax'
    router.push('/')
  }

  return (
    <div className="mt-8">
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Hledat sadu (např. 151, Prismatic, Delta Reign)')}
          className="min-h-12 w-full rounded-xl border border-line-strong bg-card pl-11 pr-4 text-[15px] outline-none focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)]"
        />
      </label>
      <p className="mt-6 text-sm font-semibold text-muted">{q.trim() ? t('Nalezené sady') : t('Nejnovější sady')}</p>
      {shown.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {shown.map((s) => (
            <li key={s.id}>
              <Link href={`/sady/${encodeURIComponent(s.id)}?rezim=mam&start=1`} className={`${panelInteractive} group flex h-full flex-col gap-3 p-4`}>
                <div className="grid h-16 place-items-center">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="" loading="lazy" width={150} height={60} className="max-h-14 w-auto max-w-[85%] object-contain transition-transform duration-300 group-hover:scale-[1.04]" />
                  ) : (
                    <span className="grid h-12 w-9 place-items-center rounded-md bg-[var(--ink)] font-mono text-[10px] font-semibold text-brand-yellow">{s.code?.split(':')[0] ?? '?'}</span>
                  )}
                </div>
                <div>
                  <p className="truncate text-[15px] font-semibold text-fg">{s.name}</p>
                  <p className="font-mono text-xs text-subtle">
                    {[s.code?.split(':')[0], s.year, t('{n} karet', { n: s.count })].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">{t('Nic nenalezeno.')}</p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/sady" className="font-semibold text-accent hover:underline">
          {t('Všechny sady')}
        </Link>
        <button type="button" onClick={later} className="text-muted underline-offset-4 hover:underline">
          {t('Ještě nevím, podívám se nejdřív kolem')}
        </button>
      </div>
    </div>
  )
}
