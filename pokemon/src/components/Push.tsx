'use client'

import { useEffect, useState } from 'react'
import { removePushSubscription, savePushSubscription, sendTestPush, setNightQuiet } from '@/app/actions/push'
import { useT } from '@/lib/i18n/client'

/**
 * Push notifikace v prohlížeči: dotaz ve vhodnou chvíli (po žádosti o výměnu / zapnutí hlídání ceny)
 * a přepínače v Můj účet. iPhone umí push jen v nainstalované aplikaci — tam nabídneme instalaci.
 */

const ASK_COOKIE = 'pk_push_ask'
const OFF_KEY = 'push-off' // uživatel si na tomhle zařízení notifikace vypnul

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIosBrowser = () => {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return ios && !window.matchMedia('(display-mode: standalone)').matches
}

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {
      /* soukromé okno */
    }
  },
}

async function registration() {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

/** Povolí notifikace a uloží odběr. Vrací stav oprávnění. */
async function enablePush(publicKey: string) {
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return perm
  const reg = await registration()
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  await savePushSubscription(JSON.parse(JSON.stringify(sub)))
  store.set(OFF_KEY, null)
  return perm
}

async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await removePushSubscription(sub.endpoint)
    await sub.unsubscribe().catch(() => {})
  }
  store.set(OFF_KEY, '1')
}

/** Dotaz „Chceš, aby ti telefon pípl?“ — v hlavičce pro přihlášené. Ukáže se po akci, která nastaví cookie pk_push_ask. */
export function PushAsk({ publicKey }: { publicKey: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported()) return
    // Povoleno dřív: odběr obnovit/přiřadit k aktuálnímu účtu (pokud si ho tu uživatel nevypnul).
    if (Notification.permission === 'granted' && !store.get(OFF_KEY)) enablePush(publicKey).catch(() => {})
  }, [publicKey])

  useEffect(() => {
    // Cookie nastavuje serverová akce; kontrola je levná, tak ji děláme průběžně.
    const check = () => {
      if (!document.cookie.split('; ').some((c) => c === `${ASK_COOKIE}=1`)) return
      document.cookie = `${ASK_COOKIE}=; path=/; max-age=0`
      if (supported() && Notification.permission === 'default') setOpen(true)
      else if (!supported() && isIosBrowser()) window.dispatchEvent(new Event('pk-install-open')) // iPhone: push až v aplikaci
    }
    check()
    const id = setInterval(check, 1500)
    return () => clearInterval(id)
  }, [])

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-labelledby="push-ask-title"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-panel border border-line-strong bg-card p-4 text-fg shadow-2xl sm:bottom-6"
    >
      <p id="push-ask-title" className="font-extrabold">
        🔔 {t('Chceš, aby ti telefon pípl?')}
      </p>
      <p className="mt-1 text-sm text-muted">{t('Dáme ti hned vědět, když ti někdo odpoví na výměnu, napíše zprávu nebo nabídne kartu, kterou hledáš. V noci (21–8) je klid.')}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await enablePush(publicKey).catch(() => {})
            setBusy(false)
            setOpen(false)
          }}
          className="min-h-11 flex-1 rounded-[11px] bg-accent-strong px-4 font-bold text-on-accent transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? '…' : t('Ano, zapnout')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-[11px] border border-line-strong px-4 text-sm font-semibold text-muted hover:text-fg">
          {t('Teď ne')}
        </button>
      </div>
    </div>
  )
}

type DeviceState = 'loading' | 'unsupported' | 'ios-install' | 'blocked' | 'on' | 'off'

/** Nastavení v Můj účet: notifikace na tomhle zařízení, zkušební pípnutí, noční klid. */
export function PushSettings({ publicKey, isMinor, nightQuiet: initialQuiet }: { publicKey: string; isMinor: boolean; nightQuiet: boolean }) {
  const t = useT()
  const [state, setState] = useState<DeviceState>('loading')
  const [quiet, setQuiet] = useState(initialQuiet)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!supported()) return setState(isIosBrowser() ? 'ios-install' : 'unsupported')
    if (Notification.permission === 'denied') return setState('blocked')
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    setState(sub && Notification.permission === 'granted' && !store.get(OFF_KEY) ? 'on' : 'off')
  }
  useEffect(() => {
    refresh()
  }, [])

  const toggle = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (state === 'on') await disablePush()
      else await enablePush(publicKey)
    } catch {
      setMsg({ error: t('Notifikace se nepodařilo zapnout. Zkus to znovu.') })
    }
    await refresh()
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{t('Na tomhle zařízení')}</p>
          <p className="text-sm text-muted">
            {state === 'loading' && '…'}
            {state === 'on' && `✅ ${t('Zapnuté — telefon pípne při všem, co přijde pod zvoneček.')}`}
            {state === 'off' && t('Vypnuté.')}
            {state === 'blocked' && t('Zablokované v prohlížeči. Povol notifikace pro tento web v nastavení prohlížeče (ikona zámku vedle adresy).')}
            {state === 'unsupported' && t('Tento prohlížeč notifikace neumí.')}
            {state === 'ios-install' && t('Na iPhonu fungují notifikace jen v nainstalované aplikaci: Sdílet → Přidat na plochu, pak ji otevři z plochy.')}
          </p>
        </div>
        {(state === 'on' || state === 'off') && (
          <button
            type="button"
            disabled={busy}
            onClick={toggle}
            className={`min-h-11 rounded-[11px] px-4 font-bold transition-colors duration-200 disabled:opacity-50 ${
              state === 'on' ? 'border border-line-strong text-muted hover:text-fg' : 'bg-accent-strong text-on-accent hover:bg-accent-hover'
            }`}
          >
            {busy ? '…' : state === 'on' ? t('Vypnout') : t('Zapnout notifikace')}
          </button>
        )}
        {state === 'ios-install' && (
          <button type="button" onClick={() => window.dispatchEvent(new Event('pk-install-open'))} className="min-h-11 rounded-[11px] bg-accent-strong px-4 font-bold text-on-accent">
            📲 {t('Stáhnout aplikaci')}
          </button>
        )}
      </div>

      {state === 'on' && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setMsg(await sendTestPush())
            setBusy(false)
          }}
          className="text-sm font-semibold text-brand-blue underline dark:text-accent"
        >
          {t('Poslat zkušební notifikaci')}
        </button>
      )}

      <label className={`flex items-start gap-3 text-sm ${isMinor ? 'opacity-70' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={isMinor || quiet}
          disabled={isMinor}
          onChange={async (e) => {
            const v = e.target.checked
            setQuiet(v)
            const r = await setNightQuiet(v)
            if (!r.ok) setQuiet(!v)
          }}
          className="mt-0.5 h-5 w-5 accent-[var(--pokemon-blue)]"
        />
        <span>
          {t('Noční klid 21:00–8:00 (telefon nepípá, upozornění počká pod zvonečkem)')}
          {isMinor && <span className="block text-xs text-subtle">{t('U dětských účtů je noční klid vždy zapnutý.')}</span>}
        </span>
      </label>
      {msg?.ok && <p className="text-sm text-positive">{msg.ok}</p>}
      {msg?.error && <p className="text-sm text-danger">{msg.error}</p>}
    </div>
  )
}
