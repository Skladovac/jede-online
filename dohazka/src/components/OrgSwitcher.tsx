'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setActiveOrg } from '@/lib/org-actions'

// Přepínač firem; zobrazuje se jen člověku s víc aktivními členstvími. Cookie nastaví serverová akce až po ověření.
export function OrgSwitcher({ orgs, currentId }: { orgs: { id: string; name: string }[]; currentId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [chyba, setChyba] = useState(false)
  if (orgs.length < 2) return null
  return (
    <label className="block text-sm">
      Firma
      <select
        value={currentId}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value
          start(async () => {
            const ok = await setActiveOrg(id)
            setChyba(!ok)
            if (ok) router.refresh()
          })
        }}
        className="ml-2 min-h-11 rounded-panel border border-line bg-card px-3 py-2"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {chyba && (
        <span role="alert" className="ml-2 text-danger">
          Přepnutí se nepovedlo.
        </span>
      )}
    </label>
  )
}
