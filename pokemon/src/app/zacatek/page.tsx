import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { setLogo } from '@/lib/format'
import { getT } from '@/lib/i18n/server'
import { container } from '@/components/design'
import { StartPicker } from '@/components/StartPicker'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('Jakou sadu sbíráš?'), robots: { index: false } }
}

/**
 * Průvodce po registraci (a pro každého s prázdnou sbírkou): vyber sadu → otevře se rovnou
 * v režimu „Mám“, kde klepáním označíš karty. Cíl: první karta ve sbírce do minuty.
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ vitej?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/prihlaseni?next=/zacatek')
  const { vitej } = await searchParams
  const t = await getT()
  const sets = await prisma.cardSet.findMany({
    where: { game: 'pokemon', language: 'en' },
    orderBy: { releaseDate: { sort: 'desc', nulls: 'last' } },
    select: { id: true, name: true, code: true, logoUrl: true, cardCount: true, officialCount: true, releaseDate: true },
  })
  const list = sets.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    logo: setLogo(s.logoUrl),
    count: s.officialCount || s.cardCount,
    year: s.releaseDate?.getFullYear() ?? null,
    // Podsady (Trainer Gallery, Classic Collection…) se v nabídce nejnovějších nenabízejí, hledat jdou.
    sub: !!s.code?.includes(':'),
  }))

  return (
    <main className={`${container} py-10 sm:py-14`}>
      {vitej && (
        <p className="mb-6 rounded-panel border border-line bg-[color-mix(in_srgb,var(--positive)_10%,transparent)] p-4 text-sm text-fg">
          {t(
            'Účet je založený! Poslali jsme ti e-mail s odkazem pro potvrzení. Když ho nevidíš, podívej se do složky Spam / Nevyžádaná pošta a označ ho jako „není spam“.',
          )}
        </p>
      )}
      <p className="eyebrow">{t('Ahoj, {name}', { name: user.nickname })}</p>
      <h1 className="mt-2 text-3xl font-extrabold text-fg sm:text-[44px] sm:leading-[1.05]">{t('Jakou sadu sbíráš?')}</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-muted">
        {t('Vyber sadu a otevře se seznam jejích karet. Klepnutím označíš, které máš. Za minutu uvidíš, kolik ti chybí a jakou má tvoje sbírka hodnotu.')}
      </p>
      <StartPicker sets={list} />
    </main>
  )
}
