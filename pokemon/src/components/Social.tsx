import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { APP_URL } from '@/lib/email'
import { toggleFollow } from '@/app/actions/follow'
import { CopyLink } from '@/components/CopyLink'
import { BadgeIcon } from '@/components/Badges'
import { INVITE_MIN_CARDS } from '@/lib/social'
import { getT } from '@/lib/i18n/server'
import { panel } from '@/components/design'
import { Check, Eye, Megaphone } from 'lucide-react'

/** Tlačítko Sledovat / Sleduješ na profilu (nepřihlášeného pošle na přihlášení). */
export async function FollowButton({ userId, following }: { userId: string; following: boolean }) {
  const t = await getT()
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="userId" value={userId} />
      <button
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
          following
            ? 'text-muted shadow-[inset_0_0_0_1px_var(--border-strong)] hover:text-danger'
            : 'bg-[var(--ink)] text-white hover:bg-[#1b2c45] dark:bg-white dark:text-[var(--ink)] dark:hover:bg-[#e6ebf3]'
        }`}
      >
        {following ? <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden /> : <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
        {following ? t('Sleduješ') : t('Sledovat')}
      </button>
    </form>
  )
}

/** „Pozvi kamaráda“: osobní odkaz a kolik pozvaných se už započítalo. */
export async function InviteBox({ userId, nickname }: { userId: string; nickname: string }) {
  const t = await getT()
  const [counted, pending] = await Promise.all([
    prisma.user.count({ where: { invitedById: userId, inviteCountedAt: { not: null } } }),
    prisma.user.count({ where: { invitedById: userId, inviteCountedAt: null } }),
  ])
  return (
    <section id="pozvi" className={`${panel} scroll-mt-24 p-5`}>
      <h2 className="flex items-center gap-3 text-xl font-bold text-fg">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--ink)] text-brand-yellow dark:bg-brand-yellow dark:text-[var(--ink)]">
          <Megaphone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        {t('Pozvi kamaráda')}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {t('Pošli odkaz kamarádům nebo do skupiny. Až si pozvaný potvrdí e-mail a přidá aspoň {n} karet, započítá se ti a získáš odznak Ambasador. Budete se navzájem sledovat.', {
          n: INVITE_MIN_CARDS,
        })}
      </p>
      <div className="mt-3">
        <CopyLink url={`${APP_URL}/pozvanka/${encodeURIComponent(nickname)}`} title={t('Pojď sbírat Pokémon karty se mnou!')} />
      </div>
      <p className="mt-2 text-sm tabular-nums text-fg">
        {t('Započítaní: {counted}', { counted })}
        {pending > 0 && ` · ${t('čeká na splnění: {pending}', { pending })}`}
      </p>
    </section>
  )
}

/** Seznam sledovaných sběratelů (Můj účet). */
export async function FollowingList({ userId }: { userId: string }) {
  const t = await getT()
  const rows = await prisma.follow.findMany({
    where: { followerId: userId, following: { bannedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { following: { select: { nickname: true, city: true, region: true } } },
  })
  const followers = await prisma.follow.count({ where: { followingId: userId } })
  return (
    <section className={`${panel} p-5`}>
      <h2 className="flex items-center gap-2 text-xl font-bold text-fg">
        <Eye className="h-5 w-5 text-accent" strokeWidth={1.75} aria-hidden />
        {t('Sleduji')}
      </h2>
      <p className="mt-1 text-sm text-subtle">
        {t('Jednou denně ti do zvonečku přijde, co nového nabídli. Sleduje tě: {count}', { count: followers })}
      </p>
      {rows.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rows.map(({ following: f }) => (
            <li key={f.nickname}>
              <Link
                href={`/@${encodeURIComponent(f.nickname)}`}
                className="flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1 text-sm transition-colors hover:bg-card-hover"
              >
                <span className="font-semibold text-fg">{f.nickname}</span>
                <BadgeIcon nickname={f.nickname} />
                {(f.city || f.region) && <span className="text-xs text-subtle">{f.city ?? f.region}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">{t('Zatím nikoho nesleduješ. Na profilu sběratele klikni na „Sledovat“.')}</p>
      )}
    </section>
  )
}
