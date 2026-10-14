import Link from 'next/link'
import { ArrowRight, Mail, Phone } from 'lucide-react'
import { SITE, telHref } from '@/lib/site'
import type { Agent } from '@/lib/agents'

/** „01 — Služby“: číslo, zlatá linka, popisek. */
export function SectionLabel({ n, children, dark = false }: { n?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <p data-reveal className={`label flex items-center gap-3 ${dark ? 'text-gold-light' : 'text-gold-deep'}`}>
      {n && <span className="tabular-nums">{n}</span>}
      <span className={`h-px w-10 ${dark ? 'bg-gold/60' : 'bg-gold'}`} aria-hidden />
      {children}
    </p>
  )
}

export function ArrowLink({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 text-[0.95rem] font-semibold ${dark ? 'text-paper hover:text-gold-light' : 'text-ink hover:text-gold-deep'}`}
    >
      <span className="link-u">{children}</span>
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
    </Link>
  )
}

/** Tmavá hlavička podstránky. */
export function PageHero({
  label,
  title,
  lead,
  children,
}: {
  label: string
  title: React.ReactNode
  lead?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="grain relative overflow-hidden bg-ink text-paper">
      <div className="module-grid pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="wrap relative pb-16 pt-14 md:pb-24 md:pt-20">
        <SectionLabel dark>{label}</SectionLabel>
        <h1 data-reveal className="display mt-6 max-w-4xl text-[clamp(2.8rem,7vw,5.6rem)]">
          {title}
        </h1>
        {lead && (
          <p data-reveal className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70">
            {lead}
          </p>
        )}
        {children}
      </div>
    </section>
  )
}

/** Výzva k odhadu ceny — na konci většiny stránek. */
export function ValuationCta() {
  return (
    <section className="relative overflow-hidden bg-gold text-ink">
      <div className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full border border-ink/10" aria-hidden />
      <div className="pointer-events-none absolute -right-8 -top-8 h-[20rem] w-[20rem] rounded-full border border-ink/10" aria-hidden />
      <div className="wrap relative grid items-end gap-10 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-8">
          <p data-reveal className="label text-ink/70">
            Odhad ceny zdarma
          </p>
          <h2 data-reveal className="display mt-4 text-[clamp(2.4rem,5vw,4.2rem)]">
            Kolik dnes stojí <em>vaše nemovitost?</em>
          </h2>
          <p data-reveal className="mt-5 max-w-xl text-lg leading-relaxed text-ink/75">
            Připravíme vám tržní odhad podle reálných prodejů ve vašem okolí. Zdarma a nezávazně, ať už prodáváte hned, nebo
            se teprve rozhodujete.
          </p>
        </div>
        <div data-reveal className="flex flex-col gap-3 md:col-span-4 md:items-end">
          <Link href="/odhad-nemovitosti-zdarma" className="btn-ink w-full md:w-auto">
            Chci odhad ceny zdarma <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a href={telHref(SITE.phone)} className="text-[0.95rem] font-semibold underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            nebo zavolejte {SITE.phone}
          </a>
        </div>
      </div>
    </section>
  )
}

export function AgentPhoto({ agent, className = '', sizes = '320px' }: { agent: Pick<Agent, 'photo' | 'name'>; className?: string; sizes?: string }) {
  if (!agent.photo) {
    const initials = agent.name
      .split(' ')
      .map((p) => p[0])
      .join('')
    return <div className={`grid place-items-center bg-ink-3 font-serif text-4xl text-gold-light ${className}`}>{initials}</div>
  }
  // Statické portréty mají -480/-800 varianty, nahrané jsou jedna velikost.
  const isStatic = agent.photo.startsWith('/img/') && agent.photo.endsWith('-800.webp')
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={agent.photo}
      srcSet={isStatic ? `${agent.photo.replace('-800.webp', '-480.webp')} 480w, ${agent.photo} 800w` : undefined}
      sizes={isStatic ? sizes : undefined}
      alt={agent.name}
      width={800}
      height={1000}
      loading="lazy"
      className={`object-cover ${className}`}
    />
  )
}

/** Vizitka makléře (detail nemovitosti, O nás, kontakt). */
export function AgentCard({ agent, dark = false }: { agent: Agent; dark?: boolean }) {
  return (
    <div className="flex items-center gap-5">
      <Link href={`/makleri/${agent.slug}`} className="shrink-0" tabIndex={-1} aria-hidden>
        <AgentPhoto agent={agent} className="h-24 w-20" sizes="80px" />
      </Link>
      <div className="min-w-0">
        <Link
          href={`/makleri/${agent.slug}`}
          className={`font-serif text-2xl leading-tight underline-offset-4 hover:underline ${dark ? 'text-paper decoration-gold' : 'text-ink decoration-gold'}`}
        >
          {agent.name}
        </Link>
        <p className={`text-sm ${dark ? 'text-paper/60' : 'text-stone'}`}>{agent.role}</p>
        <div className={`mt-2 space-y-1 text-[0.95rem] ${dark ? 'text-paper/85' : 'text-ink'}`}>
          {agent.phone && (
            <a href={telHref(agent.phone)} className="flex items-center gap-2 hover:text-gold-deep">
              <Phone className="h-4 w-4 text-gold" aria-hidden /> {agent.phone}
            </a>
          )}
          {agent.publicEmail && (
            <a href={`mailto:${agent.publicEmail}`} className="flex items-center gap-2 break-all hover:text-gold-deep">
              <Mail className="h-4 w-4 shrink-0 text-gold" aria-hidden /> {agent.publicEmail}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
