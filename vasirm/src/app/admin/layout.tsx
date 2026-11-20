import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Administrace', template: '%s | Administrace VRM' },
  robots: { index: false, follow: false },
}

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-paper-2">{children}</div>
}
