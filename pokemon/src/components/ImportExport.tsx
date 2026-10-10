'use client'

import { useActionState } from 'react'
import { importCollection } from '@/app/actions/import'
import { Alert } from '@/components/ui'
import { useT } from '@/lib/i18n/client'

/** Záloha sbírky do Excelu (CSV) a nahrání zpátky / ze seznamu. */
export function ImportExport() {
  const t = useT()
  const [state, action, pending] = useActionState(importCollection, undefined)
  return (
    <section className="rounded-panel border border-line bg-card p-5">
      <h2 className="text-xl font-bold">{t('Záloha a import')}</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">{t('Stáhnout sbírku')}</h3>
          <p className="mt-1 text-sm text-subtle">
            {t('Karty, produkty i seznam chybějících do souboru CSV — otevřeš ho v Excelu nebo Google Tabulkách.')}
          </p>
          <a
            href="/api/export"
            className="mt-3 inline-block rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            ⬇ {t('Stáhnout CSV')}
          </a>
        </div>
        <form action={action} className="space-y-2">
          <h3 className="font-semibold">{t('Nahrát ze souboru')}</h3>
          <p className="text-sm text-subtle">
            {t('Soubor z exportu (i upravený), nebo jednoduchý seznam po řádcích:')} <code className="text-xs">{t('kód sady;číslo;kusů')}</code>,
            {t('např.')} <code className="text-xs">SVI;45;2</code>. {t('Stejné karty se přepíšou, nic se nemaže.')}
          </p>
          <input name="file" type="file" accept=".csv,text/csv,text/plain" required className="block w-full text-sm" />
          <button
            disabled={pending}
            className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? t('Nahrávám…') : `⬆ ${t('Nahrát')}`}
          </button>
          <Alert state={state} />
        </form>
      </div>
    </section>
  )
}
