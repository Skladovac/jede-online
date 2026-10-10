'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Tlačítko / návod „Přidat na plochu“. Android (Chrome) nabídne instalaci, iPhone dostane návod. */
export function InstallApp() {
  const t = useT()
  const [prompt, setPrompt] = useState<PromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    setInstalled(window.matchMedia('(display-mode: standalone)').matches)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as PromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (installed) return null

  async function click() {
    if (prompt) {
      await prompt.prompt()
      setPrompt(null)
    } else setHelp((h) => !h)
  }

  return (
    <span className="inline">
      <button type="button" onClick={click} className="underline">
        📱 {t('Aplikace do mobilu')}
      </button>
      {help && (
        <span className="mt-2 block rounded-xl border border-line bg-card p-3 text-xs text-muted">
          {ios ? (
            <>
              {t('iPhone: otevři web v')} <strong>Safari</strong>, {t('klepni na')} <strong>{t('Sdílet')}</strong>{' '}
              {t('(čtvereček se šipkou) a vyber')} <strong>{t('Přidat na plochu')}</strong>.
            </>
          ) : (
            <>
              {t('Android: v')} <strong>Chrome</strong> {t('otevři menu')} <strong>⋮</strong> {t('a vyber')}{' '}
              <strong>{t('Přidat na plochu')}</strong> ({t('nebo')} <strong>{t('Nainstalovat aplikaci')}</strong>).
            </>
          )}
        </span>
      )}
    </span>
  )
}
