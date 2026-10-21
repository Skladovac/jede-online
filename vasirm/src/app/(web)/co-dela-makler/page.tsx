import type { Metadata } from 'next'
import { ArrowDown, Check } from 'lucide-react'
import { PageHero, SectionLabel, ValuationCta } from '@/components/ui'
import { CHECKLIST_BUY, CHECKLIST_SALE, type ChecklistPhase } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Co všechno pro vás makléř udělá — checklist prodeje a koupě',
  description:
    'Všechny kroky prodeje i koupě nemovitosti na jednom místě: od odhadu ceny a dokumentů přes inzerci, prohlídky a smlouvy až po katastr a předání klíčů. Zlín a okolí.',
  alternates: { canonical: '/co-dela-makler' },
}

const count = (phases: ChecklistPhase[]) => phases.reduce((n, p) => n + p.items.length, 0)

function Checklist({ phases }: { phases: ChecklistPhase[] }) {
  return (
    <ol className="mt-14">
      {phases.map((p, i) => (
        <li key={p.title} data-reveal className="grid gap-5 border-t border-ink/10 py-9 last:border-b md:grid-cols-12 md:gap-8">
          <div className="flex items-baseline gap-4 md:col-span-4">
            <span className="font-serif text-[2.4rem] leading-none text-gold-deep/80 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="text-xl font-semibold">{p.title}</h3>
          </div>
          <ul className="space-y-3.5 md:col-span-8">
            {p.items.map((item) => (
              <li key={item} className="flex gap-3.5 text-[1.05rem] leading-relaxed text-ink/85">
                <span className="mt-[0.2rem] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/20 text-gold-deep">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

export default function ChecklistPage() {
  return (
    <>
      <PageHero
        label="Checklist"
        title={
          <>
            Co všechno za vás <em className="text-gold-light">makléř udělá.</em>
          </>
        }
        lead="Prodej i koupě nemovitosti mají desítky kroků. Tady je vidíte všechny, od první schůzky až po předání klíčů. O každý se postaráme a ke každému se nás můžete kdykoli zeptat."
      >
        <div data-reveal className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="#prodej" className="btn-gold">
            Prodávám <ArrowDown className="h-4 w-4" aria-hidden />
          </a>
          <a href="#koupe" className="btn-ghost-light">
            Kupuji <ArrowDown className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </PageHero>

      <section id="prodej" className="scroll-mt-20 bg-paper py-20 md:py-28">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-4">
              <SectionLabel n="01">Prodej nemovitosti</SectionLabel>
            </div>
            <h2 data-reveal className="display text-[clamp(2.2rem,4.4vw,3.6rem)] md:col-span-8">
              Když prodáváte: <em className="text-gold-deep">{count(CHECKLIST_SALE)} věcí, které za vás pohlídáme.</em>
            </h2>
          </div>
          <Checklist phases={CHECKLIST_SALE} />
        </div>
      </section>

      <section id="koupe" className="scroll-mt-20 border-t border-ink/10 bg-paper-2 py-20 md:py-28">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-4">
              <SectionLabel n="02">Koupě nemovitosti</SectionLabel>
            </div>
            <h2 data-reveal className="display text-[clamp(2.2rem,4.4vw,3.6rem)] md:col-span-8">
              Když kupujete: <em className="text-gold-deep">{count(CHECKLIST_BUY)} věcí, které za vás pohlídáme.</em>
            </h2>
          </div>
          <Checklist phases={CHECKLIST_BUY} />
        </div>
      </section>

      <ValuationCta />
    </>
  )
}
