import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { APP_URL } from '@/lib/email'
import { toggleFollow } from '@/app/actions/follow'
import { CopyLink } from '@/components/CopyLink'
import { BadgeIcon } from '@/components/Badges'
import { INVITE_MIN_CARDS } from '@/lib/social'
import { getT } from '@/lib/i18n/server'

/** Tlačítko Sledovat / Sleduješ na profilu (nepřihlášeného pošle na přihlášení). */
export async function FollowButton({ userId, following }: { userId: string; following: boolean }) {
  const t = await getT()
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="userId" value={userId} />
      <button
        className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
          following
            ? 'border border-line-strong text-muted hover:border-red-400 hover:text-red-600'
            : 'bg-accent-strong text-on-accent hover:bg-accent-hover'
        }`}
      >
        {following ? `✓ ${t('Sleduješ')}` : `👀 ${t('Sledovat')}`}
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
    <section id="pozvi" className="scroll-mt-24 rounded-panel border-2 border-line-strong bg-accent-soft p-5">
      <h2 className="text-lg font-bold">📣 {t('Pozvi kamaráda')}</h2>
      <p className="mt-1 text-sm text-muted">
        {t('Pošli odkaz kamarádům nebo do skupiny. Až si pozvaný potvrdí e-mail a přidá aspoň {n} karet, započítá se ti a získáš odznak Ambasador. Budete se navzájem sledovat.', {
          n: INVITE_MIN_CARDS,
        })}
      </p>
      <div className="mt-3">
        <CopyLink url={`${APP_URL}/pozvanka/${encodeURIComponent(nickname)}`} title={t('Pojď sbírat Pokémon karty se mnou!')} />
      </div>
      <p className="mt-2 text-sm">
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
    <section className="rounded-panel border border-line bg-card p-5">
      <h2 className="text-lg font-bold">👀 {t('Sleduji')}</h2>
      <p className="mt-1 text-sm text-subtle">
        {t('Jednou denně ti do zvonečku přijde, co nového nabídli. Sleduje tě: {count}', { count: followers })}
      </p>
      {rows.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {rows.map(({ following: f }) => (
            <li key={f.nickname}>
              <Link
                href={`/@${encodeURIComponent(f.nickname)}`}
                className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1 text-sm hover:border-line-strong"
              >
                <span className="font-semibold">{f.nickname}</span>
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
