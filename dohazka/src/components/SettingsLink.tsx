import Link from 'next/link'

// Nenápadný odkaz do nastavení (notifikace, odhlášení) nad navigací dne a měsíce; na přihlášení se nepoužívá.
export function SettingsLink() {
  return (
    <div className="mb-2 flex justify-end">
      <Link href="/nastaveni" className="flex min-h-11 items-center px-1 text-sm text-muted hover:text-fg">
        Nastavení
      </Link>
    </div>
  )
}
