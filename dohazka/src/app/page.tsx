import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto max-w-page px-4 py-16">
      <h1 className="text-3xl font-semibold">Docházka</h1>
      <p className="mt-3 max-w-prose text-muted">
        Zapisujte si odpracované hodiny a místo práce. Na konci měsíce z nich vyexportujete výkaz pro zaměstnavatele.
      </p>
      <Link
        href="/prihlaseni"
        className="mt-6 inline-block rounded-panel bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-hover"
      >
        Přihlásit se
      </Link>
    </main>
  )
}
