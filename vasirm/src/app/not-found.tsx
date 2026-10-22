import { NotFoundContent } from '@/components/NotFoundContent'
import { SiteShell } from '@/components/SiteShell'

// Neznámé adresy mimo skupinu (web) — stejná 404 i s hlavičkou a patičkou.
export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundContent />
    </SiteShell>
  )
}
