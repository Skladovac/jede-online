'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useT } from '@/lib/i18n/client'

/**
 * Instalace webu jako aplikace (PWA).
 * Android/Chrome: zachytíme `beforeinstallprompt` a systémovou instalaci spustíme tlačítkem.
 * iPhone/iPad: Safari instalaci tlačítkem neumí — ukážeme návod Sdílet → Přidat na plochu.
 * Okno vyskočí na mobilu při každé návštěvě; „Teď ne“ ho schová na 7 dní. V menu je položka pořád.
 */

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISS_KEY = 'install-dismissed-at'
const DISMISS_MS = 7 * 86_400_000
const OPEN_EVENT = 'pk-install-open'

let deferred: BIPEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // vlastní okno místo malé lišty prohlížeče
    deferred = e as BIPEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function env() {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const mobile = ios || /Android|Mobi/i.test(ua)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return { ios, mobile, standalone }
}

/** Stav instalace pro tlačítka: lze nabídnout (Android prompt nebo iOS návod), nebo už je nainstalováno. */
function useInstall() {
  const hasPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false)
  const isInstalled = useSyncExternalStore(subscribe, () => installed, () => false)
  const [e, setE] = useState<ReturnType<typeof env> | null>(null)
  useEffect(() => setE(env()), [])
  const available = !!e && !e.standalone && !isInstalled
  return { env: e, hasPrompt, available }
}

async function runPrompt() {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  emit()
  await ev.prompt()
  const { outcome } = await ev.userChoice
  if (outcome === 'accepted') installed = true
  emit()
  return true
}

/** Otevře instalaci: na Androidu rovnou systémové okno, jinak naše okno s návodem. */
async function openInstall() {
  if (!(await runPrompt())) window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Okno „Stáhni si aplikaci“ (nad spodní lištou). Patří jednou do layoutu. */
export function InstallPrompt() {
  const t = useT()
  const { env: e, hasPrompt, available } = useInstall()
  const [open, setOpen] = useState(false)
  const [manual, setManual] = useState(false) // otevřeno z menu (ignoruje 7denní odklad)

  // Service worker je podmínka instalace v Chrome; sám nic necachuje.
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // Automatické zobrazení: mobil, nenainstalováno, ne do 7 dnů po „Teď ne“. Android čeká na beforeinstallprompt.
  useEffect(() => {
    if (!e || !available || !e.mobile) return
    let dismissedAt = 0
    try {
      dismissedAt = Number(localStorage.getItem(DISMISS_KEY)) || 0
    } catch {
      /* soukromé okno */
    }
    if (Date.now() - dismissedAt < DISMISS_MS) return
    if (e.ios || hasPrompt) setOpen(true)
  }, [e, available, hasPrompt])

  useEffect(() => {
    const onOpen = () => {
      setManual(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  if (!open || !e || (!available && !manual)) return null

  const dismiss = () => {
    if (!manual) {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()))
      } catch {
        /* nevadí */
      }
    }
    setOpen(false)
    setManual(false)
  }

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-panel border border-line-strong bg-card p-4 text-fg shadow-2xl sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p id="install-title" className="font-extrabold">
            {t('Stáhni si aplikaci')}
          </p>
          <p className="mt-0.5 text-sm text-muted">{t('Sbírka, výměny a upozornění jedním klepnutím z plochy telefonu. Zdarma, bez obchodu s aplikacemi.')}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label={t('Zavřít')} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:text-fg">
          ✕
        </button>
      </div>

      {hasPrompt ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await runPrompt()
              setOpen(false)
            }}
            className="min-h-11 flex-1 rounded-[11px] bg-accent-strong px-4 font-bold text-on-accent transition-colors duration-200 hover:bg-accent-hover"
          >
            📲 {t('Stáhnout aplikaci')}
          </button>
          <button type="button" onClick={dismiss} className="min-h-11 rounded-[11px] border border-line-strong px-4 text-sm font-semibold text-muted hover:text-fg">
            {t('Teď ne')}
          </button>
        </div>
      ) : (
        <>
          <ol className="mt-3 space-y-1.5 rounded-lg bg-surface p-3 text-sm">
            {e.ios ? (
              <>
                <li>
                  1. {t('Klepni dole na ikonu Sdílet')}{' '}
                  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px] text-brand-blue" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" />
                  </svg>
                </li>
                <li>2. {t('Vyber „Přidat na plochu“')} ➕</li>
                <li>3. {t('Potvrď „Přidat“ vpravo nahoře')}</li>
              </>
            ) : (
              <>
                <li>1. {t('Otevři menu prohlížeče (⋮ vpravo nahoře)')}</li>
                <li>2. {t('Vyber „Instalovat aplikaci“ nebo „Přidat na plochu“')}</li>
              </>
            )}
          </ol>
          <button type="button" onClick={dismiss} className="mt-3 min-h-11 w-full rounded-[11px] border border-line-strong px-4 text-sm font-semibold text-muted hover:text-fg">
            {manual ? t('Zavřít') : t('Teď ne')}
          </button>
        </>
      )}
    </div>
  )
}

/** Položka „Stáhnout aplikaci“ do menu účtu (skrytá, když web už běží jako aplikace). */
export function InstallMenuItem({ className }: { className: string }) {
  const t = useT()
  const { available } = useInstall()
  if (!available) return null
  return (
    <button type="button" onClick={openInstall} className={`${className} w-full text-left`}>
      📲 {t('Stáhnout aplikaci')}
    </button>
  )
}

/** Ikona v hlavičce pro nepřihlášené (na mobilu; přihlášení mají položku v menu). */
export function InstallHeaderButton({ className }: { className: string }) {
  const t = useT()
  const { env: e, available } = useInstall()
  if (!available || !e?.mobile) return null
  return (
    <button type="button" onClick={openInstall} aria-label={t('Stáhnout aplikaci')} title={t('Stáhnout aplikaci')} className={className}>
      📲
    </button>
  )
}

/** Odkaz v patičce (všechna zařízení). */
export function InstallApp() {
  const t = useT()
  const { available } = useInstall()
  if (!available) return null
  return (
    <button type="button" onClick={openInstall} className="underline">
      📱 {t('Aplikace do mobilu')}
    </button>
  )
}
