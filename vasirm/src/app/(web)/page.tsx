import Link from 'next/link'
import { ArrowRight, Phone } from 'lucide-react'
import { HeroIntro } from '@/components/HeroIntro'
import { ListingCard } from '@/components/ListingCard'
import { StaticPhoto } from '@/components/Photo'
import { AgentCard, AgentPhoto, ArrowLink, SectionLabel, ValuationCta } from '@/components/ui'
import { getAgents } from '@/lib/agents'
import { getListingCards } from '@/lib/listings'
import { gridCols } from '@/lib/format'
import { SITE, telHref } from '@/lib/site'
import { SALE_STEPS, WHY_US } from '@/lib/content'

export const dynamic = 'force-dynamic'

const SERVICES = [
  {
    n: 'I.',
    title: 'Prodej nemovitosti',
    text: 'Vaši nemovitost představíme v tom nejlepším světle. Od profesionálních fotografií a videoprohlídek až po vyjednání nejvyšší možné ceny. Prodáme rychle a bezpečně.',
    href: '/prodej-nemovitosti',
  },
  {
    n: 'II.',
    title: 'Koupě nemovitosti',
    text: 'Najdeme vám domov, nejen stavbu. Aktivně pro vás vyhledáme nabídky a pohlídáme, aby transakce proběhla hladce, bezpečně a bez právních rizik.',
    href: '/koupe-nemovitosti',
  },
  {
    n: 'III.',
    title: 'Tržní odhad zdarma',
    text: 'Základem úspěšného obchodu je správně nastavená cena. Na základě reálných tržních dat a našich zkušeností pro vás zdarma připravíme tržní odhad.',
    href: '/odhad-nemovitosti-zdarma',
  },
]


export default async function HomePage() {
  const [listings, agents] = await Promise.all([getListingCards({ take: 6 }), getAgents()])

  return (
    <>
      <HeroIntro />

      {/* ───────── HERO ───────── */}
      <section className="grain relative overflow-hidden bg-ink text-paper">
        <div className="module-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_75%)]" aria-hidden />
        <div className="wrap relative grid gap-12 pb-20 pt-12 md:pt-16 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-20">
          <div className="lg:col-span-7 lg:pt-6">
            <p data-hero className="label flex items-center gap-3 text-gold-light">
              <span className="h-px w-10 bg-gold/70" aria-hidden />
              Realitní služby pro {SITE.region}
            </p>
            <h1 className="display mt-7 text-[clamp(3.4rem,9.5vw,7.6rem)]">
              <span className="hero-line">
                <span>Změna bydlení</span>
              </span>
              <span className="hero-line">
                <span className="italic text-gold-light">bez stresu.</span>
              </span>
            </h1>
            <p data-hero className="mt-6 font-serif text-[clamp(1.6rem,3vw,2.2rem)] leading-tight text-paper/90">
              {SITE.claim}
            </p>
            <p data-hero className="mt-6 max-w-xl text-[1.08rem] leading-relaxed text-paper/65">
              Víme, že prodej či koupě nemovitosti je velký životní krok. Provedeme vás celým procesem s klidem,
              transparentností a osobním přístupem, který u korporátů nenajdete.
            </p>
            <div data-hero className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/odhad-nemovitosti-zdarma" className="btn-gold">
                Chci odhad ceny zdarma <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/nabidka" className="btn-ghost-light">
                Prohlédnout nabídku
              </Link>
            </div>

            {agents.length > 0 && (
              <div data-hero className="mt-12 flex items-center gap-4 border-t border-white/10 pt-6">
                <div className="flex -space-x-3">
                  {agents.map((a) => (
                    <AgentPhoto key={a.id} agent={a} sizes="56px" className="h-14 w-14 rounded-full border-2 border-ink object-[50%_20%]" />
                  ))}
                </div>
                <div className="text-sm leading-snug">
                  <p className="font-semibold text-paper">{SITE.team}</p>
                  <a href={telHref(SITE.phone)} className="mt-0.5 inline-flex items-center gap-1.5 text-paper/60 hover:text-gold-light">
                    <Phone className="h-3.5 w-3.5 text-gold" aria-hidden /> {SITE.phone}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="relative self-start lg:col-span-5 lg:mt-4">
            <div data-hero-frame className="absolute -bottom-4 -left-4 right-4 top-4 border border-gold/50" aria-hidden />
            <div className="relative aspect-[4/5] overflow-hidden bg-ink-3">
              <div data-hero-photo className="h-full w-full">
                <StaticPhoto
                  name="hero/lukov"
                  widths={[960, 1600, 2400]}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  width={2400}
                  height={1800}
                  alt="Novostavba rodinného domu s terasou a zahradou v Lukově u Zlína"
                  priority
                  className="h-full w-full object-cover object-[38%_50%]"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent px-6 pb-5 pt-16">
                <p className="label text-gold-light">Z naší nabídky</p>
                <p className="mt-1 font-serif text-xl">Novostavba pasivního domu, Lukov</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── SLUŽBY ───────── */}
      <section className="relative bg-paper py-20 md:py-28">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionLabel n="01">Jak vám pomůžeme</SectionLabel>
            </div>
            <h2 data-reveal className="display text-[clamp(2.2rem,4.4vw,3.6rem)] md:col-span-7">
              Ať už prodáváte dům, nebo hledáte první byt, <em className="text-gold-deep">postaráme se o vše.</em>
            </h2>
          </div>
          <div data-reveal-group className="mt-16 grid gap-px bg-ink/10 md:grid-cols-3">
            {SERVICES.map((s) => (
              <Link key={s.title} href={s.href} data-reveal className="group flex flex-col bg-paper p-8 transition-colors duration-500 hover:bg-paper-2 md:p-10">
                <span className="font-serif text-3xl text-gold">{s.n}</span>
                <h3 className="mt-10 font-serif text-[2rem] leading-tight">{s.title}</h3>
                <p className="mt-4 flex-1 leading-relaxed text-stone">{s.text}</p>
                <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold">
                  Více <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── NABÍDKA ───────── */}
      {listings.length > 0 && (
        <section className="border-t border-ink/10 bg-paper-2 py-20 md:py-28">
          <div className="wrap">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <SectionLabel n="02">Nabídka</SectionLabel>
                <h2 data-reveal className="display mt-5 text-[clamp(2.4rem,5vw,4rem)]">
                  Aktuálně <em>nabízíme</em>
                </h2>
              </div>
              <div data-reveal>
                <ArrowLink href="/nabidka">Celá nabídka</ArrowLink>
              </div>
            </div>
            <div className={`mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${gridCols(listings.length)}`}>
              {listings.map((l, i) => (
                <ListingCard key={l.id} l={l} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── PRODEJ — POSTUP ───────── */}
      <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
        <div className="wrap relative">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="self-start lg:sticky lg:top-28 lg:col-span-6">
              <SectionLabel n="03" dark>
                Prodáváte?
              </SectionLabel>
              <h2 data-reveal className="display mt-6 text-[clamp(2.4rem,5vw,4.2rem)]">
                Od první schůzky až po <em className="text-gold-light">předání klíčů.</em>
              </h2>
              <p data-reveal className="mt-6 max-w-lg text-lg leading-relaxed text-paper/65">
                S námi přesně víte, na čem jste. Celý prodej vedeme za vás a o každém kroku vás průběžně informujeme.
              </p>
              <div data-reveal className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href="/odhad-nemovitosti-zdarma" className="btn-gold">
                  Začít odhadem ceny <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/prodej-nemovitosti" className="btn-ghost-light">
                  Jak prodáváme
                </Link>
              </div>
            </div>
            <ol className="lg:col-span-6">
              {SALE_STEPS.map(([title, text], i) => (
                <li key={title} data-reveal className="group grid grid-cols-[4.5rem_1fr] gap-4 border-t border-white/10 py-7 last:border-b">
                  <span className="font-serif text-[2.6rem] leading-none text-gold/80 transition-colors group-hover:text-gold-light">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-paper">{title}</h3>
                    <p className="mt-1.5 leading-relaxed text-paper/60">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───────── O NÁS ───────── */}
      <section className="bg-paper py-20 md:py-28">
        <div className="wrap grid items-center gap-14 lg:grid-cols-12">
          <div data-reveal className="relative lg:col-span-6">
            <div className="absolute -right-4 -top-4 bottom-4 left-4 border border-gold" aria-hidden />
            <StaticPhoto
              name="team/par"
              widths={[960, 1600]}
              sizes="(min-width: 1024px) 45vw, 100vw"
              width={1600}
              height={1067}
              alt="Markéta a Ondřej Nedbálkovi, realitní makléři ze Zlína"
              className="relative w-full"
            />
          </div>
          <div className="lg:col-span-6">
            <SectionLabel n="04">O nás</SectionLabel>
            <h2 data-reveal className="display mt-5 text-[clamp(2.4rem,5vw,4rem)]">
              Proč si vybrat <em className="text-gold-deep">právě nás?</em>
            </h2>
            <div data-reveal className="prose-vrm mt-7">
              {WHY_US.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
            </div>
            <div data-reveal className="mt-8 grid gap-8 border-t border-ink/10 pt-8 sm:grid-cols-2">
              {agents.map((a) => (
                <AgentCard key={a.id} agent={a} />
              ))}
            </div>
            <div data-reveal className="mt-8">
              <ArrowLink href="/o-nas">Poznejte nás blíž</ArrowLink>
            </div>
          </div>
        </div>
      </section>

      <ValuationCta />
    </>
  )
}
