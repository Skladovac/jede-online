import type { Metadata } from 'next'
import { Mail, Phone } from 'lucide-react'
import { StaticPhoto } from '@/components/Photo'
import { AgentPhoto, PageHero, SectionLabel, ValuationCta } from '@/components/ui'
import { getAgents } from '@/lib/agents'
import { WHY_US } from '@/lib/content'
import { telHref } from '@/lib/site'

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

// Celé portréty (na výšku) podle makléře; nahraná fotka má přednost.
const FULL: Record<string, string> = { marketa: 'team/marketa-cela', ondrej: 'team/ondrej-cely' }

export default async function AboutPage() {
  const agents = await getAgents()
  return (
    <>
      <PageHero
        label="O nás"
        title={
          <>
            Od sousedů <em className="text-gold-light">pro sousedy.</em>
          </>
        }
        lead="Nejsme velká korporace s anonymním call centrem. Jsme manželé, kteří milují reality a Zlín znají jako své boty."
      />

      <section className="bg-paper py-20 md:py-28">
        <div className="wrap grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel n="01">Kdo jsme</SectionLabel>
            <div data-reveal className="prose-vrm mt-8">
              {WHY_US.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
            </div>
            <blockquote data-reveal className="mt-10 border-l-2 border-gold pl-6">
              <p className="font-serif text-[2.1rem] leading-tight">„Ke každému prodeji přistupujeme, jako bychom řešili vlastní bydlení.“</p>
            </blockquote>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
            {agents.map((a, i) => (
              <figure key={a.id} data-reveal className={i % 2 ? 'sm:mt-16' : ''}>
                <div className="relative aspect-[3/4] overflow-hidden bg-ink-3">
                  {FULL[a.slug] && !a.photo?.startsWith('/media/') ? (
                    <StaticPhoto
                      name={FULL[a.slug]}
                      widths={[700, 1100]}
                      sizes="(min-width: 1024px) 28vw, (min-width: 640px) 50vw, 100vw"
                      width={1100}
                      height={1650}
                      alt={a.name}
                      className="h-full w-full object-cover object-[60%_30%]"
                    />
                  ) : (
                    <AgentPhoto agent={a} className="h-full w-full" />
                  )}
                </div>
                <figcaption className="mt-5">
                  <p className="font-serif text-[1.9rem] leading-tight">{a.name}</p>
                  <p className="text-stone">{a.role}</p>
                  {a.bio && <p className="mt-3 leading-relaxed text-ink/80">{a.bio}</p>}
                  <div className="mt-3 space-y-1">
                    {a.phone && (
                      <a href={telHref(a.phone)} className="flex items-center gap-2 hover:text-gold-deep">
                        <Phone className="h-4 w-4 text-gold" aria-hidden /> {a.phone}
                      </a>
                    )}
                    {a.publicEmail && (
                      <a href={`mailto:${a.publicEmail}`} className="flex items-center gap-2 hover:text-gold-deep">
                        <Mail className="h-4 w-4 text-gold" aria-hidden /> {a.publicEmail}
                      </a>
                    )}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="grain relative overflow-hidden bg-ink py-20 text-paper md:py-28">
        <div className="wrap relative">
          <SectionLabel n="02" dark>
            Na čem si zakládáme
          </SectionLabel>
          <ol className="mt-12 grid gap-px bg-white/10 md:grid-cols-3">
            {VALUES.map(([t, d], i) => (
              <li key={t} data-reveal className="bg-ink p-8 md:p-10">
                <span className="font-serif text-4xl text-gold/80">{['I.', 'II.', 'III.'][i]}</span>
                <h2 className="mt-8 font-serif text-[2.2rem] leading-tight">{t}</h2>
                <p className="mt-3 leading-relaxed text-paper/60">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-paper py-20 md:py-24">
        <div className="wrap">
          <div data-reveal className="relative">
            <StaticPhoto
              name="team/par"
              widths={[960, 1600]}
              sizes="100vw"
              width={1600}
              height={1067}
              alt="Markéta a Ondřej Nedbálkovi"
              className="mx-auto w-full max-w-4xl"
            />
          </div>
        </div>
      </section>

      <ValuationCta />
    </>
  )
}
