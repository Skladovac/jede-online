'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bot, Camera, KeyRound, Link2, Smartphone, X, type LucideIcon } from 'lucide-react'
import { btnPrimary, btnSecondary } from '@/components/design'
import { useT } from '@/lib/i18n/client'

const SEEN_KEY = 'ai-promo-seen'

/**
 * Jednorázové okno pro přihlášené: karty jde přidávat fotkou přes vlastní AI (ChatGPT / Claude) napojenou na účet.
 * Neukazuje se tomu, kdo už klíč má. Po zavření se neukáže znovu (uloženo v prohlížeči); návod zůstává v Můj účet.
 */
export function AiPromo() {
  const t = useT()
  const [open, setOpen] = useState(false)

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

  const steps: { icon: LucideIcon; text: string }[] = [
    { icon: KeyRound, text: t('V Můj účet → Napojení na AI si vytvoř klíč a zkopíruj adresu.') },
    { icon: Link2, text: t('Na chatgpt.com (v prohlížeči) přidej vlastní server MCP a vlož adresu. U Claude: Konektory → Přidat.') },
    { icon: Smartphone, text: t('V mobilní aplikaci ChatGPT v chatu zapni nástroj „Pokémon sbírka“.') },
    { icon: Camera, text: t('Vyfoť kartu a napiš „přidej do sbírky“. AI ji pozná, zeptá se na variantu a uloží ji k nám.') },
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,27,46,0.55)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="aip-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-[22px] bg-card shadow-[0_30px_80px_-20px_rgba(14,27,46,0.6)] ring-1 ring-line">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,203,5,0.35),transparent_70%)]" />
        <button type="button" onClick={close} aria-label={t('Zavřít')} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-fg">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="relative p-7 sm:p-8">
          <p className="eyebrow">{t('Novinka')}</p>
          <span className="mt-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
            <Bot className="h-7 w-7" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 id="aip-title" className="mt-5 text-2xl font-bold text-fg">
            {t('Přidávej karty fotkou přes svou AI')}
          </h2>
          <p className="mt-2 leading-relaxed text-muted">{t('Napoj ChatGPT nebo Claude na svůj účet. Fotky pak rozpoznává tvoje AI bez našeho denního limitu — a karty se rovnou ukládají do tvé sbírky.')}</p>
          <ol className="mt-5 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-fg">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface text-accent ring-1 ring-inset ring-line">
                  <s.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="leading-snug">{s.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-subtle">{t('Potřebuješ ChatGPT Plus (nebo Claude). Nastavení trvá dvě minuty a návod najdeš kdykoli v Můj účet.')}</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className={btnSecondary}>
              {t('Teď ne')}
            </button>
            <Link href="/ucet#ai" onClick={close} className={btnPrimary}>
              <KeyRound aria-hidden />
              {t('Vytvořit klíč')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
