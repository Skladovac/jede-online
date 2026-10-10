import { prisma } from '@/lib/prisma'
import { topBadgeOf } from '@/lib/badges'
import { BADGES, LEVEL_NAME, levelFor, nextTier, parseTopBadge, type BadgeId } from '@/lib/badges-def'
import { getT } from '@/lib/i18n/server'
import { BadgeCheck, Crown, Flower2, Gift, Handshake, Layers, Library, Lock, Megaphone, Rocket, Star, type LucideIcon } from 'lucide-react'

/** Ikona odznaku (tenká čára místo emoji z badges-def, to zůstává pro e-maily a upozornění). */
const ICON: Record<BadgeId, LucideIcon> = {
  reliable: Star,
  trader: Handshake,
  ambassador: Megaphone,
  master: Crown,
  complete: Library,
  collector: Layers,
  japanese: Flower2,
  pioneer: Rocket,
  invited: Gift,
  verified: BadgeCheck,
}

/**
 * Medaile podle úrovně: kov jako přechod v kroužku, ikona ve středu.
 * 0 = nezískáno, 1 bronz, 2 stříbro, 3 zlato, 4 legendární (holografický přechod). Jednorázové odznaky = inkoust se žlutou.
 */
const MEDAL = [
  'bg-surface text-subtle ring-1 ring-inset ring-line',
  'bg-[linear-gradient(145deg,#e7b48a,#a8673a_55%,#7a4524)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_12px_-4px_rgba(122,69,36,0.6)]',
  'bg-[linear-gradient(145deg,#f4f6f9,#a9b2bf_55%,#7d8796)] text-[#26303d] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_-4px_rgba(80,90,105,0.6)]',
  'bg-[linear-gradient(145deg,#ffe58a,#e0ac18_55%,#a87a06)] text-[#4a3500] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_14px_-4px_rgba(200,150,10,0.7)]',
  'bg-[conic-gradient(from_200deg,#ff9ad5,#9ad0ff,#b6ffb0,#fff09a,#ff9ad5)] text-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_16px_-4px_rgba(160,110,220,0.7)]',
] as const
const MEDAL_SINGLE = 'bg-[var(--ink)] text-brand-yellow shadow-[0_4px_12px_-4px_rgba(14,27,46,0.55)] dark:bg-brand-yellow dark:text-[var(--ink)]'
/** Popisek úrovně (malý štítek). */
const LEVEL_TAG = [
  'text-subtle',
  'text-[#8a4f26] dark:text-[#e7b48a]',
  'text-[#5d6775] dark:text-[#c9d1dc]',
  'text-[#8a6400] dark:text-[#ffd95c]',
  'text-[#7b4fb8] dark:text-[#d6b8ff]',
] as const

const medalOf = (tiers: boolean, level: number) => (level === 0 ? MEDAL[0] : tiers ? MEDAL[level] : MEDAL_SINGLE)

/** Malá ikonka nejlepšího odznaku u přezdívky (seznamy sběratelů, tržiště, hodnocení). */
export async function BadgeIcon({ nickname }: { nickname: string }) {
  const top = parseTopBadge(await topBadgeOf(nickname))
  if (!top) return null
  const t = await getT()
  const title = top.def.tiers ? `${t(top.def.name)} – ${t(LEVEL_NAME[top.level])}` : t(top.def.name)
  const Icon = ICON[top.def.id]
  return (
    <span title={title} aria-label={title} className={`inline-grid h-5 w-5 shrink-0 place-items-center rounded-full ${medalOf(!!top.def.tiers, top.level)}`}>
      <Icon className="h-3 w-3" strokeWidth={2.2} aria-hidden />
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
  // Získané napřed (vyšší úroveň výš), nezískané na konci.
  const shown = BADGES.filter((b) => levels.has(b.id) || values).sort((a, b) => (levels.get(b.id) ?? 0) - (levels.get(a.id) ?? 0))
  if (!shown.length) return null
  const earned = shown.filter((b) => levels.has(b.id)).length
  return (
    <section id="odznaky" className="mt-10 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-fg">{t('Odznaky')}</h2>
        {values && (
          <span className="font-mono text-[12.5px] text-muted">
            {earned} / {BADGES.length}
          </span>
        )}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((b) => {
          const level = levels.get(b.id) ?? 0
          const value = values?.[b.id]
          const next = values ? nextTier(b, Math.max(level, levelFor(b, value ?? 0))) : null
          const Icon = ICON[b.id]
          return (
            <li
              key={b.id}
              className={`flex gap-3.5 rounded-[18px] p-4 transition ${
                level ? 'bg-card shadow-soft ring-1 ring-inset ring-line' : 'border border-dashed border-line-strong bg-transparent'
              }`}
            >
              <span className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full ${medalOf(!!b.tiers, level)}`}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} aria-hidden />
                {!level && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-card text-subtle ring-1 ring-line">
                    <Lock className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold leading-tight ${level ? 'text-fg' : 'text-muted'}`}>{t(b.name)}</p>
                <p className={`mt-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] ${LEVEL_TAG[level ? (b.tiers ? level : 3) : 0]}`}>
                  {level ? (b.tiers ? t(LEVEL_NAME[level]) : t('získáno')) : t('zatím nezískáno')}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-snug text-muted">{t(b.desc)}</p>
                {values && next && value !== undefined && (
                  <div className="mt-2.5">
                    <div className="h-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-blue-dark dark:from-accent dark:to-brand-blue"
                        style={{ width: `${Math.min(100, (Math.max(0, value) / next.min) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11.5px] text-subtle">
                      {t('{value} / {min} do úrovně {level}', { value: Math.max(0, value), min: next.min, level: t(LEVEL_NAME[next.level]) })}
                    </p>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
