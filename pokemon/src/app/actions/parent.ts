'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { str, type FormState } from '@/lib/validation'

// Rodič se nepřihlašuje — autorizací je tajný odkaz z e-mailu (parentToken).
async function childByToken(fd: FormData) {
  const token = str(fd, 'token')
  if (!token) return null
  return prisma.user.findUnique({ where: { parentToken: token } })
}

export async function giveConsent(_: FormState, fd: FormData): Promise<FormState> {
  const child = await childByToken(fd)
  if (!child) return { error: 'Odkaz neplatí.' }
  // Dítě přihlášené ve stejném prohlížeči si souhlas samo udělit nemůže.
  if ((await getCurrentUser())?.id === child.id)
    return { error: 'Souhlas musí udělit rodič ze svého zařízení. Dítě se nejdřív musí odhlásit.' }
  const name = str(fd, 'parentName')
  if (name.length < 3 || name.length > 80) return { error: 'Napište prosím své jméno a příjmení.' }
  if (fd.get('confirm') !== 'on') return { error: 'Potvrďte prosím, že jste zákonný zástupce a souhlasíte.' }
  await prisma.user.update({
    where: { id: child.id },
    data: {
      parentConsentAt: new Date(),
      parentConsentName: name,
      indexable: fd.get('indexable') === 'on',
      // Odkazy, které dítě už vyplnilo, schvaluje rodič zvlášť (viz níže) — souhlas s účtem je nezahrnuje.
    },
  })
  revalidatePath(`/rodic/${child.parentToken}`)
  return { ok: 'Děkujeme, souhlas je udělen. Účet je plně funkční.' }
}

export async function updateParentSettings(_: FormState, fd: FormData): Promise<FormState> {
  const child = await childByToken(fd)
  if (!child) return { error: 'Odkaz neplatí.' }
  const approveLinks = fd.get('approveLinks') === 'on'
  const clearLinks = fd.get('clearLinks') === 'on'
  await prisma.user.update({
    where: { id: child.id },
    data: {
      indexable: fd.get('indexable') === 'on',
      ...(clearLinks
        ? { facebookUrl: null, instagramUrl: null, aukroUrl: null, linksApprovedAt: null }
        : { linksApprovedAt: approveLinks ? (child.linksApprovedAt ?? new Date()) : null }),
      ...(fd.get('clearCity') === 'on' && { city: null }),
    },
  })
  revalidatePath(`/rodic/${child.parentToken}`)
  return { ok: 'Nastavení uloženo.' }
}

export async function revokeConsent(_: FormState, fd: FormData): Promise<FormState> {
  const child = await childByToken(fd)
  if (!child) return { error: 'Odkaz neplatí.' }
  await prisma.user.update({
    where: { id: child.id },
    data: { parentConsentAt: null, parentConsentName: null, indexable: false, linksApprovedAt: null },
  })
  await prisma.session.deleteMany({ where: { userId: child.id } })
  revalidatePath(`/rodic/${child.parentToken}`)
  return { ok: 'Souhlas byl odvolán. Účet je znovu omezený a dítě bylo odhlášeno.' }
}

export async function parentDeleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const child = await childByToken(fd)
  if (!child) return { error: 'Odkaz neplatí.' }
  if (str(fd, 'confirmNick') !== child.nickname) return { error: 'Pro potvrzení opište přesně přezdívku účtu.' }
  await prisma.user.delete({ where: { id: child.id } })
  redirect('/?smazano=1')
}
