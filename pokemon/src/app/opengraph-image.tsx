import { ImageResponse } from 'next/og'
import { OG_SIZE, ogFonts, ogLogo } from '@/lib/og'

export const alt = 'Pokémon karty – sbírka a výměny'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

const TITLE = 'Pokémon karty'
const SUB = 'Vlastní sbírka, chybějící karty a výměny mezi sběrateli z Česka a Slovenska.'
const URL_TEXT = 'pokemon.jede.online · zdarma'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: '#facc15', padding: 80, fontFamily: 'Nunito' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={await ogLogo()} width={300} height={300} alt="" style={{ borderRadius: 60, border: '6px solid #0f172a' }} />
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 64, flex: 1 }}>
          <div style={{ fontSize: 92, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{TITLE}</div>
          <div style={{ fontSize: 40, color: '#1e293b', marginTop: 28, lineHeight: 1.3 }}>{SUB}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#dc2626', marginTop: 36 }}>{URL_TEXT}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts(TITLE + SUB + URL_TEXT) },
  )
}
