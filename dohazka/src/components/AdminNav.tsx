import Link from 'next/link'

// Navigace prostředí super admina. Server komponenta: nic tu neřeší oprávnění, to hlídá každá stránka sama.
export function AdminNav({ current }: { current: 'firmy' | 'nova-firma' }) {
  const odkaz = (aktivni: boolean) =>
    `flex min-h-11 items-center rounded-panel px-3 text-sm ${aktivni ? 'bg-accent-soft font-semibold' : 'text-muted hover:text-fg'}`
  return (
    <nav aria-label="Správa služby" className="mb-5 flex flex-wrap gap-1 border-b border-line pb-2">
      <Link href="/admin" className={odkaz(current === 'firmy')} aria-current={current === 'firmy' ? 'page' : undefined}>
        Firmy
      </Link>
      <Link href="/admin/nova-firma" className={odkaz(current === 'nova-firma')} aria-current={current === 'nova-firma' ? 'page' : undefined}>
        Nová firma
      </Link>
      <Link href="/" className="ml-auto flex min-h-11 items-center px-3 text-sm text-muted hover:text-fg">
        Zpět do aplikace
      </Link>
    </nav>
  )
}
