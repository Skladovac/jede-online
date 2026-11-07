import { TeamForm } from '@/components/admin/TeamForms'
import { getTeam } from '@/lib/agents'

export const metadata = { title: 'Tým' }

export default async function TeamPage() {
  const team = await getTeam()
  return (
    <div>
      <p className="label text-gold-deep">Tým</p>
      <h1 className="mt-2 font-serif text-4xl">Společné údaje</h1>
      <p className="mt-2 max-w-2xl text-sm text-stone">
        Čísla a příběh za vás oba — na úvodní stránce a na stránce O nás. Vlastní údaje každý z vás upravuje ve svém profilu.
      </p>
      <section className="mt-8 max-w-3xl border border-ink/10 bg-white p-5 sm:p-7">
        <TeamForm team={{ yearsInField: team.yearsInField, soldCount: team.soldCount, avgSaleDays: team.avgSaleDays, story: team.story }} />
      </section>
    </div>
  )
}
