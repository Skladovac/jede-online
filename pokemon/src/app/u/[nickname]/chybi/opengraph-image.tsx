import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { safeDecode } from '@/lib/validation'
import { isLimited } from '@/lib/auth'
import { OG_SIZE, cardsCz, ogCardImage, ogFonts, ogLogo } from '@/lib/og'

export const alt = 'Co hledá sběratel na pokemon.jede.online'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ nickname: string }> }) {
  const nickname = (safeDecode((await params).nickname) ?? '')
  const user = await prisma.user.findFirst({
    where: { nickname: { equals: nickname, mode: 'insensitive' }, bannedAt: null },
  })
  const visible = user && !isLimited(user)
  const [count, wants] = visible
    ? await Promise.all([
        prisma.wantItem.count({ where: { userId: user.id } }),
        // Náhled: nejdražší chybějící karty vypadají nejlákavěji.
        prisma.wantItem.findMany({
          where: { userId: user.id, card: { imageUrl: { not: null } } },
          include: { card: { select: { imageUrl: true } } },
          orderBy: { card: { priceEur: { sort: 'desc', nulls: 'last' } } },
          take: 12,
        }),
      ])
    : [0, []]
  // Některé obrázky v katalogu chybí (404) — bereme jen ty, které se opravdu načtou.
  const candidates = wants.map((w) => ogCardImage(w.card.imageUrl)).filter((u): u is string => !!u)
  const ok = await Promise.all(
    candidates.map((u) =>
      fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
        .then((r) => r.ok && !!r.headers.get('content-type')?.startsWith('image/'))
        .catch(() => false),
    ),
  )
  const imgs = candidates.filter((_, i) => ok[i]).slice(0, 5)

  const title = visible ? `Co hledá ${user.nickname}` : 'Pokémon karty'
  const sub = visible ? `Chybí ${cardsCz(count)}. Máš něco z toho?` : 'Sbírka a výměny karet'
  const foot = 'pokemon.jede.online'
  const promo = 'Zdarma: veď si sbírku a najdi, s kým měnit'

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', padding: '56px 64px', fontFamily: 'Nunito' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={await ogLogo()} width={110} height={110} alt="" />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 32 }}>
            <div style={{ fontSize: 68, fontWeight: 800, color: '#facc15', lineHeight: 1 }}>{title}</div>
            <div style={{ fontSize: 36, color: '#e2e8f0', marginTop: 14 }}>{sub}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 36, flex: 1 }}>
          {imgs.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} width={180} height={251} alt="" style={{ borderRadius: 12, border: '5px solid #fb923c' }} />
          ))}
        </div>
        {/* Promo pruh: kdo náhled uvidí, má hned vědět, co je to za web. */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#facc15', borderRadius: 18, padding: '14px 26px', margin: '0 -8px' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a' }}>{foot}</div>
          <div style={{ fontSize: 28, color: '#1e293b', marginLeft: 20 }}>{promo}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(title + sub + foot + promo + '0123456789') },
  )
}
