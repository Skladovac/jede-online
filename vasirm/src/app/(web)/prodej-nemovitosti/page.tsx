import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Camera, Clapperboard, Handshake, Map, Plane, Scale, ShieldCheck, Users } from 'lucide-react'
import { StaticPhoto } from '@/components/Photo'
import { PageHero, SectionLabel, ValuationCta } from '@/components/ui'
import { SALE_STEPS } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Prodej nemovitosti ve Zlíně a okolí',
  description:
    'Prodáme vaši nemovitost rychle a bezpečně. Profesionální fotografie, videoprohlídky, záběry z dronu, osobní prohlídky a vyjednání nejvyšší možné ceny. Zlín a okolí.',
  alternates: { canonical: '/prodej-nemovitosti' },
}

const SERVICES = [
  { icon: Camera, title: 'Profesionální fotografie', text: 'Nafotíme nemovitost tak, aby vynikla — světlo, úhly, detaily.' },
  { icon: Clapperboard, title: 'Videoprohlídka', text: 'Kupující si dům projde ještě dřív, než přijede.' },
  { icon: Plane, title: 'Záběry z dronu', text: 'Pozemek, okolí a výhledy z nadhledu.' },
  { icon: Map, title: 'Půdorysy', text: 'Přehledná dispozice, ve které se každý rychle zorientuje.' },
  { icon: Users, title: 'Prohlídky vedeme osobně', text: 'Zájemce provedeme sami a odpovíme na jejich otázky.' },
  { icon: Handshake, title: 'Vyjednání nejlepší ceny', text: 'Stojíme na vaší straně až do podpisu.' },
  { icon: ShieldCheck, title: 'Právní jistota', text: 'Smlouvy a převod pohlídáme, abyste nic neriskovali.' },
  { icon: Scale, title: 'Správně nastavená cena', text: 'Tržní odhad podle reálných dat — základ úspěšného prodeje.' },
]

export default function SalePage() {
  return (
    <>
      <PageHero
        label="Prodej nemovitosti"
        title={
          <>
            Prodáme vaši nemovitost <em className="text-gold-light">rychle a bezpečně.</em>
          </>
        }
        lead="Vaši nemovitost představíme v tom nejlepším světle. Od profesionálních fotografií a videoprohlídek až po vyjednání nejvyšší možné ceny."
      >
        <div data-reveal className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/odhad-nemovitosti-zdarma" className="btn-gold">
            Začít odhadem ceny zdarma <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href="/kontakt" className="btn-ghost-light">
            Domluvit schůzku
          </Link>
        </div>
      </PageHero>

      {/* Ukázka prezentace — skutečné fotky z naší nabídky */}
      <section className="bg-ink pb-20">
        <div className="wrap grid gap-2 md:grid-cols-12">
          <div data-reveal className="aspect-[4/3] overflow-hidden md:col-span-7 md:row-span-2 md:aspect-auto">
            <StaticPhoto name="hero/terasa" widths={[960, 1600]} sizes="(min-width: 768px) 58vw, 100vw" width={1600} height={1200} alt="Terasa novostavby v Lukově — ukázka naší fotografie" className="h-full w-full object-cover" />
          </div>
          <div data-reveal className="aspect-[4/3] overflow-hidden md:col-span-5">
            <StaticPhoto name="hero/interier" widths={[960, 1600]} sizes="(min-width: 768px) 42vw, 100vw" width={1600} height={1200} alt="Obývací pokoj s kuchyní — ukázka naší fotografie" className="h-full w-full object-cover" />
          </div>
          <div data-reveal className="aspect-[4/3] overflow-hidden md:col-span-5">
            <StaticPhoto name="hero/lukov-dron" widths={[960, 1600]} sizes="(min-width: 768px) 42vw, 100vw" width={1600} height={1200} alt="Záběr z dronu na dům v Lukově — ukázka naší fotografie" className="h-full w-full object-cover" />
          </div>
          <p className="mt-3 text-sm text-paper/45 md:col-span-12">Ukázky z prezentace nemovitosti z naší nabídky.</p>
        </div>
      </section>

      <section className="bg-paper py-20 md:py-28">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionLabel n="01">Co pro vás uděláme</SectionLabel>
            </div>
            <h2 data-reveal className="display text-[clamp(2.2rem,4.4vw,3.6rem)] md:col-span-7">
              Celý prodej vedeme za vás. <em className="text-gold-deep">Vy víte, na čem jste.</em>
            </h2>
          </div>
          <ul className="mt-14 grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, text }) => (
              <li key={title} data-reveal className="bg-paper p-7">
                <Icon className="h-6 w-6 text-gold-deep" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                <p className="mt-2 leading-relaxed text-stone">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
        <div className="wrap relative grid gap-12 lg:grid-cols-12">
          <div className="self-start lg:sticky lg:top-28 lg:col-span-5">
            <SectionLabel n="02" dark>
              Postup prodeje
            </SectionLabel>
            <h2 data-reveal className="display mt-6 text-[clamp(2.4rem,5vw,4rem)]">
              Od první schůzky až po <em className="text-gold-light">předání klíčů.</em>
            </h2>
          </div>
          <ol className="lg:col-span-7">
            {SALE_STEPS.map(([title, text], i) => (
              <li key={title} data-reveal className="grid grid-cols-[4.5rem_1fr] gap-4 border-t border-white/10 py-8 last:border-b">
                <span className="font-serif text-[2.8rem] leading-none text-gold/80">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-xl font-semibold">{title}</h3>
                  <p className="mt-2 leading-relaxed text-paper/60">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ValuationCta />
    </>
  )
}
