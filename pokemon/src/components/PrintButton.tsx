'use client'

import { Printer } from 'lucide-react'
import { btnPrimary } from '@/components/design'

/** Otevře tisk prohlížeče (A4; v okně tisku jde zvolit i „Uložit jako PDF“). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={btnPrimary}>
      <Printer aria-hidden />
      {label}
    </button>
  )
}
