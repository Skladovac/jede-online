import { AvatarUpload, PasswordForm, ProfileForm } from '@/components/admin/ProfileForms'
import { requireUser } from '@/lib/auth'

export const metadata = { title: 'Můj profil' }

export default async function ProfilePage() {
  const u = await requireUser()
  return (
    <div>
      <p className="label text-gold-deep">Můj profil</p>
      <h1 className="mt-2 font-serif text-4xl">{u.name}</h1>
      <p className="mt-2 text-sm text-stone">Tyto údaje se ukazují na webu — v patičce, na stránce O nás, v kontaktech a u vašich nemovitostí.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[18rem_1fr]">
        <section className="border border-ink/10 bg-white p-5 sm:p-7">
          <h2 className="font-serif text-2xl">Fotka</h2>
          <AvatarUpload photo={u.photo} name={u.name} />
        </section>
        <section className="border border-ink/10 bg-white p-5 sm:p-7">
          <h2 className="font-serif text-2xl">Údaje na webu</h2>
          <ProfileForm user={{ name: u.name, role: u.role, phone: u.phone, publicEmail: u.publicEmail, bio: u.bio }} />
        </section>
      </div>

      <section className="mt-6 border border-ink/10 bg-white p-5 sm:p-7 lg:max-w-xl">
        <h2 className="font-serif text-2xl">Změna hesla</h2>
        <p className="mt-1 text-sm text-stone">Přihlašovací e-mail: {u.email}</p>
        <PasswordForm />
      </section>
    </div>
  )
}
