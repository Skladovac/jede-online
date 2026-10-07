'use client'

import { useEffect, useState } from 'react'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Tlačítko / návod „Přidat na plochu“. Android (Chrome) nabídne instalaci, iPhone dostane návod. */
export function InstallApp() {
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
        📱 Aplikace do mobilu
      </button>
      {help && (
        <span className="mt-2 block rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {ios ? (
            <>
              iPhone: otevři web v <strong>Safari</strong>, klepni na <strong>Sdílet</strong> (čtvereček se šipkou) a vyber{' '}
              <strong>Přidat na plochu</strong>.
            </>
          ) : (
            <>
              Android: v <strong>Chrome</strong> otevři menu <strong>⋮</strong> a vyber <strong>Přidat na plochu</strong>{' '}
              (nebo <strong>Nainstalovat aplikaci</strong>).
            </>
          )}
        </span>
      )}
    </span>
  )
}
