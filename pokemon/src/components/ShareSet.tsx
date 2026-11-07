'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { btnSecondary } from '@/components/design'
import { ListChecks, Loader2, Share2 } from 'lucide-react'

type Kind = 'postup' | 'chybi'

/**
 * Stránka sady, přihlášený: „Sdílet postup“ (mozaika sady) a „Seznam chybějících“ (prosba o pomoc).
 * Obrázek vykreslí server; na mobilu se otevře systémové sdílení (Instagram, WhatsApp…), jinak se PNG stáhne.
 */
export function ShareSet({ setId, setName, missing }: { setId: string; setName: string; missing: number }) {
  const t = useT()
  const [busy, setBusy] = useState<Kind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function share(kind: Kind) {
    if (busy) return
    setBusy(kind)
    setError(null)
    try {
      const res = await fetch(`/api/sdilet/${encodeURIComponent(setId)}?typ=${kind}`)
      if (!res.ok) throw new Error(String(res.status))
      const file = new File([await res.blob()], `${setName.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${kind}.png`, { type: 'image/png' })
      const title = kind === 'postup' ? t('Můj postup: {name}', { name: setName }) : t('Chybí mi: {name}', { name: setName })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title })
          return
        } catch (e) {
          // Zrušeno uživatelem → nic. Vypršelo „gesto“ (dlouhé kreslení) → stáhnout jako soubor.
          if ((e as DOMException).name === 'AbortError') return
        }
      }
      const url = URL.createObjectURL(file)
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name })
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setError(t('Obrázek se nepodařilo vytvořit. Zkus to za chvíli.'))
    } finally {
      setBusy(null)
    }
  }

  const icon = (kind: Kind, Fallback: typeof Share2) =>
    busy === kind ? <Loader2 className="animate-spin" aria-hidden /> : <Fallback strokeWidth={1.75} aria-hidden />

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => share('postup')} disabled={!!busy} className={`${btnSecondary} text-sm disabled:opacity-60`}>
        {icon('postup', Share2)}
        {busy === 'postup' ? t('Vytvářím obrázek…') : t('Sdílet postup')}
      </button>
      {missing > 0 && (
        <button type="button" onClick={() => share('chybi')} disabled={!!busy} className={`${btnSecondary} text-sm disabled:opacity-60`}>
          {icon('chybi', ListChecks)}
          {busy === 'chybi' ? t('Vytvářím obrázek…') : t('Seznam chybějících')}
        </button>
      )}
      <span className="text-xs text-subtle">{error ?? t('Obrázek na Instagram, WhatsApp nebo Facebook.')}</span>
    </div>
  )
}
