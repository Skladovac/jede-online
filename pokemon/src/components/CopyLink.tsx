'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n/client'

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
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-yellow-300"
      >
        {copied ? t('Zkopírováno ✓') : t('Zkopírovat')}
      </button>
      {canShare && (
        <button type="button" onClick={share} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm dark:border-slate-700">
          {t('Sdílet')}
        </button>
      )}
    </div>
  )
}
