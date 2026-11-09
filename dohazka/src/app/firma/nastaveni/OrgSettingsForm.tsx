'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrgSettings } from '@/app/actions/org'

const pole = 'mt-1 w-full rounded-panel border border-line bg-card px-3 py-2 text-fg focus:border-line-strong focus:outline-none'

export function OrgSettingsForm({ initial }: { initial: { reportName: string; periodStartDay: number; remindHour: number } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [reportName, setReportName] = useState(initial.reportName)
  const [den, setDen] = useState(String(initial.periodStartDay))
  const [hodina, setHodina] = useState(String(initial.remindHour))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const uloz = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      // Číslo se posílá jako číslo; prázdné pole dá NaN a server ho odmítne.
      const r = await updateOrgSettings({ reportName, periodStartDay: Number(den), remindHour: Number(hodina) })
      if ('error' in r) setMsg({ ok: false, text: r.error })
      else {
        setMsg({ ok: true, text: 'Uloženo.' })
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={uloz} className="mt-4 space-y-4">
      <label className="block text-sm">
        Název firmy ve výkazu
        <input value={reportName} onChange={(e) => setReportName(e.target.value)} required maxLength={120} className={pole} />
        <span className="mt-1 block text-xs text-muted">Tiskne se v záhlaví PDF jako „Firma:“.</span>
      </label>
      <label className="block text-sm">
        První den období
        <input type="number" inputMode="numeric" min={1} max={28} step={1} value={den} onChange={(e) => setDen(e.target.value)} required className={pole} />
        <span className="mt-1 block text-xs text-muted">1 = kalendářní měsíc, 16 = období od 16. do 15. Povoleno 1–28. Mění měsíční přehledy a exporty všem ve firmě.</span>
      </label>
      <label className="block text-sm">
        Hodina večerní připomínky
        <input type="number" inputMode="numeric" min={0} max={23} step={1} value={hodina} onChange={(e) => setHodina(e.target.value)} required className={pole} />
        <span className="mt-1 block text-xs text-muted">0–23, pražský čas.</span>
      </label>
      <button type="submit" disabled={pending} className="min-h-11 rounded-panel bg-accent px-5 py-2.5 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60">
        Uložit
      </button>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm' : 'text-sm text-red-600'}>
          {msg.text}
        </p>
      )}
    </form>
  )
}
