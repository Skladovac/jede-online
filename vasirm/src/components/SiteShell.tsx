import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Reveal } from '@/components/Reveal'
import { Analytics } from '@/components/Analytics'
import { JsonLd } from '@/components/JsonLd'
import { getAgents } from '@/lib/agents'
import { organizationLd } from '@/lib/seo'
import { navItems } from '@/lib/site'
import { countTestimonials } from '@/lib/testimonials'

/** Hlavička + patička veřejného webu (layout skupiny (web) a stránka 404 mimo ni). */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const [agents, refs] = await Promise.all([getAgents(), countTestimonials()])
  const nav = navItems(refs > 0)
  return (
    <>
      <Header nav={nav} />
      <main id="obsah">{children}</main>
      <Footer agents={agents} nav={nav} />
      <Reveal />
      <Analytics />
      <JsonLd data={organizationLd(agents)} />
    </>
  )
}
