import { redirect } from 'next/navigation'
import { requireOrgContext } from '@/lib/org'
import { pragueDayKey } from '@/lib/date'

// Soukromá aplikace: nepřihlášeného pošle na přihlášení, přihlášeného rovnou na dnešní den.
export default async function Home() {
  await requireOrgContext()
  redirect(`/den/${pragueDayKey(new Date())}`)
}
