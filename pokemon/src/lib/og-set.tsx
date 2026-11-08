import 'server-only'
import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/prisma'
import { APP_URL, ogCardImage, ogFonts, ogLogo } from '@/lib/og'
import { byLocalId, setDisplayName } from '@/lib/format'
import { isBaseCard } from '@/lib/card-number'
import { setGoals, setProgress } from '@/lib/progress'
import { defaultGoal, pickGoal } from '@/lib/goal'
import type { TFunc } from '@/lib/i18n/config'

/**
 * Obrázky ke sdílení ze stránky sady (na výšku 1080×1350 — Instagram, WhatsApp, Facebook):
 * „postup“ = mozaika sady s tím, co mám, „chybi“ = seznam chybějících karet s prosbou o pomoc.
 * Uživatel si je stáhne nebo pošle přes systémové sdílení; nejsou veřejné.
 */
export const SHARE_SIZE = { width: 1080, height: 1350 }
export type ShareKind = 'postup' | 'chybi'

const INK = '#0d131c'
const YELLOW = '#ffcb05'
const TEXT = '#e8edf5'
const MUTED = '#a3afc2'
const PANEL = '#151d29'

/** Obrázek jako data URI — satori pak nic nestahuje sám a chybějící soubor (404) obrázek neshodí. */
async function dataUri(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/') || type.includes('webp')) return null
    return `data:${type.split(';')[0]};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

/** Stáhne obrázky po osmi najednou (nginx keš to zvládne, ale 80 požadavků naráz ne). */
async function fetchAll(urls: (string | null)[], limit = 8) {
  const out: (string | null)[] = new Array(urls.length).fill(null)
  let i = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < urls.length) {
        const n = i++
        out[n] = await dataUri(urls[n])
      }
    }),
  )
  return out
}

/** Logo sady jako PNG z naší keše (satori neumí webp). */
function logoPng(url: string | null) {
  if (!url) return null
  if (url.startsWith('/')) return `${APP_URL}${url}`
  if (url.startsWith('https://assets.tcgdex.net/')) return `${APP_URL}/img/${url.slice('https://assets.tcgdex.net/'.length)}.png`
  if (url.startsWith('https://images.pokemontcg.io/')) return `${APP_URL}/img2/${url.slice('https://images.pokemontcg.io/'.length)}`
  return null
}

// Hlavička (logo webu, název sady, logo sady) a patička (přezdívka, adresa webu) jsou u obou obrázků stejné.
function Header({ siteLogo, setLogo, title, sub }: { siteLogo: string; setLogo: string | null; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={siteLogo} width={72} height={72} alt="" style={{ borderRadius: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 24, color: MUTED, marginTop: 6 }}>{sub}</div>
        </div>
      </div>
      {setLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={setLogo} alt="" style={{ maxWidth: 260, maxHeight: 120, objectFit: 'contain' }} />
      )}
    </div>
  )
}

function Footer({ nickname, text }: { nickname: string; text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: PANEL,
        border: '2px solid rgba(255,255,255,0.10)',
        borderRadius: 18,
        padding: '16px 24px',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 52,
          height: 52,
          borderRadius: 26,
          background: YELLOW,
          color: INK,
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        {nickname.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>{nickname}</div>
        <div style={{ fontSize: 22, color: MUTED }}>{text}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#8b91ff', marginLeft: 'auto' }}>pokemon.jede.online</div>
    </div>
  )
}

export async function setShareImage(user: { id: string; nickname: string }, setId: string, kind: ShareKind, t: TFunc) {
  const set = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true, name: true, logoUrl: true, officialCount: true } })
  if (!set) return null
  const [cards, items] = await Promise.all([
    prisma.card.findMany({ where: { setId }, select: { id: true, localId: true, name: true, imageUrl: true } }),
    prisma.collectionItem.findMany({ where: { userId: user.id, quantity: { gt: 0 }, card: { setId } }, select: { cardId: true } }),
  ])
  // Postup se počítá na základní sadu (1–oficiální počet); u promo sad bez číslování na všechny karty.
  const base = (set.officialCount ? cards.filter((c) => isBaseCard(c.localId, set.officialCount)) : cards).sort(byLocalId)
  const ownedIds = new Set(items.map((i) => i.cardId))
  const owned = base.filter((c) => ownedIds.has(c.id))
  const missing = base.filter((c) => !ownedIds.has(c.id))
  const total = base.length
  // Hlavní číslo podle cíle, který si uživatel u sady zvolil (base / complete / master); mozaika je vždy po kartách.
  const [progressMap, goals] = await Promise.all([setProgress(user.id, [setId]), setGoals(user.id, [setId])])
  const prog = progressMap.get(setId)!
  const goal = goals.get(setId) ?? defaultGoal(prog)
  const picked = pickGoal(prog, goal)
  const pct = picked.total ? Math.round((picked.owned / picked.total) * 100) : 0
  const name = setDisplayName(set)
  const [siteLogo, setLogo] = await Promise.all([ogLogo(), dataUri(logoPng(set.logoUrl))])

  const W = SHARE_SIZE.width - 2 * 56
  let body: React.ReactNode
  let texts: string

  if (kind === 'postup') {
    // Mozaika: každá karta jeden dílek. Sloupců tolik, aby se všechny řádky vešly na výšku (max. ~760 px).
    const GAP = 6
    const gridH = 760
    let cols = 6
    for (; cols < 40; cols++) {
      const cellW = (W - GAP * (cols - 1)) / cols
      const rows = Math.ceil(total / cols)
      if (rows * (cellW * (88 / 63) + GAP) - GAP <= gridH) break
    }
    const cellW = Math.floor((W - GAP * (cols - 1)) / cols)
    const cellH = Math.floor(cellW * (88 / 63))
    // Obrázky jen pro karty, které mám (do 80 kusů — víc by trvalo dlouho); ostatní dílky jsou barevné.
    const withImage = new Set(owned.slice(0, 80).map((c) => c.id))
    const imgs = await fetchAll(base.map((c) => (withImage.has(c.id) ? ogCardImage(c.imageUrl) : null)))
    const numSize = Math.max(11, Math.min(18, Math.floor(cellW / 3.4)))

    const sub =
      goal === 'master' ? t('Mám {n} z {total} variant', { n: picked.owned, total: picked.total }) : t('Mám {n} z {total} karet', { n: picked.owned, total: picked.total })
    const done = t('hotovo')
    const foot = t('Veď si sbírku a najdi, s kým měnit — zdarma.')
    texts = name + sub + done + foot + user.nickname + 'pokemon.jede.online%/0123456789'
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header siteLogo={siteLogo} setLogo={setLogo} title={name} sub={t('Moje sbírka')} />
        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 36 }}>
          <div style={{ fontSize: 112, fontWeight: 800, color: TEXT, lineHeight: 0.95 }}>{String(picked.owned)}</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: MUTED, marginLeft: 10, marginBottom: 8 }}>{`/ ${picked.total}`}</div>
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 'auto', alignItems: 'flex-end', marginBottom: 8 }}>
            <div style={{ fontSize: 60, fontWeight: 800, color: YELLOW, lineHeight: 1 }}>{`${pct} %`}</div>
            <div style={{ fontSize: 24, color: MUTED, marginTop: 4 }}>{done}</div>
          </div>
        </div>
        <div style={{ fontSize: 26, color: MUTED, marginTop: 8 }}>{sub}</div>
        <div style={{ display: 'flex', width: W, height: 20, borderRadius: 10, background: PANEL, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ width: Math.max(pct ? 20 : 0, (W * pct) / 100), height: 20, background: YELLOW, borderRadius: 10 }} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, marginTop: 28, width: W }}>
          {base.map((c, i) => {
            const has = ownedIds.has(c.id)
            const img = imgs[i]
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: cellW,
                  height: cellH,
                  borderRadius: Math.max(4, cellW / 10),
                  overflow: 'hidden',
                  background: img ? PANEL : has ? YELLOW : '#1a2332',
                  border: has ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: has ? INK : '#4b5a6e',
                  fontSize: numSize,
                  fontWeight: 800,
                }}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} width={cellW} height={cellH} alt="" style={{ objectFit: 'cover' }} />
                ) : (
                  c.localId
                )}
              </div>
            )
          })}
        </div>
        <Footer nickname={user.nickname} text={foot} />
      </div>
    )
  } else {
    // Seznam chybějících: nejvýš 60 položek ve sloupcích, zbytek „+ dalších N“.
    const MAX = 60
    const shown = missing.slice(0, MAX)
    const cols = shown.length <= 20 ? 1 : shown.length <= 40 ? 2 : 3
    const perCol = Math.ceil(shown.length / cols)
    const columns = Array.from({ length: cols }, (_, i) => shown.slice(i * perCol, (i + 1) * perCol))
    const fontSize = cols === 1 ? 30 : cols === 2 ? 26 : 22
    const title = t('Chybí mi {n} karet', { n: missing.length })
    const sub = t('Mám {n} z {total} karet', { n: owned.length, total })
    const more = missing.length > MAX ? t('+ dalších {n}', { n: missing.length - MAX }) : ''
    const foot = t('Máš něco z toho? Napiš mi.')
    texts = name + title + sub + more + foot + user.nickname + shown.map((c) => `${c.localId} ${c.name}`).join('') + 'pokemon.jede.online/0123456789'
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Header siteLogo={siteLogo} setLogo={setLogo} title={name} sub={sub} />
        <div style={{ fontSize: 64, fontWeight: 800, color: '#fb923c', marginTop: 36, lineHeight: 1.05 }}>{title}</div>
        <div style={{ display: 'flex', marginTop: 28, gap: 24 }}>
          {columns.map((col, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              {col.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', fontSize, lineHeight: 1.45, color: TEXT }}>
                  <div style={{ color: YELLOW, fontWeight: 800, width: cols === 1 ? 90 : 72, flexShrink: 0 }}>{c.localId}</div>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        {more && <div style={{ fontSize: 26, color: MUTED, marginTop: 16 }}>{more}</div>}
        <Footer nickname={user.nickname} text={foot} />
      </div>
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(circle at 85% 10%, #1e2350 0%, #0d131c 50%)',
          padding: 56,
          fontFamily: 'Nunito',
        }}
      >
        {body}
      </div>
    ),
    { ...SHARE_SIZE, fonts: await ogFonts(texts) },
  )
}
