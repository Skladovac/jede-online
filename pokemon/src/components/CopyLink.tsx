'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { btnBlue, btnSecondary } from '@/components/design'
import { Check, Copy, Share2 } from 'lucide-react'

/** Odkaz k zkopírování (např. na Facebook). Na mobilu nabídne i systémové sdílení. */
export function CopyLink({ url, title }: { url: string; title: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  useEffect(() => setCanShare('share' in navigator), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Starší prohlížeč: označit text v poli, ať jde zkopírovat ručně.
      ;(document.getElementById('copy-link-input') as HTMLInputElement | null)?.select()
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function share() {
    try {
      await navigator.share({ title, url })
    } catch {
      // zrušeno uživatelem
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id="copy-link-input"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-[13px] text-fg"
      />
      <button
        type="button"
        onClick={copy}
        className={`${btnBlue} text-sm`}
      >
        {copied ? <Check strokeWidth={2.6} aria-hidden /> : <Copy strokeWidth={1.75} aria-hidden />}
        {copied ? t('Zkopírováno') : t('Zkopírovat')}
      </button>
      {canShare && (
        <button type="button" onClick={share} className={`${btnSecondary} text-sm`}>
          <Share2 strokeWidth={1.75} aria-hidden />
          {t('Sdílet')}
        </button>
      )}
    </div>
  )
}
