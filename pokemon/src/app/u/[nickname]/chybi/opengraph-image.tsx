import { safeDecode } from '@/lib/validation'
import { OG_SIZE } from '@/lib/og'
import { profileOgImage } from '@/lib/og-profile'

export const alt = 'Co hledá sběratel na pokemon.jede.online'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ nickname: string }> }) {
  return profileOgImage(safeDecode((await params).nickname) ?? '', 'hledam')
}
