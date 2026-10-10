import type { Proposal, ProposalItem } from '@/lib/trade-proposal'
import { applyTradeProposal } from '@/app/actions/requests'
import { cardImage } from '@/lib/format'
import { CardImg } from '@/components/CardImg'
import { getT } from '@/lib/i18n/server'

function Side({ title, items, total }: { title: string; items: ProposalItem[]; total: number }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-sm font-semibold text-fg">
        {title} <span className="font-normal tabular-nums text-muted">≈ {total.toLocaleString('cs-CZ')} Kč</span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.id} className="w-16" title={`${i.name} (${i.number}) ≈ ${i.czk} Kč`}>
            <span className="block aspect-[63/88] overflow-hidden rounded-md bg-surface">
              <CardImg src={cardImage(i.imageUrl)} alt={i.name} />
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted">{i.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Návrh férové výměny na profilu (podle cen z Cardmarketu). Tlačítko jen připraví košík — odeslání je na uživateli. */
export async function TradeProposal({ proposal, otherId, nickname }: { proposal: Proposal; otherId: string; nickname: string }) {
  const t = await getT()
  const diff = proposal.getCzk - proposal.giveCzk
  return (
    <div className="mt-5 rounded-panel border border-line-strong bg-accent-soft p-4">
      <h3 className="font-bold text-fg">⚖️ {t('Návrh férové výměny')}</h3>
      <p className="mt-1 text-xs text-muted">{t('Podle orientačních cen z Cardmarketu. Před odesláním ho v košíku můžeš upravit.')}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <Side title={t('Dostaneš')} items={proposal.get} total={proposal.getCzk} />
        <span aria-hidden className="self-center text-2xl text-accent">
          ⇄
        </span>
        <Side title={t('Dáš {name}', { name: nickname })} items={proposal.give} total={proposal.giveCzk} />
      </div>
      <p className="mt-3 text-sm tabular-nums text-muted">
        {Math.abs(diff) < 1
          ? t('Hodnota je vyrovnaná.')
          : diff > 0
            ? t('Dostaneš o {n} Kč víc.', { n: diff.toLocaleString('cs-CZ') })
            : t('Dáš o {n} Kč víc.', { n: (-diff).toLocaleString('cs-CZ') })}
      </p>
      <form action={applyTradeProposal} className="mt-3">
        <input type="hidden" name="otherId" value={otherId} />
        {proposal.get.map((i) => (
          <input key={i.id} type="hidden" name="get" value={i.id} />
        ))}
        {proposal.give.map((i) => (
          <input key={i.id} type="hidden" name="give" value={i.id} />
        ))}
        <button className="min-h-11 rounded-panel bg-accent-strong px-5 font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-hover">
          {t('Připravit výměnu v košíku')} →
        </button>
      </form>
    </div>
  )
}
