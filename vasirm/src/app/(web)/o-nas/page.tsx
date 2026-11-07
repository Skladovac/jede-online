import type { Metadata } from 'next'
import { AgentFeature, StatRow, TestimonialCard } from '@/components/agents'
import { StaticPhoto } from '@/components/Photo'
import { ArrowLink, PageHero, SectionLabel, ValuationCta } from '@/components/ui'
import { getAgents, getTeam, statsOf } from '@/lib/agents'
import { WHY_US } from '@/lib/content'
import { nbsp, paragraphs } from '@/lib/format'
import { SITE } from '@/lib/site'
import { getTestimonials } from '@/lib/testimonials'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'O nás — Markéta a Ondřej Nedbálkovi',
  description:
    'Jsme manželé, kteří milují reality a Zlín znají jako své boty. Ke každému prodeji i nákupu přistupujeme s osobním nasazením, jako bychom řešili vlastní bydlení.',
  alternates: { canonical: '/o-nas' },
}

const VALUES = [
  ['Upřímnost', 'Řekneme vám pravdu o ceně, stavu i šancích na trhu. I když to není to, co chcete slyšet.'],
  ['Perfektní prezentace', 'Fotografie, video, dron, půdorysy. Každá nemovitost si zaslouží ukázat se v nejlepším světle.'],
  ['Právní jistota', 'Smlouvy a převod hlídáme do posledního detailu. S námi přesně víte, na čem jste.'],
]

export default async function AboutPage() {
  const [agents, team, testimonials] = await Promise.all([getAgents(), getTeam(), getTestimonials(undefined, 2)])
  const story = team.story.trim() ? paragraphs(team.story) : WHY_US
  const stats = statsOf(team)

  return (
    <>
      <PageHero
        label="O nás"
        title={
          <>
            Od sousedů <em className="text-gold-light">pro sousedy.</em>
          </>
        }
        lead={`${SITE.team}. ${team.yearsInField ? `Více než ${team.yearsInField} let v realitách. ` : ''}Manželé, kteří milují reality a Zlín znají jako své boty.`}
      />

      {/* ───────── NÁŠ PŘÍBĚH ───────── */}
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
              alt={`${SITE.team}, realitní makléři ze Zlína`}
              className="relative w-full"
            />
          </div>
          <div className="lg:col-span-6">
            <SectionLabel n="01">Náš příběh</SectionLabel>
            <div data-reveal className="prose-vrm mt-8 [&>p:first-child]:font-serif [&>p:first-child]:text-[1.6rem] [&>p:first-child]:leading-snug [&>p:first-child]:text-ink">
              {story.map((p, i) => (
                <p key={i}>{nbsp(p)}</p>
              ))}
            </div>
            {stats.length > 0 && (
              <div data-reveal className="mt-8 border-t border-ink/10 pt-8">
                <StatRow stats={stats} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───────── MAKLÉŘI ───────── */}
      <section className="border-t border-ink/10 bg-paper-2 py-20 md:py-28">
        <div className="wrap">
          <SectionLabel n="02">Kdo jsme</SectionLabel>
          <h2 data-reveal className="display mt-5 max-w-3xl text-[clamp(2.2rem,4.4vw,3.6rem)]">
            Dva makléři, <em className="text-gold-deep">jeden přístup.</em>
          </h2>
          <div className="mt-16 grid gap-20 lg:grid-cols-2 lg:gap-16">
            {agents.map((a, i) => (
              <AgentFeature key={a.id} agent={a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── HODNOTY ───────── */}
      <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
        <div className="wrap relative">
          <SectionLabel n="03" dark>
            Na čem si zakládáme
          </SectionLabel>
          <ul className="mt-12 grid gap-px bg-white/10 md:grid-cols-3">
            {VALUES.map(([t, d]) => (
              <li key={t} data-reveal className="bg-ink p-8 md:p-10">
                <h2 className="font-serif text-[2.2rem] leading-tight">{t}</h2>
                <p className="mt-3 leading-relaxed text-paper/60">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="bg-paper py-20 md:py-28">
          <div className="wrap">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionLabel n="04">Co říkají klienti</SectionLabel>
              <ArrowLink href="/reference">Všechny reference</ArrowLink>
            </div>
            <div className={`mt-10 grid gap-6 ${testimonials.length > 1 ? 'md:grid-cols-2' : 'max-w-3xl'}`}>
              {testimonials.map((t) => (
                <TestimonialCard key={t.id} t={t} />
              ))}
            </div>
          </div>
        </section>
      )}

      <ValuationCta />
    </>
  )
}
