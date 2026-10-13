import { ENERGY_CLASSES, ENERGY_LABEL } from '@/lib/format'

// Barvy štítku PENB (A zelená → G červená).
const COLORS = ['#1a8a3c', '#4ea83a', '#a6c837', '#f2d22e', '#f0a228', '#e5652a', '#d22f27']

export function EnergyScale({ value }: { value: string | null }) {
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={value ? `Energetická třída ${value} – ${ENERGY_LABEL[value]}` : 'Energetická třída neuvedena'}>
        {ENERGY_CLASSES.map((c, i) => (
          <div
            key={c}
            className={`flex h-9 flex-1 items-center justify-center text-sm font-bold text-white transition ${value === c ? 'scale-y-[1.18] ring-2 ring-ink ring-offset-2 ring-offset-paper' : value ? 'opacity-35' : 'opacity-60'}`}
            style={{ backgroundColor: COLORS[i] }}
          >
            {c}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone">
        {value ? (
          <>
            Třída <strong className="text-ink">{value}</strong> – {ENERGY_LABEL[value]} (průkaz energetické náročnosti budovy)
          </>
        ) : (
          'Třídu energetické náročnosti sdělíme na vyžádání.'
        )}
      </p>
    </div>
  )
}
