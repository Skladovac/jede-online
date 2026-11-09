'use client'

import { useEffect, useState } from 'react'
import { removePushSubscription, savePushSubscription, sendTestPush, setReminder } from '@/app/actions/push'

/**
 * Push notifikace v prohlížeči: zapnutí na tomhle zařízení, hodina připomínky, zkušební pípnutí.
 * iPhone umí push jen v nainstalované aplikaci (na ploše) — tam jen vysvětlíme, jak ji nainstalovat.
 */

const OFF_KEY = 'push-off' // záloha pro případ, že se odběr v prohlížeči nepodařilo zrušit (unsubscribe selhal)

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

function sameKey(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
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
  const key = keyBytes(publicKey)
  let sub = await reg.pushManager.getSubscription()
  // Po výměně VAPID klíče by starý odběr dál vypadal zapnutý, ale server by ho odmítal (403): přihlásit znovu.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)))
  if (!r.ok) throw new Error('subscription-rejected')
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

type DeviceState = 'loading' | 'bad-key' | 'unsupported' | 'ios-install' | 'blocked' | 'on' | 'off'

const btn = 'min-h-11 rounded-panel px-4 py-2 font-medium disabled:opacity-60'
const btnPrimary = `${btn} bg-accent text-on-accent hover:bg-accent-hover`
const btnSecondary = `${btn} border border-line bg-card hover:bg-accent-soft`

export function PushSettings({ publicKey, remindHour, remindEnabled }: { publicKey: string; remindHour: number; remindEnabled: boolean }) {
  const [state, setState] = useState<DeviceState>('loading')
  const [enabled, setEnabled] = useState(remindEnabled)
  const [hour, setHour] = useState(remindHour)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    // iPhone mimo plochu: vysvětlení instalace má přednost, i kdyby prohlížeč API nabízel.
    if (isIosBrowser()) return setState('ios-install')
    if (!supported()) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('blocked')
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    // Odběr s jiným (starým) VAPID klíčem se nepočítá: server by ho odmítal, tak nabídneme zapnutí znovu.
    let platny: boolean
    try {
      platny = !!sub && sameKey(sub.options.applicationServerKey, keyBytes(publicKey))
    } catch {
      // Ručně vložený VAPID klíč na serveru je poškozený (atob selže): bez toho by stav zůstal na „…“ navždy.
      return setState('bad-key')
    }
    setState(platny && Notification.permission === 'granted' && !store.get(OFF_KEY) ? 'on' : 'off')
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
      setMsg({ error: 'Notifikace se nepodařilo zapnout. Zkus to znovu.' })
    }
    await refresh()
    setBusy(false)
  }

  // Zapnutí/vypnutí a hodina se ukládají hned; při chybě se vrátí původní hodnota.
  async function saveReminder(next: { enabled: boolean; hour: number }) {
    const before = { enabled, hour }
    setEnabled(next.enabled)
    setHour(next.hour)
    setMsg(null)
    const r = await setReminder(next).catch(() => ({ ok: false }))
    if (!r.ok) {
      setEnabled(before.enabled)
      setHour(before.hour)
      setMsg({ error: 'Nastavení připomínky se nepodařilo uložit.' })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Na tomhle zařízení</p>
          <p className="text-sm text-muted">
            {state === 'loading' && '…'}
            {state === 'on' && 'Zapnuté — večerní připomínka sem dorazí.'}
            {state === 'off' && 'Vypnuté.'}
            {state === 'blocked' && 'Zablokované v prohlížeči. Povol notifikace pro tento web v nastavení prohlížeče (ikona zámku vedle adresy).'}
            {state === 'bad-key' && 'Klíč pro notifikace na serveru je poškozený, notifikace nejdou zapnout. Dej vědět správci.'}
            {state === 'unsupported' && 'Tento prohlížeč notifikace neumí.'}
            {state === 'ios-install' && 'Na iPhonu fungují notifikace jen v aplikaci na ploše: Sdílet → Přidat na plochu, pak ji otevři z plochy.'}
          </p>
        </div>
        {(state === 'on' || state === 'off') && (
          <button type="button" disabled={busy} onClick={toggle} className={state === 'on' ? btnSecondary : btnPrimary}>
            {busy ? '…' : state === 'on' ? 'Vypnout' : 'Zapnout notifikace'}
          </button>
        )}
      </div>

      {state === 'on' && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setMsg(await sendTestPush().catch(() => ({ error: 'Notifikaci se nepodařilo odeslat.' })))
            setBusy(false)
          }}
          className="min-h-11 text-sm font-medium text-accent underline underline-offset-4 disabled:opacity-60"
        >
          Poslat zkušební notifikaci
        </button>
      )}

      {/* Účtové nastavení (uložené u uživatele), nezávislé na stavu tohoto zařízení: zapnout notifikace jde i z jiného telefonu. */}
      <div className="space-y-3 border-t border-line pt-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => saveReminder({ enabled: e.target.checked, hour })}
            className="mt-0.5 h-5 w-5 accent-[var(--accent)]"
          />
          <span>Připomínat zápis hodin každý den, i o víkendu a svátcích</span>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Hodina připomínky (pražský čas)</span>
          <select
            value={hour}
            disabled={!enabled}
            onChange={(e) => saveReminder({ enabled, hour: Number(e.target.value) })}
            className="mt-1 block min-h-11 w-full rounded-panel border border-line bg-card px-3 py-2 disabled:opacity-60"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      {msg?.ok && <p className="text-sm text-positive">{msg.ok}</p>}
      {msg?.error && (
        <p role="alert" className="text-sm text-danger">
          {msg.error}
        </p>
      )}
    </div>
  )
}
