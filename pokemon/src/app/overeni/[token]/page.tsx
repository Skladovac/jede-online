import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { consumeEmailToken } from '@/lib/auth'
import { safeNext } from '@/lib/validation'

export const metadata: Metadata = { title: 'Potvrzení e-mailu' }
export const dynamic = 'force-dynamic'

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const userId = await consumeEmailToken((await params).token, 'VERIFY')
  if (userId) await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
  // Přišel z odkazu (např. „ohodnoť mě“) → po potvrzení rovnou zpátky.
  const next = safeNext((await searchParams).next)
  if (userId && next) redirect(next)

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-black tracking-tight">{userId ? 'E-mail potvrzen ✓' : 'Odkaz už neplatí'}</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        {userId
          ? 'Díky! Teď ti můžeme posílat upozornění na nabídky.'
          : 'Možná už byl použitý nebo vypršel. Nový si můžeš poslat ze stránky svého účtu.'}
      </p>
      <Link href="/ucet" className="mt-8 inline-block font-medium underline">
        Na můj účet
      </Link>
    </main>
  )
}
