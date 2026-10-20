'use client'

import { useActionState, useState } from 'react'
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react'
import { createApiToken, revokeApiToken, type TokenState } from '@/app/actions/api-tokens'
import { btnPrimary, btnSecondary } from '@/components/design'
import { useT } from '@/lib/i18n/client'

type Row = { id: string; name: string; last4: string; createdAt: string; lastUsedAt: string | null }

const MCP = 'https://pokemon.jede.online/mcp'

/** Správa osobních klíčů pro AI asistenty + návod na napojení (ChatGPT, Claude, vlastní GPT). */
export function AiTokens({ tokens, max }: { tokens: Row[]; max: number }) {
  const t = useT()
  const [state, action, pending] = useActionState<TokenState, FormData>(createApiToken, {})
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* starší prohlížeč */
    }
  }
  const CopyBtn = ({ what, text }: { what: string; text: string }) => (
    <button type="button" onClick={() => copy(what, text)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-surface">
      {copied === what ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied === what ? t('Zkopírováno') : t('Kopírovat')}
    </button>
  )

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {t('Osobní klíč dá ChatGPT nebo Claude přístup jen ke čtení tvé sbírky: co máš, co ti chybí, ceny, výměny. Nic nezmění. Klíč kdykoli zrušíš.')}
      </p>

      {state.token && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--positive)_40%,transparent)] bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] p-4">
          <p className="text-sm font-semibold text-fg">{t('Tvůj nový klíč — zkopíruj si ho teď, už se znovu neukáže:')}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-card px-3 py-2 font-mono text-[13px] text-fg ring-1 ring-line">{state.token}</code>
            <CopyBtn what="token" text={state.token} />
          </div>
          <p className="mt-3 text-xs font-semibold text-fg">{t('Adresa pro ChatGPT / Claude (klíč je součástí):')}</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-card px-3 py-2 font-mono text-[12px] text-fg ring-1 ring-line">{`${MCP}/${state.token}`}</code>
            <CopyBtn what="url" text={`${MCP}/${state.token}`} />
          </div>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
          {tokens.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <KeyRound className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">
                  {k.name} <span className="font-mono text-xs font-normal text-subtle">…{k.last4}</span>
                </p>
                <p className="text-xs text-subtle">
                  {t('vytvořen {date}', { date: new Date(k.createdAt).toLocaleDateString('cs-CZ') })}
                  {' · '}
                  {k.lastUsedAt ? t('naposledy použit {date}', { date: new Date(k.lastUsedAt).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) }) : t('zatím nepoužit')}
                </p>
              </div>
              <form action={revokeApiToken}>
                <input type="hidden" name="id" value={k.id} />
                <button className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline" onClick={(e) => !confirm(t('Zrušit tento klíč? Asistent s ním přestane fungovat.')) && e.preventDefault()}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('Zrušit')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {tokens.length < max && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[13px] font-semibold text-fg">{t('Název klíče')}</span>
            <input name="name" maxLength={40} placeholder={t('např. ChatGPT')} className="min-h-[44px] w-full rounded-xl border border-line-strong bg-card px-3 text-fg outline-none focus:border-brand-blue focus:ring-4 focus:ring-[rgba(42,117,187,0.15)]" />
          </label>
          <button disabled={pending} className={`${btnPrimary} disabled:opacity-50`}>
            <KeyRound aria-hidden />
            {pending ? '…' : t('Vytvořit klíč')}
          </button>
        </form>
      )}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <details className="rounded-xl bg-surface p-4 text-sm ring-1 ring-inset ring-line">
        <summary className="cursor-pointer font-semibold text-fg">{t('Jak napojit ChatGPT, Claude nebo vlastní GPT')}</summary>
        <div className="mt-3 space-y-4 text-muted">
          <div>
            <p className="font-semibold text-fg">ChatGPT</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>{t('Nastavení → Aplikace a konektory (Connectors) → Pokročilé → zapni Režim pro vývojáře (Developer mode).')}</li>
              <li>{t('Vytvořit → název „Pokémon sbírka“, adresa MCP serveru = adresa s klíčem výše, ověření: Bez ověření.')}</li>
              <li>{t('V novém chatu zapni konektor (ikona + / Nástroje) a zeptej se třeba: „Které karty ze sady 151 mi chybí a kolik by stály?“')}</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-fg">Claude</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>{t('Nastavení → Konektory → Přidat vlastní konektor → vlož adresu s klíčem výše.')}</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-fg">{t('Vlastní GPT (Actions)')}</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>
                {t('Schéma importuj z adresy')} <code className="font-mono text-xs">https://pokemon.jede.online/api/v1/openapi.json</code>
              </li>
              <li>{t('Ověření: API key → Bearer → vlož klíč.')}</li>
            </ol>
          </div>
          <p className="text-xs text-subtle">{t('Klíč je jako heslo ke čtení sbírky — nikomu ho neposílej. Když ho prozradíš, zruš ho a vytvoř nový.')}</p>
        </div>
      </details>
    </div>
  )
}
