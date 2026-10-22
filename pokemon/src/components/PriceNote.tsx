// Upozornění u každé ceny (požadavek PRD): ceny jsou jen orientační.
import { getT } from '@/lib/i18n/server'

export async function PriceNote({ className = '' }: { className?: string }) {
  const t = await getT()
  return (
    <p className={`text-xs text-subtle ${className}`}>
      {t('Orientační cena: cenový trend na Cardmarketu, v závorce přepočet podle kurzu ČNB. Skutečná cena se liší podle stavu karty a nabídky.')}{' '}
      {t('Jde o souhrn celého Cardmarketu bez filtru jazyka, země a stavu — „nejnižší nabídka“ bývá cizojazyčná nebo hraná karta ze vzdálené země; pro ČR a SK se řiď trendem a průměry.')}
    </p>
  )
}
