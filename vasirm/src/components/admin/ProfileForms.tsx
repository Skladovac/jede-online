'use client'

import { startTransition, useActionState, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Upload } from 'lucide-react'
import { changePassword, saveProfile, type AdminState } from '@/app/actions/admin'

function Result({ state }: { state: AdminState }) {
  if (state.error) return <p className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
  if (state.ok)
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-800">
        <Check className="h-4 w-4" aria-hidden /> {state.message}
      </p>
    )
  return null
}

/** Odeslání bez automatického vymazání formuláře (React by ho po akci resetoval i při chybě). */
function useKeepForm(fn: (prev: AdminState, fd: FormData) => Promise<AdminState>) {
  const [state, action, pending] = useActionState<AdminState, FormData>(fn, {})
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => action(fd))
  }
  return { state, pending, onSubmit }
}

type ProfileData = {
  name: string
  role: string
  phone: string
  publicEmail: string
  bio: string
  story: string
  specialties: string[]
  yearsInField: number | null
  soldCount: number | null
  avgSaleDays: number | null
  videoUrl: string | null
}

export function ProfileForm({ user }: { user: ProfileData }) {
  const { state, pending, onSubmit } = useKeepForm(saveProfile)
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Jméno a příjmení</span>
          <input name="name" defaultValue={user.name} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Pozice</span>
          <input name="role" defaultValue={user.role} placeholder="realitní makléřka" className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Telefon</span>
          <input name="phone" defaultValue={user.phone} className="field" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">E-mail na webu</span>
          <input name="publicEmail" type="email" defaultValue={user.publicEmail} className="field" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Krátké představení</span>
        <textarea name="bio" defaultValue={user.bio} rows={3} maxLength={600} className="field" placeholder="1–2 věty. Ukáže se na úvodní stránce, na stránce O nás a nahoře na vaší osobní stránce." />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Můj příběh</span>
        <textarea
          name="story"
          defaultValue={user.story}
          rows={10}
          className="field leading-relaxed"
          placeholder="Jak jste se dostal(a) k realitám, co vás na práci baví, jak pracujete s klienty… Odstavce oddělte prázdným řádkem. První odstavec se zobrazí větším písmem."
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Specializace</span>
        <input
          name="specialties"
          defaultValue={user.specialties.join(', ')}
          className="field"
          placeholder="např. rodinné domy, investiční byty, Zlín – Jižní Svahy"
        />
        <span className="mt-1.5 block text-xs text-stone">Oddělte čárkou, nejvýš 8.</span>
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Čísla na osobní stránce</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs text-stone">Let v realitách</span>
            <input name="yearsInField" inputMode="numeric" defaultValue={user.yearsInField ?? ''} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone">Prodaných nemovitostí</span>
            <input name="soldCount" inputMode="numeric" defaultValue={user.soldCount ?? ''} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stone">Průměrně dní do prodeje</span>
            <input name="avgSaleDays" inputMode="numeric" defaultValue={user.avgSaleDays ?? ''} className="field" />
          </label>
        </div>
        <span className="mt-1.5 block text-xs text-stone">Prázdné pole se na webu neukáže. Uvádějte jen čísla, která umíte doložit.</span>
      </fieldset>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Video představení (nepovinné)</span>
        <input name="videoUrl" defaultValue={user.videoUrl ?? ''} className="field" placeholder="https://www.youtube.com/watch?v=…" />
        <span className="mt-1.5 block text-xs text-stone">Odkaz z YouTube nebo Vimea. Dokud je prázdné, video se na webu nezobrazí.</span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn-ink disabled:opacity-70">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Uložit
        </button>
        <Result state={state} />
      </div>
    </form>
  )
}

export function PasswordForm() {
  const { state, pending, onSubmit } = useKeepForm(changePassword)
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Současné heslo</span>
        <input name="current" type="password" autoComplete="current-password" className="field" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nové heslo (aspoň 10 znaků)</span>
        <input name="next" type="password" autoComplete="new-password" minLength={10} className="field" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nové heslo znovu</span>
        <input name="again" type="password" autoComplete="new-password" className="field" />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className="btn-ink disabled:opacity-70">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Změnit heslo
        </button>
        <Result state={state} />
      </div>
    </form>
  )
}

export function AvatarUpload({ photo, name }: { photo: string | null; name: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [src, setSrc] = useState(photo)
  const input = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/upload?kind=avatar', { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
      const data = await res.json().catch(() => ({ error: 'Server neodpověděl.' }))
      if (!res.ok) throw new Error(data.error)
      setSrc(data.photo)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nahrání se nepovedlo.')
    }
    setBusy(false)
  }

  return (
    <div className="mt-5">
      <div className="aspect-[4/5] w-full overflow-hidden bg-paper-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt={name} className="h-full w-full object-cover" />}
      </div>
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-ghost-dark mt-3 min-h-[2.6rem] w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
        {busy ? 'Nahrávám…' : 'Nahrát novou fotku'}
      </button>
      <p className="mt-2 text-xs text-stone">Ideálně na výšku. Ořízne se automaticky na poměr 4 : 5.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
