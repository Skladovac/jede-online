// Upozornění u každé ceny (požadavek PRD): ceny jsou jen orientační.
export function PriceNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      Orientační cena z Cardmarketu (průměr prodejů). Skutečná cena se liší podle stavu karty a nabídky.
    </p>
  )
}
