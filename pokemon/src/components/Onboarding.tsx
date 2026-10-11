'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Layers, Store, X, type LucideIcon } from 'lucide-react'
import { btnPrimary, btnSecondary } from '@/components/design'
import { useT } from '@/lib/i18n/client'

const SEEN_KEY = 'onboarding-seen'

type Step = { icon: LucideIcon; title: string; text: string; href: string; cta: string }

/**
 * Průvodce pro nováčky: jednou po registraci krátké okno ve 3 krocích (vysvětlení + odkaz, kde to udělat).
 * Po zavření / dokončení se už neukáže (uloženo v prohlížeči).
 */
export function Onboarding({ nickname }: { nickname: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    let seen = false
    try {
      seen = !!localStorage.getItem(SEEN_KEY)
    } catch {
      /* soukromé okno */
    }
    if (!seen) setOpen(true)
  }, [])

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {
      /* nevadí */
    }
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const steps: Step[] = [
    {
      icon: Camera,
      title: t('Přidej svoje karty'),
      text: t('Kartu vyfoť nebo napiš číslo z levého dolního rohu (třeba SVI 045). Web ji pozná, ukáže cenu a přidá do alba.'),
      href: '/sbirka',
      cta: t('Do sbírky'),
    },
    {
      icon: Layers,
      title: t('Označ, co ti chybí'),
      text: t('Otevři sadu, kterou sbíráš, a odklikej karty, které ti chybí. Uvidíš, kolik zbývá do kompletu, a ostatní poznají, co sháníš.'),
      href: '/sady',
      cta: t('Vybrat sadu'),
    },
    {
      icon: Store,
      title: t('Najdi sběratele a vyměňuj'),
      text: t('Na tržišti najdeš karty na prodej a výměnu i aukce. Web ti sám ukáže, kdo má karty, které ti chybí.'),
      href: '/trziste',
      cta: t('Na tržiště'),
    },
  ]
  const s = steps[i]
  const last = i === steps.length - 1

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,27,46,0.55)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-[22px] bg-card shadow-[0_30px_80px_-20px_rgba(14,27,46,0.6)] ring-1 ring-line">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,203,5,0.35),transparent_70%)]" />
        <button type="button" onClick={close} aria-label={t('Přeskočit průvodce')} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="relative p-7 sm:p-8">
          <p className="eyebrow">{t('Vítej, {name}!', { name: nickname })} · {i + 1} / {steps.length}</p>
          <span className="mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
            <s.icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 id="onb-title" className="mt-5 text-2xl font-bold text-fg">
            {s.title}
          </h2>
          <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
          <Link href={s.href} onClick={close} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            {s.cta}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>

          <div className="mt-7 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {steps.map((_, n) => (
                <span key={n} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-brand-yellow' : 'w-2 bg-line-strong'}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {i > 0 && (
                <button type="button" onClick={() => setI(i - 1)} className={`${btnSecondary} px-4`}>
                  <ArrowLeft aria-hidden />
                  <span className="sr-only">{t('Zpět')}</span>
                </button>
              )}
              <button type="button" onClick={() => (last ? close() : setI(i + 1))} className={btnPrimary}>
                {last ? t('Začít') : t('Další')}
                {!last && <ArrowRight aria-hidden />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
