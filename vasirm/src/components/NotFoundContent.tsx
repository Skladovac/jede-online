import Link from 'next/link'
import { SHOW_LISTINGS } from '@/lib/site'

export function NotFoundContent() {
  return (
    <section className="grain relative overflow-hidden bg-ink text-paper">
      <div className="module-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="wrap relative flex min-h-[60vh] flex-col items-start justify-center py-24">
        <p className="label text-gold-light">Chyba 404</p>
        <h1 className="display mt-6 text-[clamp(3rem,8vw,6rem)]">
          Tahle adresa <em className="text-gold-light">neexistuje.</em>
        </h1>
        <p className="mt-6 max-w-lg text-lg text-paper/65">Nemovitost už možná není v nabídce, nebo se adresa změnila.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          {SHOW_LISTINGS && (
            <Link href="/nabidka" className="btn-gold">
              Aktuální nabídka
            </Link>
          )}
          <Link href="/" className={SHOW_LISTINGS ? 'btn-ghost-light' : 'btn-gold'}>
            Na úvod
          </Link>
        </div>
      </div>
    </section>
  )
}
