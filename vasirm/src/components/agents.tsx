import Link from 'next/link'
import { ArrowRight, Phone, Quote } from 'lucide-react'
import { ListingPhoto, StaticPhoto } from '@/components/Photo'
import { AgentPhoto } from '@/components/ui'
import { agentHref, agentIntro, type Agent, type Stat } from '@/lib/agents'
import { telHref } from '@/lib/site'
import type { TestimonialItem } from '@/lib/testimonials'

// Celé portréty na výšku ze starého webu (public/img/team). Nahraná fotka v administraci má přednost.
const FULL: Record<string, string> = { marketa: 'team/marketa-cela', ondrej: 'team/ondrej-cely' }

/** Velký portrét makléře na výšku (osobní stránka, karty na úvodu). */
export function AgentPortrait({ agent, className = '', sizes, priority = false }: { agent: Agent; className?: string; sizes: string; priority?: boolean }) {
  if (FULL[agent.slug] && !agent.photo?.startsWith('/media/')) {
    return (
      <StaticPhoto
        name={FULL[agent.slug]}
        widths={[700, 1100]}
        sizes={sizes}
        width={1100}
        height={1650}
        alt={agent.name}
        priority={priority}
        className={`h-full w-full object-cover object-[62%_28%] ${className}`}
      />
    )
  }
  return <AgentPhoto agent={agent} sizes={sizes} className={`h-full w-full ${className}`} />
}

/** Řada čísel (roky v oboru, prodané nemovitosti…). Bez čísel se nevykreslí nic. */
export function StatRow({ stats, dark = false, className = '' }: { stats: Stat[]; dark?: boolean; className?: string }) {
  if (!stats.length) return null
  return (
    <dl className={`grid gap-6 ${stats.length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'} ${className}`}>
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="sr-only">{s.label}</dt>
          <dd>
            <span className={`block font-serif text-[clamp(2.6rem,5vw,3.6rem)] leading-none ${dark ? 'text-gold-light' : 'text-gold-deep'}`}>{s.value}</span>
            <span className={`mt-2 block text-sm ${dark ? 'text-paper/65' : 'text-stone'}`}>{s.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function SpecialtyChips({ items, dark = false }: { items: string[]; dark?: boolean }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Specializace">
      {items.map((s) => (
        <li key={s} className={`rounded-full border px-3.5 py-1 text-sm ${dark ? 'border-white/20 text-paper/85' : 'border-ink/15 text-ink/80'}`}>
          {s}
        </li>
      ))}
    </ul>
  )
}

/** Velká karta makléře s odkazem na osobní stránku (úvod, O nás). */
export function AgentFeature({ agent, index }: { agent: Agent; index: number }) {
  return (
    <article data-reveal className={`group grid gap-8 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:items-end ${index % 2 ? 'lg:mt-24' : ''}`}>
      <Link href={agentHref(agent)} className="relative block max-w-sm sm:max-w-none" aria-label={`Profil: ${agent.name}`}>
        <div className="absolute -bottom-3 -right-3 left-3 top-3 border border-gold/70 transition-transform duration-500 group-hover:translate-x-1 group-hover:translate-y-1" aria-hidden />
        <div className="relative aspect-[3/4] overflow-hidden bg-ink-3">
          <AgentPortrait agent={agent} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 100vw" className="transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]" />
        </div>
      </Link>
      <div className="min-w-0">
        <p className="label text-gold-deep">{agent.role}</p>
        <h3 className="mt-3 font-serif text-[clamp(2.2rem,4vw,3rem)] leading-[1.02]">
          <Link href={agentHref(agent)} className="decoration-gold decoration-1 underline-offset-[6px] hover:underline">
            {agent.name}
          </Link>
        </h3>
        <p className="mt-4 leading-relaxed text-stone">{agentIntro(agent)}</p>
        {agent.specialties.length > 0 && (
          <div className="mt-5">
            <SpecialtyChips items={agent.specialties} />
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 text-[0.95rem]">
          {agent.phone && (
            <a href={telHref(agent.phone)} className="inline-flex items-center gap-2 font-semibold hover:text-gold-deep">
              <Phone className="h-4 w-4 text-gold" aria-hidden /> {agent.phone}
            </a>
          )}
          <Link href={agentHref(agent)} className="inline-flex items-center gap-2 font-semibold">
            <span className="link-u">Celý profil</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  )
}

/** Reference klienta. */
export function TestimonialCard({ t, dark = false }: { t: TestimonialItem; dark?: boolean }) {
  const img = t.listing?.images[0]
  return (
    <figure data-reveal className={`flex h-full flex-col border p-7 sm:p-8 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-ink/10 bg-paper'}`}>
      <Quote className={`h-7 w-7 ${dark ? 'text-gold' : 'text-gold-deep'}`} aria-hidden />
      <blockquote className={`mt-5 flex-1 font-serif text-[1.45rem] leading-snug ${dark ? 'text-paper' : 'text-ink'}`}>„{t.quote}“</blockquote>
      <figcaption className="mt-7 flex items-center gap-4">
        {img && t.listing && (
          <ListingPhoto listingId={t.listing.id} img={img} alt="" sizes="64px" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        )}
        <div className="min-w-0 text-sm">
          <p className={`font-semibold ${dark ? 'text-paper' : 'text-ink'}`}>
            {t.clientName}
            {t.clientPlace && <span className={`font-normal ${dark ? 'text-paper/60' : 'text-stone'}`}>, {t.clientPlace}</span>}
          </p>
          {(t.propertyLabel || t.agent) && (
            <p className={dark ? 'text-paper/60' : 'text-stone'}>
              {t.propertyLabel}
              {t.propertyLabel && t.agent ? ' · ' : ''}
              {t.agent && (
                <Link href={`/makleri/${t.agent.slug}`} className="underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                  {t.agent.name}
                </Link>
              )}
            </p>
          )}
        </div>
      </figcaption>
    </figure>
  )
}
