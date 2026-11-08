import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { pragueDayKey } from '@/lib/date'

// Soukromá aplikace: nepřihlášeného pošle na přihlášení, přihlášeného rovnou na dnešní den.
export default async function Home() {
  await requireUser()
  redirect(`/den/${pragueDayKey(new Date())}`)
}
