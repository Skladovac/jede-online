'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { deleteListing, retrySync, setFeatured } from '@/app/actions/admin'

/** Ovládání nemovitosti z Realmanu: data jsou jen ke čtení, na webu jde měnit zvýraznění, stáhnout fotky znovu a smazat. */
export function RealmanPanel({
  id,
  externalId,
  featured,
  syncState,
  syncError,
  canRetry,
}: {
  id: string
  externalId: string
  featured: boolean
  syncState: string
  syncError: string
  canRetry: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [on, setOn] = useState(featured)

  return (
    <section className="mt-6 border border-gold bg-gold/10 p-5 sm:p-7">
      <p className="label text-gold-deep">Z Realmanu · zakázka č. {externalId}</p>
      <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed">
        Texty, cena, parametry, fotky i video se upravují v Realmanu. Po úpravě tam znovu klikněte na „Exportovat na web“ a změny se tu
        během chvíle objeví. Když zakázku v Realmanu stáhnete z exportu, na webu se přepne na „Prodáno“.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        {syncState === 'ok' && (
          <span className="flex items-center gap-1.5 text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Fotky a video jsou stažené.
          </span>
        )}
        {syncState === 'pending' && (
          <span className="flex items-center gap-1.5 text-stone">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Fotky se právě stahují…
          </span>
        )}
        {syncState === 'error' && (
          <span className="flex items-start gap-1.5 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Některé soubory se nepodařilo stáhnout: {syncError}
          </span>
        )}
        {syncState !== 'ok' && canRetry && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => (await retrySync(id), router.refresh()))}
            className="inline-flex items-center gap-1.5 font-semibold hover:text-gold-deep disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Zkusit znovu
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-gold/40 pt-5">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={on}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.checked
              setOn(v)
              start(async () => (await setFeatured(id, v), router.refresh()))
            }}
            className="h-4 w-4 accent-[#c5a880]"
          />
          Zvýraznit (zobrazit na úvodní stránce jako první)
        </label>
        <button
          type="button"
          onClick={async () => {
            if (confirm('Smazat nemovitost z webu včetně fotek? V Realmanu zůstane — při dalším exportu by se na web vrátila.')) await deleteListing(id)
          }}
          className="inline-flex items-center gap-2 text-sm text-red-700 hover:underline"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Smazat z webu
        </button>
      </div>
    </section>
  )
}
