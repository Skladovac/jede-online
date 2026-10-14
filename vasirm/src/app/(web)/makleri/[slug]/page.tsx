import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ChevronRight, Mail, Phone } from 'lucide-react'
import { AgentPortrait, SpecialtyChips, StatRow, TestimonialCard } from '@/components/agents'
import { ContactForm } from '@/components/ContactForm'
import { JsonLd } from '@/components/JsonLd'
import { ListingCard } from '@/components/ListingCard'
import { SectionLabel, ValuationCta } from '@/components/ui'
import { agentIntro, firstName, getAgentBySlug, isFemale, statsOf } from '@/lib/agents'
import { gridCols, nbsp, paragraphs } from '@/lib/format'
import { getListingCards } from '@/lib/listings'
import { abs, breadcrumbLd } from '@/lib/seo'
import { SITE, SITE_URL, telHref } from '@/lib/site'
import { getTestimonials } from '@/lib/testimonials'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getAgentBySlug((await params).slug)
  if (!a) return { title: 'Makléř nenalezen' }
  const title = `${a.name} — ${a.role}, Zlín`
  return {
    title,
    description: agentIntro(a).slice(0, 300),
    alternates: { canonical: `/makleri/${a.slug}` },
    openGraph: { title, description: agentIntro(a).slice(0, 300), url: `/makleri/${a.slug}`, type: 'profile' },
  }
}

export default async function AgentPage({ params }: Props) {
  const a = await getAgentBySlug((await params).slug)
  if (!a) notFound()
  const [active, sold, testimonials] = await Promise.all([
    getListingCards({ agentId: a.id }),
    getListingCards({ agentId: a.id, sold: true, take: 6 }),
    getTestimonials(a.id),
  ])
  const stats = statsOf(a)
  const she = isFemale(a)
  // Příběh: vlastní text z administrace; dokud ho makléř nedoplní, jen ověřená fakta (žádné vymýšlení).
  const story = a.story.trim()
    ? paragraphs(a.story)
    : [
        `${firstName(a)} provází klienty prodejem a koupí nemovitostí ve Zlíně a okolí${a.yearsInField ? ` už více než ${a.yearsInField} let` : ''}. Spolu s ${she ? 'manželem' : 'manželkou'} tvoří dvojici makléřů VRM.`,
        'Ke každé zakázce přistupuje osobně, jako by šlo o vlastní bydlení: od tržního odhadu ceny a profesionální prezentace přes prohlídky a vyjednávání až po smlouvy a předání klíčů.',
      ]

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE_URL}/makleri/${a.slug}#person`,
    name: a.name,
    jobTitle: a.role,
    url: `${SITE_URL}/makleri/${a.slug}`,
    telephone: a.phone || undefined,
    email: a.publicEmail || undefined,
    image: a.photo ? abs(a.photo) : undefined,
    knowsAbout: a.specialties.length ? a.specialties : undefined,
    worksFor: { '@id': `${SITE_URL}/#vrm` },
  }

  return (
    <>
      <JsonLd data={ld} />
      <JsonLd
        data={breadcrumbLd([
          { name: 'Úvod', path: '/' },
          { name: 'O nás', path: '/o-nas' },
          { name: a.name, path: `/makleri/${a.slug}` },
        ])}
      />

      {/* ───────── HLAVIČKA ───────── */}
      <section className="grain relative overflow-hidden bg-ink text-paper">
        <div className="module-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_right,transparent,black_60%)]" aria-hidden />
        <div className="wrap relative grid gap-12 pb-16 pt-10 md:pb-24 md:pt-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <nav aria-label="Drobečková navigace" className="mb-8 flex items-center gap-1.5 text-sm text-paper/55 lg:hidden">
              <Link href="/o-nas" className="hover:text-paper">
                O nás
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span className="text-paper/85">{a.name}</span>
            </nav>
            <div data-reveal className="relative max-w-md lg:max-w-none">
              <div className="absolute -bottom-4 -right-4 left-4 top-4 border border-gold/60" aria-hidden />
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-3">
                <AgentPortrait agent={a} sizes="(min-width: 1024px) 38vw, 100vw" priority />
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center lg:col-span-7">
            <nav aria-label="Drobečková navigace" className="hidden items-center gap-1.5 text-sm text-paper/55 lg:flex">
              <Link href="/o-nas" className="hover:text-paper">
                O nás
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              <span className="text-paper/85">{a.name}</span>
            </nav>
            <p data-reveal className="label mt-0 flex items-center gap-3 text-gold-light lg:mt-10">
              <span className="h-px w-10 bg-gold/70" aria-hidden />
              {a.role} · {SITE.short}
            </p>
            <h1 data-reveal className="display mt-6 text-[clamp(3.2rem,8vw,6.4rem)]">
              {a.name.split(' ')[0]}
              <br />
              <span className="italic text-gold-light">{a.name.split(' ').slice(1).join(' ')}</span>
            </h1>
            <p data-reveal className="mt-7 max-w-xl text-lg leading-relaxed text-paper/75">
              {nbsp(agentIntro(a))}
            </p>
            {a.specialties.length > 0 && (
              <div data-reveal className="mt-6">
                <SpecialtyChips items={a.specialties} dark />
              </div>
            )}
            {stats.length > 0 && (
              <div data-reveal className="mt-10 border-t border-white/10 pt-8">
                <StatRow stats={stats} dark />
              </div>
            )}
            <div data-reveal className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {a.phone && (
                <a href={telHref(a.phone)} className="btn-gold">
                  <Phone className="h-4 w-4" aria-hidden /> {a.phone}
                </a>
              )}
              <a href="#kontakt" className="btn-ghost-light">
                <Mail className="h-4 w-4" aria-hidden /> Napsat e-mail
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── PŘÍBĚH ───────── */}
      <section className="bg-paper py-20 md:py-28">
        <div className="wrap grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel>Můj příběh</SectionLabel>
            <h2 data-reveal className="display mt-5 text-[clamp(2.2rem,4vw,3.4rem)]">
              Proč dělám <em className="text-gold-deep">reality.</em>
            </h2>
          </div>
          <div data-reveal className="prose-vrm lg:col-span-7 lg:col-start-6 [&>p:first-child]:font-serif [&>p:first-child]:text-[1.6rem] [&>p:first-child]:leading-snug [&>p:first-child]:text-ink">
            {story.map((p, i) => (
              <p key={i}>{nbsp(p)}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── VIDEO (až ho makléř nahraje) ───────── */}
      {a.videoUrl && (
        <section className="bg-paper pb-20 md:pb-28">
          <div className="wrap">
            <div data-reveal className="mx-auto max-w-4xl overflow-hidden bg-ink">
              <iframe
                src={a.videoUrl}
                title={`Video: ${a.name}`}
                className="aspect-video w-full"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                loading="lazy"
              />
            </div>
          </div>
        </section>
      )}

      {/* ───────── NABÍDKA ───────── */}
      {active.length > 0 && (
        <section className="border-t border-ink/10 bg-paper-2 py-20 md:py-28">
          <div className="wrap">
            <SectionLabel>Moje nabídka</SectionLabel>
            <h2 data-reveal className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)]">
              Co právě <em className="text-gold-deep">prodávám</em>
            </h2>
            <div className={`mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${gridCols(active.length)}`}>
              {active.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── REFERENCE ───────── */}
      {testimonials.length > 0 && (
        <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
          <div className="wrap relative">
            <SectionLabel dark>Co říkají klienti</SectionLabel>
            <div className={`mt-12 grid gap-6 ${testimonials.length > 1 ? 'md:grid-cols-2' : 'max-w-3xl'} ${testimonials.length > 2 ? 'lg:grid-cols-3' : ''}`}>
              {testimonials.map((t) => (
                <TestimonialCard key={t.id} t={t} dark />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── PRODÁNO ───────── */}
      {sold.length > 0 && (
        <section className="bg-paper py-20 md:py-28">
          <div className="wrap">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <SectionLabel>Prodáno</SectionLabel>
                <h2 data-reveal className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)]">
                  Nemovitosti, které <em className="text-gold-deep">jsem prodal{she ? 'a' : ''}</em>
                </h2>
              </div>
              <Link href="/nabidka?stav=prodano" className="inline-flex items-center gap-2 text-[0.95rem] font-semibold">
                <span className="link-u">Všechny reference prodejů</span> <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className={`mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 ${gridCols(sold.length)}`}>
              {sold.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── KONTAKT (sem vede tlačítko „Napsat e-mail“ nahoře) ───────── */}
      <section id="kontakt" className="scroll-mt-20 border-t border-ink/10 bg-paper-2 py-20 md:py-28">
        <div className="wrap grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel>Kontakt</SectionLabel>
            <h2 data-reveal className="display mt-5 text-[clamp(2.2rem,4.4vw,3.6rem)]">
              Napište mi <em className="text-gold-deep">přímo.</em>
            </h2>
            <p data-reveal className="mt-6 text-lg leading-relaxed text-stone">
              Prodej, koupě nebo jen otázka k ceně. Zpráva přijde rovnou mně.
            </p>
            <div data-reveal className="mt-8 space-y-2 text-lg">
              {a.phone && (
                <a href={telHref(a.phone)} className="flex items-center gap-3 font-semibold hover:text-gold-deep">
                  <Phone className="h-5 w-5 text-gold" aria-hidden /> {a.phone}
                </a>
              )}
              {a.publicEmail && (
                <a href={`mailto:${a.publicEmail}`} className="flex items-center gap-3 break-all hover:text-gold-deep">
                  <Mail className="h-5 w-5 shrink-0 text-gold" aria-hidden /> {a.publicEmail}
                </a>
              )}
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-white p-6 sm:p-10">
              <ContactForm source={`/makleri/${a.slug}`} agent={a.slug} placeholder="S čím vám můžu pomoci?" />
            </div>
          </div>
        </div>
      </section>

      <ValuationCta />
    </>
  )
}
