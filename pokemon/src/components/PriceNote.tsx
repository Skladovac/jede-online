// Upozornění u každé ceny (požadavek PRD): ceny jsou jen orientační.
import { getT } from '@/lib/i18n/server'

export async function PriceNote({ className = '' }: { className?: string }) {
  const t = await getT()
  return (
    <p className={`text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      {t('Orientační cena: cenový trend na Cardmarketu, v závorce přepočet podle kurzu ČNB. Skutečná cena se liší podle stavu karty a nabídky.')}
    </p>
  )
}
