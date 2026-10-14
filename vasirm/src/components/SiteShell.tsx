import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { Analytics } from '@/components/Analytics'
import { JsonLd } from '@/components/JsonLd'
import { getAgents } from '@/lib/agents'
import { organizationLd } from '@/lib/seo'

/** Hlavička + patička veřejného webu (layout skupiny (web) a stránka 404 mimo ni). */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const agents = await getAgents()
  return (
    <>
      <Header />
      <main id="obsah">{children}</main>
      <Footer agents={agents} />
      <Reveal />
      <Analytics />
      <JsonLd data={organizationLd(agents)} />
    </>
  )
}
