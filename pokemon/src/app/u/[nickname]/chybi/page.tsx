import { permanentRedirect } from 'next/navigation'

/** Dřívější sdílecí odkaz „Co hledá“ — teď je to profil s přepínačem Nabízí / Hledá. */
export default async function WantedRedirect({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = await params
  permanentRedirect(`/@${nickname}?ukaz=hledam`)
}
