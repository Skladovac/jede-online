'use client'

import { useActionState } from 'react'
import { importCollection } from '@/app/actions/import'
import { Alert } from '@/components/ui'
import { useT } from '@/lib/i18n/client'
import { btnBlue, btnSecondary, panel } from '@/components/design'
import { Download, Upload } from 'lucide-react'

/** Záloha sbírky do Excelu (CSV) a nahrání zpátky / ze seznamu. */
export function ImportExport() {
  const t = useT()
  const [state, action, pending] = useActionState(importCollection, undefined)
  return (
    <section className={`${panel} p-5 sm:p-6`}>
      <h2 className="text-2xl font-bold text-fg">{t('Záloha a import')}</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-bold text-fg">{t('Stáhnout sbírku')}</h3>
          <p className="mt-1 text-sm text-muted">
            {t('Karty, produkty i seznam chybějících do souboru CSV — otevřeš ho v Excelu nebo Google Tabulkách.')}
          </p>
          <a
            href="/api/export"
            className={`${btnSecondary} mt-3 text-sm`}
          >
            <Download strokeWidth={1.75} aria-hidden />
            {t('Stáhnout CSV')}
          </a>
        </div>
        <form action={action} className="space-y-2">
          <h3 className="font-bold text-fg">{t('Nahrát ze souboru')}</h3>
          <p className="text-sm text-muted">
            {t('Soubor z exportu (i upravený), nebo jednoduchý seznam po řádcích:')} <code className="text-xs">{t('kód sady;číslo;kusů')}</code>,
            {t('např.')} <code className="text-xs">SVI;45;2</code>. {t('Stejné karty se přepíšou, nic se nemaže.')}
          </p>
          <input name="file" type="file" accept=".csv,text/csv,text/plain" required className="block w-full text-sm" />
          <button
            disabled={pending}
            className={`${btnBlue} text-sm disabled:opacity-50`}
          >
            {pending ? (
              t('Nahrávám…')
            ) : (
              <>
                <Upload strokeWidth={1.75} aria-hidden />
                {t('Nahrát')}
              </>
            )}
          </button>
          <Alert state={state} />
        </form>
      </div>
    </section>
  )
}
