import type { Metadata } from 'next'
import { ArrowRight, FileSearch, Home, KeyRound, Landmark } from 'lucide-react'
import Link from 'next/link'
import { ContactForm } from '@/components/ContactForm'
import { PageHero, SectionLabel } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Koupě nemovitosti ve Zlíně a okolí',
  description:
    'Najdeme vám domov, nejen stavbu. Aktivně vyhledáme nabídky a pohlídáme, aby koupě proběhla hladce, bezpečně a bez právních rizik. Zlín a okolí.',
  alternates: { canonical: '/koupe-nemovitosti' },
}

const POINTS = [
  { icon: Home, title: 'Hledáme aktivně', text: 'Řeknete nám, co potřebujete, a my pro vás nabídky vyhledáme a vytřídíme.' },
  { icon: FileSearch, title: 'Prověříme nemovitost', text: 'Katastr, věcná břemena, stav stavby. Abyste věděli, co kupujete.' },
  { icon: Landmark, title: 'Pomůžeme s financováním', text: 'S hypotékou vám rádi pomohou naši kolegové.' },
  { icon: KeyRound, title: 'Bezpečný převod', text: 'Pohlídáme, aby transakce proběhla hladce, bezpečně a bez právních rizik.' },
]

export default function BuyPage() {
  return (
    <>
      <PageHero
        label="Koupě nemovitosti"
        title={
          <>
            Najdeme vám domov, <em className="text-gold-light">nejen stavbu.</em>
          </>
        }
        lead="Aktivně pro vás vyhledáme nabídky a pohlídáme, aby transakce proběhla hladce, bezpečně a bez právních rizik."
      >
        <div data-reveal className="mt-9">
          <Link href="/nabidka" className="btn-gold">
            Prohlédnout aktuální nabídku <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </PageHero>

      <section className="bg-paper py-20 md:py-28">
        <div className="wrap">
          <SectionLabel n="01">Jak vám pomůžeme</SectionLabel>
          <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} data-reveal className="border-t border-ink/15 pt-6">
                <Icon className="h-7 w-7 text-gold-deep" strokeWidth={1.4} aria-hidden />
                <h2 className="mt-5 font-serif text-[1.8rem] leading-tight">{title}</h2>
                <p className="mt-2 leading-relaxed text-stone">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-ink/10 bg-paper-2 py-20 md:py-28">
        <div className="wrap grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel n="02">Co hledáte?</SectionLabel>
            <h2 data-reveal className="display mt-5 text-[clamp(2.4rem,4.6vw,3.8rem)]">
              Napište nám, <em className="text-gold-deep">jaký domov hledáte.</em>
            </h2>
            <p data-reveal className="mt-6 text-lg leading-relaxed text-stone">
              Lokalita, velikost, rozpočet, termín. Ozveme se, jakmile budeme mít něco, co vám sedne.
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-white p-6 sm:p-10">
              <ContactForm
                source="/koupe-nemovitosti"
                messageLabel="Co hledáte?"
                placeholder="Např. rodinný dům 4+1 se zahradou, Zlín nebo do 15 km, rozpočet do 8 mil. Kč…"
                submit="Odeslat poptávku"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
