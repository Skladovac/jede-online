import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isLimited } from '@/lib/auth'
import { COUNTRY_LABEL } from '@/lib/regions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ nickname: string }> }

async function getProfile(nickname: string) {
  const user = await prisma.user.findFirst({
    where: { nickname: { equals: decodeURIComponent(nickname), mode: 'insensitive' }, bannedAt: null },
  })
  // Omezený účet (dítě bez souhlasu rodiče) navenek neexistuje.
  return user && !isLimited(user) ? user : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getProfile((await params).nickname)
  if (!user) return { title: 'Profil nenalezen' }
  return { title: user.nickname, robots: user.indexable ? undefined : { index: false, follow: false } }
}

export default async function ProfilePage({ params }: Props) {
  const user = await getProfile((await params).nickname)
  if (!user) notFound()

  const links = user.linksApprovedAt
    ? ([
        ['Facebook', user.facebookUrl],
        ['Instagram', user.instagramUrl],
        ['Aukro', user.aukroUrl],
      ].filter(([, v]) => v) as [string, string][])
    : []

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-yellow-400 text-2xl font-black text-slate-900">
          {user.nickname.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="text-3xl font-black tracking-tight">{user.nickname}</h1>
          <p className="text-sm text-slate-500">
            {[user.city, user.region, COUNTRY_LABEL[user.country]].filter(Boolean).join(', ')} · členem od{' '}
            {user.createdAt.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {links.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {links.map(([k, v]) => (
            <a
              key={k}
              href={v}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:border-yellow-400 dark:border-slate-700"
            >
              {k} ↗
            </a>
          ))}
        </div>
      )}

      <p className="mt-10 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
        Sbírka, nabídky a hodnocení se tu objeví v další verzi.
      </p>
    </main>
  )
}
