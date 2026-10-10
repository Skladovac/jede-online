import { prisma } from '@/lib/prisma'
import { topBadgeOf } from '@/lib/badges'
import { BADGES, LEVEL_NAME, LEVEL_STYLE, levelFor, nextTier, parseTopBadge, type BadgeId } from '@/lib/badges-def'
import { getT } from '@/lib/i18n/server'

/** Malá ikonka nejlepšího odznaku u přezdívky (seznamy sběratelů, tržiště, hodnocení). */
export async function BadgeIcon({ nickname }: { nickname: string }) {
  const top = parseTopBadge(await topBadgeOf(nickname))
  if (!top) return null
  const t = await getT()
  const title = top.def.tiers ? `${t(top.def.name)} – ${t(LEVEL_NAME[top.level])}` : t(top.def.name)
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] leading-none ${LEVEL_STYLE[top.def.tiers ? top.level : 1]}`}
    >
      {top.def.icon}
    </span>
  )
}

/**
 * Odznaky na profilu. Ostatní vidí získané; majitel profilu i ty, které ještě nemá, s tím, kolik zbývá.
 * `values` = aktuální hodnoty (jen pro majitele, z refreshBadges).
 */
export async function BadgeShelf({ userId, values }: { userId: string; values?: Record<BadgeId, number> }) {
  const t = await getT()
  const rows = await prisma.userBadge.findMany({ where: { userId, level: { gt: 0 } } })
  const levels = new Map(rows.map((r) => [r.badge, r.level]))
  const shown = BADGES.filter((b) => levels.has(b.id) || values)
  if (!shown.length) return null
  return (
    <section id="odznaky" className="mt-8 scroll-mt-24">
      <h2 className="text-xl font-bold">{t('Odznaky')}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((b) => {
          const level = levels.get(b.id) ?? 0
          const value = values?.[b.id]
          const next = values ? nextTier(b, Math.max(level, levelFor(b, value ?? 0))) : null
          const style = LEVEL_STYLE[level ? (b.tiers ? level : 1) : 0]
          return (
            <li key={b.id} className={`rounded-panel border-2 p-3 ${style} ${level ? '' : 'opacity-70'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${level ? '' : 'grayscale'}`}>{b.icon}</span>
                <div className="min-w-0">
                  <p className="truncate font-bold leading-tight">{t(b.name)}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                    {level ? (b.tiers ? t(LEVEL_NAME[level]) : t('získáno')) : t('zatím nezískáno')}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs opacity-80">{t(b.desc)}</p>
              {values && next && value !== undefined && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${Math.min(100, (value / next.min) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs">
                    {t('{value} / {min} do úrovně {level}', { value: Math.max(0, value), min: next.min, level: t(LEVEL_NAME[next.level]) })}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
