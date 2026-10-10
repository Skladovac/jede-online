import 'server-only'
import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { isLimited } from '@/lib/auth'
import { OG_SIZE, cardsCz, ogCardImage, ogFonts, ogLogo } from '@/lib/og'

export type ProfileView = 'hledam' | 'nabizim'

/**
 * Náhled profilu pro Facebook / WhatsApp (1200×630) v tmavém „collector“ stylu webu:
 * „Co hledá X“ (chybějící karty, oranžově) nebo „Co nabízí X“ (nabídky, modře) — koláž nejdražších karet.
 */
export async function profileOgImage(nickname: string, view: ProfileView) {
  const user = await prisma.user.findFirst({ where: { nickname: { equals: nickname, mode: 'insensitive' }, bannedAt: null } })
  const visible = !!user && !isLimited(user)
  const offerWhere = { spareQty: { gt: 0 }, offerType: { not: null }, hiddenAt: null } as const

  let count = 0
  let images: (string | null)[] = []
  if (visible && view === 'hledam') {
    const [c, rows] = await Promise.all([
      prisma.wantItem.count({ where: { userId: user.id } }),
      prisma.wantItem.findMany({
        where: { userId: user.id, card: { imageUrl: { not: null } } },
        select: { card: { select: { imageUrl: true } } },
        orderBy: { card: { priceEur: { sort: 'desc', nulls: 'last' } } },
        take: 12,
      }),
    ])
    count = c
    images = rows.map((r) => r.card.imageUrl)
  } else if (visible) {
    const [c, rows] = await Promise.all([
      prisma.collectionItem.count({ where: { userId: user.id, ...offerWhere } }),
      prisma.collectionItem.findMany({
        where: { userId: user.id, ...offerWhere, card: { imageUrl: { not: null } } },
        select: { card: { select: { imageUrl: true } } },
        orderBy: { card: { priceEur: { sort: 'desc', nulls: 'last' } } },
        take: 12,
      }),
    ])
    count = c
    images = rows.map((r) => r.card.imageUrl)
  }

  // Některé obrázky v katalogu chybí (404) — bereme jen ty, které se opravdu načtou.
  const candidates = [...new Set(images.map(ogCardImage).filter((u): u is string => !!u))]
  const ok = await Promise.all(
    candidates.map((u) =>
      fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
        .then((r) => r.ok && !!r.headers.get('content-type')?.startsWith('image/'))
        .catch(() => false),
    ),
  )
  const imgs = candidates.filter((_, i) => ok[i]).slice(0, 5)

  const want = view === 'hledam'
  const color = want ? '#fb923c' : '#60a5fa'
  const label = want ? '🔍 HLEDÁM' : '🏷️ NABÍZÍM'
  const title = visible ? (want ? `Co hledá ${user.nickname}` : `Co nabízí ${user.nickname}`) : 'Pokémon karty'
  const sub = !visible
    ? 'Sbírka a výměny karet'
    : count
      ? want
        ? `Chybí ${cardsCz(count)}. Máš něco z toho?`
        : `${cardsCz(count)} na prodej a výměnu`
      : want
        ? 'Zatím nic nehledá'
        : 'Zatím nic nenabízí'
  const foot = 'pokemon.jede.online'
  const promo = 'Zdarma: veď si sbírku a najdi, s kým měnit'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(circle at 85% 20%, #1e2350 0%, #0d131c 55%)',
          padding: '52px 60px',
          fontFamily: 'Nunito',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={await ogLogo()} width={96} height={96} alt="" style={{ borderRadius: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 28 }}>
            <div style={{ display: 'flex' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color, border: `2px solid ${color}`, borderRadius: 10, padding: '2px 12px', letterSpacing: 2 }}>{label}</div>
            </div>
            <div style={{ fontSize: 62, fontWeight: 800, color: '#e8edf5', lineHeight: 1.05, marginTop: 10 }}>{title}</div>
            <div style={{ fontSize: 32, color: '#a3afc2', marginTop: 8 }}>{sub}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, marginTop: 34, flex: 1 }}>
          {imgs.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} width={178} height={248} alt="" style={{ borderRadius: 12, border: `4px solid ${color}` }} />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#151d29',
            border: '2px solid rgba(255,255,255,0.10)',
            borderRadius: 16,
            padding: '14px 24px',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, color: '#8b91ff' }}>{foot}</div>
          <div style={{ fontSize: 26, color: '#a3afc2', marginLeft: 20 }}>{promo}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(title + sub + label + foot + promo + '0123456789') },
  )
}
