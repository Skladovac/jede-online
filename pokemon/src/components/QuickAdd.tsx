'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { quickAdd, quickAddPhoto, type QuickAddState, type QuickHit } from '@/app/actions/collection'
import { CardImg } from '@/components/CardImg'
import { cardImage } from '@/lib/format'
import { useT } from '@/lib/i18n/client'
import { Pop } from '@/components/Motion'
import { btnBlue, btnPrimary, btnSecondary, panel } from '@/components/design'
import { Camera, Check, Plus, Zap } from 'lucide-react'

/**
 * „Přidej kartu číslem“: rychlé zadávání hromádky karet ze stolu. Po přidání se pole vyčistí a zůstane aktivní,
 * takže jde psát jedno číslo za druhým (MEP 101 ⏎, SVI 045 ⏎, …).
 */
export function QuickAdd({ photo = false, quota, photoDaily = 5 }: { photo?: boolean; quota?: { used: number; left: number | null }; photoDaily?: number }) {
  const t = useT()
  const [textState, textAction, textPending] = useActionState<QuickAddState, FormData>(quickAdd, {})
  const [photoState, photoAction, photoPending] = useActionState<QuickAddState, FormData>(quickAddPhoto, {})
  // Zobrazuje se výsledek posledního způsobu zadání (text / fotka).
  const [last, setLast] = useState<'text' | 'photo'>('text')
  const state = last === 'photo' ? photoState : textState
  const pending = textPending || photoPending
  const action = (fd: FormData) => {
    setLast('text')
    textAction(fd)
  }
  const fileInput = useRef<HTMLInputElement>(null)
  // Zbývající fotky dnes (null = bez limitu, admin) a kolik už dnes vyfotil.
  const left = photoState.photosLeft !== undefined ? photoState.photosLeft : (quota?.left ?? null)
  const used = photoState.photosUsed ?? quota?.used ?? 0
  const noPhotos = left !== null && left <= 0

  // Fotka z telefonu: zmenšit na max. 1280 px (JPEG) přímo v prohlížeči, ať se posílá jen pár set kB.
  async function onPhoto(file: File) {
    let blob: Blob = file
    try {
      const bmp = await createImageBitmap(file)
      const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bmp.width * scale)
      canvas.height = Math.round(bmp.height * scale)
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      blob = (await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))) ?? file
    } catch {
      /* starší prohlížeč: pošleme originál */
    }
    const fd = new FormData()
    fd.append('photo', new File([blob], 'karta.jpg', { type: blob.type || 'image/jpeg' }))
    setLast('photo')
    startTransition(() => photoAction(fd))
  }
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if ((textState.added || (textState.batch && !textState.batch.notFound.length && !textState.batch.ambiguous.length)) && input.current) {
      input.current.value = ''
      input.current.focus()
    }
  }, [textState])

  return (
    <section className={`${panel} p-4 sm:p-5`} aria-labelledby="quick-add-title">
      <h2 id="quick-add-title" className="flex items-center gap-2 text-xl font-bold text-fg">
        <Zap className="h-5 w-5 text-brand-yellow-dark dark:text-brand-yellow" strokeWidth={1.75} aria-hidden />
        {t('Přidej kartu číslem')}
      </h2>
      <form action={action} className="mt-3 flex gap-2">
        <label htmlFor="quick-add-q" className="sr-only">
          {t('Číslo karty')}
        </label>
        <textarea
          ref={input}
          id="quick-add-q"
          name="q"
          rows={1}
          defaultValue={textState.added || textState.batch ? '' : textState.q}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="MEP 101, SVI 045, 2x 30C 071"
          onKeyDown={(e) => {
            // Enter odešle, Shift+Enter = nový řádek (seznam karet).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-line-strong bg-surface px-3 py-2.5 font-mono text-base text-fg outline-none placeholder:text-subtle focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)]"
        />
        <button
          disabled={pending}
          className={`${btnPrimary} h-11 shrink-0 disabled:opacity-50`}
        >
          {textPending ? '…' : t('Přidat')}
        </button>
        {photo && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onPhoto(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              disabled={pending || noPhotos}
              onClick={() => fileInput.current?.click()}
              aria-label={t('Vyfotit kartu')}
              title={t('Vyfotit kartu')}
              className={`${btnBlue} h-11 shrink-0 !px-4 disabled:opacity-50`}
            >
              {photoPending ? '…' : <Camera strokeWidth={1.75} aria-hidden />}
              <span className="hidden sm:inline">{t('Vyfotit')}</span>
            </button>
          </>
        )}
      </form>
      {photo && (
        <p className="mt-2 text-xs text-subtle">
          <Camera className="mr-1 inline h-3.5 w-3.5 -translate-y-px align-middle" strokeWidth={1.75} aria-hidden />
          {t('Vyfoť celou kartu zepředu — web ji pozná, ukáže cenu a zeptá se, jestli ji přidat.')}{' '}
          {quota && left !== null && (
            <strong className={noPhotos ? 'text-danger' : 'text-muted'}>
              {noPhotos ? t('Dnešní fotky jsou vyčerpané, zítra zase.') : t('Dnes zbývá {n} z {max} fotek.', { n: left, max: photoDaily })}
            </strong>
          )}
          {quota && left === null && <strong className="text-muted">{t('Dnes vyfoceno {n} · bez limitu (admin).', { n: used })}</strong>}
        </p>
      )}

      <div aria-live="polite">
        {photoPending && <p className="mt-3 text-sm text-muted">{t('Čtu kartu z fotky…')}</p>}
        {last === 'photo' && !photoPending && state.suggest && (
          <div className="mt-3 rounded-[18px] border border-line-strong bg-surface p-4">
            <p className="eyebrow flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              {t('Na fotce je')}
            </p>
            <div className="mt-3 flex gap-4">
              <span className="card-tile group block w-28 shrink-0 sm:w-36">
                <span className="card-frame block aspect-[63/88]">
                  <CardImg src={cardImage(state.suggest.imageUrl)} alt={state.suggest.name} eager />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold text-fg">{state.suggest.name}</p>
                <p className="text-sm text-muted">{state.suggest.set}</p>
                <p className="font-mono text-[11.5px] tabular-nums text-subtle">{state.suggest.number}</p>
                <p className="mt-2 font-display text-xl font-bold tabular-nums text-fg">
                  {state.suggest.price ? `≈ ${state.suggest.price}` : t('Cena zatím neznámá')}
                </p>
                {state.suggest.owned > 0 && <p className="text-xs text-positive">{t('Už máš {n} ks', { n: state.suggest.owned })}</p>}
                <form action={action} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="cardId" value={state.suggest.id} />
                  <button className={btnPrimary}>
                    <Plus strokeWidth={2} aria-hidden />
                    {t('Přidat do alba')}
                  </button>
                  {!noPhotos && <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className={`${btnSecondary} text-sm`}
                  >
                    <Camera strokeWidth={1.75} aria-hidden />
                    {t('Vyfotit znovu')}
                  </button>}
                </form>
              </div>
            </div>
            {state.hits && state.hits.length > 0 && <p className="mt-4 text-sm text-muted">{t('Není to ona? Vyber jinou:')}</p>}
          </div>
        )}
        {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
        {state.added && (
          <Pop trigger={state.added} className="mt-3 flex items-center gap-3 rounded-panel bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] p-2.5">
            <span data-pop-thumb className="shrink-0">
              <Thumb hit={state.added} />
            </span>
            <p className="min-w-0 text-sm text-fg">
              <span className="inline-flex items-center gap-1 font-semibold text-positive"><Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />{t('Přidáno')}:</span> {state.added.name}{' '}
              <span className="text-muted">({state.added.number})</span>
              <span className="block text-xs text-muted">{t('Teď máš {n} ks', { n: state.added.owned })}</span>
            </p>
          </Pop>
        )}
        {state.batch && (
          <Pop trigger={state.batch} className="mt-3 space-y-3 text-sm">
            {state.batch.added.length > 0 && (
              <div className="rounded-panel bg-[color-mix(in_srgb,var(--positive)_12%,transparent)] p-3">
                <p className="flex items-center gap-1 font-semibold text-positive">
                  <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
                  {t('Přidáno {n} karet', { n: state.batch.added.reduce((s, a) => s + a.qty, 0) })}
                </p>
                <ul className="mt-1 space-y-0.5 text-fg">
                  {state.batch.added.map((a) => (
                    <li key={a.id}>
                      {a.qty > 1 && <span className="font-semibold">{a.qty}× </span>}
                      {a.name} <span className="text-muted">({a.number})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {state.batch.notFound.length > 0 && (
              <p className="text-danger">
                {t('Nenašli jsme:')} {state.batch.notFound.join(', ')}
              </p>
            )}
            {state.batch.ambiguous.map((a) => (
              <div key={a.q}>
                <p className="mb-2 text-muted">{t('„{q}“ odpovídá víc kartám — vyber:', { q: a.q })}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {a.hits.map((h) => (
                    <li key={h.id}>
                      <form action={action}>
                        <input type="hidden" name="cardId" value={h.id} />
                        <button className="flex w-full items-center gap-3 rounded-panel border border-line p-2 text-left transition-colors duration-200 hover:border-line-strong hover:bg-card-hover">
                          <Thumb hit={h} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-fg">{h.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {h.set} · <span className="font-mono text-[11.5px] text-subtle">{h.number}</span>
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-accent"><Plus className="h-4 w-4" strokeWidth={2} aria-hidden />{t('Přidat')}</span>
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Pop>
        )}
        {state.hits && (
          <div className="mt-3">
            {!state.suggest && <p className="mb-2 text-sm text-muted">{t('Víc shod — vyber tu svoji:')}</p>}
            <ul className="grid gap-2 sm:grid-cols-2">
              {state.hits.map((h) => (
                <li key={h.id}>
                  <form action={action}>
                    <input type="hidden" name="cardId" value={h.id} />
                    <button className="flex w-full items-center gap-3 rounded-panel border border-line p-2 text-left transition-colors duration-200 hover:border-line-strong hover:bg-card-hover">
                      <Thumb hit={h} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">{h.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {h.set} · <span className="font-mono text-[11.5px] text-subtle">{h.number}</span>
                        </span>
                        {h.price && <span className="block text-xs tabular-nums text-muted">≈ {h.price}</span>}
                        {h.owned > 0 && <span className="block text-xs text-positive">{t('máš {n} ks', { n: h.owned })}</span>}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-accent"><Plus className="h-4 w-4" strokeWidth={2} aria-hidden />{t('Přidat')}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function Thumb({ hit }: { hit: QuickHit }) {
  return (
    <span className="block aspect-[63/88] w-10 shrink-0 overflow-hidden rounded-[3px] bg-surface shadow-card">
      <CardImg src={cardImage(hit.imageUrl)} alt={hit.name} />
    </span>
  )
}
