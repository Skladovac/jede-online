import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AgentFeature, StatRow, TestimonialCard } from '@/components/agents'
import { HeroIntro } from '@/components/HeroIntro'
import { ListingCard } from '@/components/ListingCard'
import { StaticPhoto } from '@/components/Photo'
import { ArrowLink, SectionLabel, ValuationCta } from '@/components/ui'
import { getAgents, getTeam, statsOf } from '@/lib/agents'
import { SALE_STEPS } from '@/lib/content'
import { gridCols } from '@/lib/format'
import { getListingCards } from '@/lib/listings'
import { SITE } from '@/lib/site'
import { getTestimonials } from '@/lib/testimonials'

export const dynamic = 'force-dynamic'

const SERVICES = [
  {
    title: 'Prodej nemovitosti',
    text: 'Vaši nemovitost představíme v tom nejlepším světle. Od profesionálních fotografií a videoprohlídek až po vyjednání nejvyšší možné ceny.',
    href: '/prodej-nemovitosti',
  },
  {
    title: 'Koupě nemovitosti',
    text: 'Najdeme vám domov, nejen stavbu. Pohlídáme, aby transakce proběhla hladce, bezpečně a bez právních rizik.',
    href: '/koupe-nemovitosti',
  },
  {
    title: 'Tržní odhad zdarma',
    text: 'Základem úspěšného obchodu je správně nastavená cena. Připravíme ji podle reálných tržních dat a našich zkušeností.',
    href: '/odhad-nemovitosti-zdarma',
  },
]

export default async function HomePage() {
  const [agents, team, testimonials, listings] = await Promise.all([getAgents(), getTeam(), getTestimonials(undefined, 3), getListingCards({ take: 6 })])
  const stats = statsOf(team)
  const [first, second] = SITE.team.split(' a ')

  return (
    <>
      <HeroIntro />

      {/* ───────── HERO: makléři ───────── */}
      <section className="grain relative overflow-hidden bg-ink text-paper">
        <div className="module-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_25%_40%,black,transparent_75%)]" aria-hidden />
        <div className="wrap relative grid items-center gap-14 pb-20 pt-12 md:pt-16 lg:grid-cols-12 lg:gap-12 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-6">
            <p data-hero className="label flex items-center gap-3 text-gold-light">
              <span className="h-px w-10 bg-gold/70" aria-hidden />
              {SITE.name} · {SITE.region}
            </p>
            <h1 className="display mt-7 text-[clamp(3.2rem,7.6vw,6.4rem)]">
              <span className="hero-line">
                <span>{first} a</span>
              </span>
              <span className="hero-line">
                <span className="italic text-gold-light">{second}</span>
              </span>
            </h1>
            <p data-hero className="mt-6 font-serif text-[clamp(1.5rem,2.6vw,2rem)] leading-tight text-paper/90">
              Změna bydlení bez stresu. {SITE.claim}
            </p>
            <p data-hero className="mt-6 max-w-xl text-[1.08rem] leading-relaxed text-paper/65">
              {team.yearsInField ? `Více než ${team.yearsInField} let pomáháme lidem ve Zlíně a okolí prodat i najít domov. ` : ''}
              Nejsme korporace s anonymním call centrem. Jsme manželé, kteří Zlín znají jako své boty, a ke každé zakázce přistupujeme, jako
              bychom řešili vlastní bydlení.
            </p>
            <div data-hero className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="#makleri" className="btn-gold">
                Poznejte nás <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/odhad-nemovitosti-zdarma" className="btn-ghost-light">
                Odhad ceny zdarma
              </Link>
            </div>
          </div>

          <div className="relative lg:col-span-6">
            <div data-hero-frame className="absolute -bottom-4 -left-4 right-4 top-4 border border-gold/50" aria-hidden />
            <div className="relative aspect-[5/4] overflow-hidden bg-[#dfe3e8]">
              <div data-hero-photo className="h-full w-full">
                <StaticPhoto
                  name="team/par"
                  widths={[960, 1600]}
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  width={1600}
                  height={1067}
                  alt={`${SITE.team}, realitní makléři ze Zlína`}
                  priority
                  className="h-full w-full object-cover object-[45%_30%]"
                />
              </div>
            </div>
            {team.yearsInField && (
              <div
                data-hero
                className="absolute -bottom-8 right-6 grid h-32 w-32 place-items-center rounded-full bg-gold text-center text-ink shadow-[0_20px_50px_-15px_rgba(0,0,0,0.55)] sm:h-36 sm:w-36"
              >
                <div>
                  <p className="font-serif text-[2.6rem] leading-none">{team.yearsInField}+</p>
                  <p className="mt-1 text-[0.68rem] font-semibold uppercase leading-tight tracking-[0.14em]">
                    let
                    <br />v realitách
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        {stats.length > 1 && (
          <div className="relative border-t border-white/10">
            <div className="wrap py-10">
              <StatRow stats={stats} dark />
            </div>
          </div>
        )}
      </section>

      {/* ───────── MAKLÉŘI ───────── */}
      <section id="makleri" className="scroll-mt-20 bg-paper py-20 md:py-28">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionLabel n="01">Vaši makléři</SectionLabel>
            </div>
            <h2 data-reveal className="display text-[clamp(2.2rem,4.4vw,3.6rem)] md:col-span-7">
              Kdo vás celým prodejem <em className="text-gold-deep">osobně provede.</em>
            </h2>
          </div>
          <div className="mt-16 grid gap-20 lg:grid-cols-2 lg:gap-16">
            {agents.map((a, i) => (
              <AgentFeature key={a.id} agent={a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── REFERENCE ───────── */}
      {testimonials.length > 0 && (
        <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
          <div className="wrap relative">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <SectionLabel n="02" dark>
                  Reference
                </SectionLabel>
                <h2 data-reveal className="display mt-5 text-[clamp(2.4rem,5vw,4rem)]">
                  Co říkají <em className="text-gold-light">naši klienti</em>
                </h2>
              </div>
              <ArrowLink href="/reference" dark>
                Všechny reference
              </ArrowLink>
            </div>
            <div className={`mt-12 grid gap-6 ${testimonials.length > 1 ? 'md:grid-cols-2' : 'max-w-3xl'} ${testimonials.length > 2 ? 'lg:grid-cols-3' : ''}`}>
              {testimonials.map((t) => (
                <TestimonialCard key={t.id} t={t} dark />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── SLUŽBY ───────── */}
      <section className="border-t border-ink/10 bg-paper-2 py-20 md:py-28">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SectionLabel n={testimonials.length ? '03' : '02'}>S čím pomůžeme</SectionLabel>
            </div>
            <h2 data-reveal className="display text-[clamp(2.2rem,4.4vw,3.6rem)] md:col-span-7">
              Ať už prodáváte dům, nebo hledáte první byt, <em className="text-gold-deep">postaráme se o vše.</em>
            </h2>
          </div>
          <div className="mt-14 grid gap-px bg-ink/10 md:grid-cols-3">
            {SERVICES.map((s) => (
              <Link key={s.title} href={s.href} data-reveal className="group flex flex-col bg-paper-2 p-8 transition-colors duration-500 hover:bg-paper md:p-10">
                <h3 className="font-serif text-[2rem] leading-tight">{s.title}</h3>
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
        <section className="bg-paper py-20 md:py-28">
          <div className="wrap">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <SectionLabel n={testimonials.length ? '04' : '03'}>Z naší nabídky</SectionLabel>
                <h2 data-reveal className="display mt-5 text-[clamp(2.4rem,5vw,4rem)]">
                  Na čem právě <em>pracujeme</em>
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

      {/* ───────── POSTUP PRODEJE ───────── */}
      <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
        <div className="wrap relative">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="self-start lg:sticky lg:top-28 lg:col-span-6">
              <SectionLabel dark>Jak prodáváme</SectionLabel>
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

      <ValuationCta />
    </>
  )
}
