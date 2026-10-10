'use client'

import { typeInfo } from '@/lib/pokemon-types'
import { useT } from '@/lib/i18n/client'

/** Štítek typu Pokémona: barevné „energetické“ kolečko + název (nespoléhá jen na barvu). */
export function TypeBadge({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' }) {
  const t = useT()
  const info = typeInfo(type)
  if (!info) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
      style={{ backgroundColor: info.color, color: info.text }}
    >
      <span aria-hidden className={`rounded-full border-2 border-current ${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
      {t(info.label)}
    </span>
  )
}
