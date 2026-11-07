'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, Phone, X } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { SITE, telHref, type NavItem } from '@/lib/site'

export function Header({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const active = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b text-paper transition-colors duration-500 ${
          scrolled || open ? 'border-white/10 bg-ink/95 backdrop-blur-md' : 'border-transparent bg-ink'
        }`}
      >
        <a href="#obsah" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">
          Přeskočit na obsah
        </a>
        <div className="wrap flex h-[4.5rem] items-center justify-between gap-6">
          <Link href="/" className="group flex items-center gap-3" aria-label="VRM — Vaši realitní makléři, úvod">
            <LogoMark className="h-[1.35rem] text-paper transition-colors group-hover:text-gold-light" />
            <span className="hidden border-l border-white/20 pl-3 text-[0.68rem] font-semibold uppercase leading-tight tracking-label text-white/60 sm:block">
              Vaši realitní
              <br />
              makléři
            </span>
          </Link>

          <nav aria-label="Hlavní" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`relative py-2 text-[0.93rem] transition-colors hover:text-gold-light ${
                      active(item.href) ? 'text-gold-light' : 'text-paper/80'
                    }`}
                  >
                    {item.label}
                    {active(item.href) && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-gold" />}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <a href={telHref(SITE.phone)} className="hidden items-center gap-2 text-[0.93rem] text-paper/80 transition-colors hover:text-gold-light xl:flex">
              <Phone className="h-4 w-4 text-gold" aria-hidden />
              {SITE.phone}
            </a>
            <Link href="/odhad-nemovitosti-zdarma" className="btn-gold hidden min-h-[2.6rem] px-5 text-[0.88rem] sm:inline-flex">
              Odhad ceny zdarma
            </Link>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="-mr-2 grid h-11 w-11 place-items-center lg:hidden"
              aria-expanded={open}
              aria-controls="mobilni-menu"
              aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobilní menu přes celou obrazovku — mimo <header>: backdrop-blur hlavičky by fixní panel uzavřel do její výšky. */}
      <div
        id="mobilni-menu"
        className={`fixed inset-x-0 bottom-0 top-[4.5rem] z-40 overflow-y-auto bg-ink transition-[opacity,visibility] duration-300 lg:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="module-grid absolute inset-0 opacity-40" aria-hidden />
        <nav aria-label="Mobilní" className="wrap relative flex min-h-full flex-col justify-between py-10">
          <ul className="space-y-1">
            {[{ href: '/', label: 'Úvod' }, ...nav, { href: '/odhad-nemovitosti-zdarma', label: 'Odhad ceny zdarma' }].map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-baseline gap-4 py-2 font-serif text-[2.4rem] leading-tight ${active(item.href) && item.href !== '/' ? 'text-gold-light' : 'text-paper'}`}
                >
                  <span className="font-sans text-xs tabular-nums text-gold">{String(i + 1).padStart(2, '0')}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-10 border-t border-white/10 pt-6 text-paper/80">
            <a href={telHref(SITE.phone)} className="flex items-center gap-3 text-lg">
              <Phone className="h-5 w-5 text-gold" aria-hidden /> {SITE.phone}
            </a>
            <a href={`mailto:${SITE.email}`} className="mt-2 block text-lg">
              {SITE.email}
            </a>
          </div>
        </nav>
      </div>
    </>
  )
}
