import { enabledProviders } from '@/lib/oauth'
import { getT } from '@/lib/i18n/server'

/** Tlačítka „Pokračovat přes Google / Facebook“ (zobrazí se jen poskytovatelé s nastavenými klíči). */
export async function SocialButtons({ next }: { next?: string | null }) {
  const providers = enabledProviders()
  if (!providers.length) return null
  const t = await getT()
  const q = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <div className="mb-6 space-y-2">
      {providers.includes('google') && (
        <a
          href={`/api/auth/google${q}`}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {t('Pokračovat přes Google')}
        </a>
      )}
      {providers.includes('facebook') && (
        <a
          href={`/api/auth/facebook${q}`}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] px-4 py-2.5 font-semibold text-white hover:bg-[#166fe5]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor">
            <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
          </svg>
          {t('Pokračovat přes Facebook')}
        </a>
      )}
      <p className="pt-2 text-center text-xs text-slate-500">{t('nebo e-mailem')}</p>
    </div>
  )
}
