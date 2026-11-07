import type { Metadata } from 'next'
import { ContactForm } from '@/components/ContactForm'
import { AgentCard, PageHero, SectionLabel } from '@/components/ui'
import { getAgents } from '@/lib/agents'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Spojte se s námi — Markéta a Ondřej Nedbálkovi, realitní makléři pro Zlín a okolí. Telefon, e-mail a kontaktní formulář.',
  alternates: { canonical: '/kontakt' },
}

export default async function ContactPage() {
  const agents = await getAgents()
  return (
    <>
      <PageHero
        label="Kontakt"
        title={
          <>
            Spojte se <em className="text-gold-light">s námi.</em>
          </>
        }
        lead="Zavolejte, napište, nebo nám nechte vzkaz. Rádi probereme vaše možnosti — prodej, koupi i odhad ceny."
      />

      <section className="bg-paper-2 py-20 md:py-28">
        <div className="wrap grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>Vaši makléři</SectionLabel>
            <ul className="mt-8 space-y-8">
              {agents.map((a) => (
                <li key={a.id} data-reveal className="border-b border-ink/10 pb-8">
                  <AgentCard agent={a} />
                </li>
              ))}
            </ul>
            <div data-reveal className="mt-8 text-sm leading-relaxed text-stone">
              <p className="font-semibold text-ink">{SITE.name}</p>
              <p>Realitní služby pro {SITE.region}</p>
              {SITE.operator.ico && <p>IČO {SITE.operator.ico}</p>}
              {SITE.operator.address && <p>{SITE.operator.address}</p>}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white p-6 sm:p-10">
              <h2 className="font-serif text-[2.2rem] leading-tight">Napište nám</h2>
              <p className="mb-8 mt-2 text-stone">Ozveme se vám co nejdříve.</p>
              <ContactForm source="/kontakt" placeholder="S čím vám můžeme pomoci?" />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
