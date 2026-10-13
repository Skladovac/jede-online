import { SiteShell } from '@/components/SiteShell'

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
