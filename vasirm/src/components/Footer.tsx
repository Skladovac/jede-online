import Link from 'next/link'
import { LogoFull } from '@/components/Logo'
import { SITE, telHref, type NavItem } from '@/lib/site'
import type { User } from '@prisma/client'

export function Footer({ agents, nav }: { agents: Pick<User, 'id' | 'name' | 'slug' | 'role' | 'phone' | 'publicEmail'>[]; nav: NavItem[] }) {
  const year = new Date().getFullYear()
  return (
    <footer className="relative overflow-hidden bg-ink text-paper/75">
      <div className="module-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div className="wrap relative grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          <LogoFull className="w-44 text-paper" />
          <p className="mt-6 max-w-xs font-serif text-2xl leading-snug text-paper">{SITE.claim}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">Realitní služby pro {SITE.region}. Prodej, koupě a tržní odhad ceny zdarma.</p>
        </div>

        <div className="md:col-span-5">
          <p className="label text-gold">Kontakt</p>
          <ul className="mt-5 grid gap-6 sm:grid-cols-2">
            {agents.map((a) => (
              <li key={a.id}>
                <Link href={`/makleri/${a.slug}`} className="font-semibold text-paper hover:text-gold-light">
                  {a.name}
                </Link>
                <p className="text-sm text-paper/55">{a.role}</p>
                {a.phone && (
                  <a href={telHref(a.phone)} className="mt-2 block hover:text-gold-light">
                    {a.phone}
                  </a>
                )}
                {a.publicEmail && (
                  <a href={`mailto:${a.publicEmail}`} className="block hover:text-gold-light">
                    {a.publicEmail}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Patička" className="md:col-span-3">
          <p className="label text-gold">Web</p>
          <ul className="mt-5 space-y-2">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-gold-light">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/odhad-nemovitosti-zdarma" className="hover:text-gold-light">
                Odhad ceny zdarma
              </Link>
            </li>
            <li>
              <Link href="/co-dela-makler" className="hover:text-gold-light">
                Co dělá makléř
              </Link>
            </li>
            <li>
              <Link href="/ochrana-osobnich-udaju" className="hover:text-gold-light">
                Ochrana osobních údajů
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="relative border-t border-white/10">
        <div className="wrap flex flex-col gap-3 py-6 text-[0.8rem] text-paper/50 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {SITE.operator.name}
            {SITE.operator.ico ? ` · IČO ${SITE.operator.ico}` : ''}
            {SITE.operator.address ? ` · ${SITE.operator.address}` : ''}
          </p>
          <p>
            Designed by{' '}
            <a href="https://jede.online" className="font-semibold text-[#ca9e5a] transition-colors hover:text-[#ffd700]">
              jede.online
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
