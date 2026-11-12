import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/LoginForm'
import { LogoFull } from '@/components/Logo'
import { getCurrentUser } from '@/lib/auth'

export const metadata = { title: 'Přihlášení' }

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/admin')
  return (
    <main className="grain relative grid min-h-screen place-items-center overflow-hidden bg-ink px-4 py-16 text-paper">
      <div className="module-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative w-full max-w-sm">
        <LogoFull className="mx-auto w-40 text-paper" />
        <h1 className="mt-10 text-center font-serif text-3xl">Administrace</h1>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
