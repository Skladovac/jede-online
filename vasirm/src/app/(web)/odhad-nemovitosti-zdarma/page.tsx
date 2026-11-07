import type { Metadata } from 'next'
import { Check, Phone } from 'lucide-react'
import { ValuationForm } from '@/components/ValuationForm'
import { SectionLabel } from '@/components/ui'
import { getAgents } from '@/lib/agents'
import { SITE, telHref } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Odhad ceny nemovitosti zdarma — Zlín a okolí',
  description:
    'Kolik stojí váš byt, dům nebo pozemek? Tržní odhad ceny zdarma a nezávazně od zlínských makléřů VRM — podle reálných prodejů ve vašem okolí.',
  alternates: { canonical: '/odhad-nemovitosti-zdarma' },
}

const BENEFITS = [
  'Zdarma a nezávazně',
  'Podle reálných tržních dat a prodejů v okolí',
  'Osobně od makléřů, kteří Zlín znají jako své boty',
]

const HOW = [
  ['Vyplníte formulář', 'Pár údajů o nemovitosti a kontakt. Zabere to dvě minuty.'],
  ['Ozveme se vám', 'Doptáme se na podrobnosti a případně se na nemovitost přijedeme podívat.'],
  ['Dostanete odhad', 'Tržní odhad podle reálných dat a našich zkušeností. Probereme ho spolu.'],
]

export default async function ValuationPage() {
  const agents = await getAgents()
  return (
    <>
      <section className="grain relative overflow-hidden bg-ink text-paper">
        <div className="module-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" aria-hidden />
        <div className="wrap relative grid gap-12 pb-20 pt-14 md:pt-20 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionLabel dark>Odhad ceny zdarma</SectionLabel>
            <h1 data-reveal className="display mt-6 text-[clamp(2.8rem,6vw,5rem)]">
              Kolik dnes stojí <em className="text-gold-light">vaše nemovitost?</em>
            </h1>
            <p data-reveal className="mt-6 text-lg leading-relaxed text-paper/70">
              Základem úspěšného obchodu je správně nastavená cena. Na základě reálných tržních dat a našich zkušeností pro vás
              zdarma připravíme tržní odhad.
            </p>
            <ul data-reveal className="mt-8 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3 text-paper/85">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold text-ink">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div data-reveal className="mt-10 border-t border-white/10 pt-6">
              <p className="text-sm text-paper/55">Raději hned po telefonu?</p>
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                {agents.map((a) => (
                  <a key={a.id} href={telHref(a.phone || SITE.phone)} className="group flex items-center gap-2.5 text-paper hover:text-gold-light">
                    <Phone className="h-4 w-4 text-gold" aria-hidden />
                    <span>
                      <span className="font-semibold">{a.phone}</span>
                      <span className="ml-2 text-sm text-paper/50">{a.name.split(' ')[0]}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-paper p-6 text-ink shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-10">
              <ValuationForm />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper py-20 md:py-24">
        <div className="wrap">
          <SectionLabel>Jak to probíhá</SectionLabel>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {HOW.map(([t, d], i) => (
              <li key={t} data-reveal className="border-t border-ink/15 pt-6">
                <span className="font-serif text-5xl text-gold">{i + 1}</span>
                <h2 className="mt-4 font-serif text-[1.9rem] leading-tight">{t}</h2>
                <p className="mt-2 leading-relaxed text-stone">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
