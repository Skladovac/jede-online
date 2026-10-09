'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, sha256 } from '@/lib/auth'
import { str, type FormState } from '@/lib/validation'
import { getT } from '@/lib/i18n/server'
import { refreshBadgesSafe } from '@/lib/badges'

// Rodič se nepřihlašuje — autorizací je tajný odkaz z e-mailu (parentToken).
async function childByToken(fd: FormData) {
  const token = str(fd, 'token')
  if (!token) return null
  // V DB je jen otisk odkazu.
  return prisma.user.findUnique({ where: { parentToken: sha256(token) } })
}

export async function giveConsent(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const child = await childByToken(fd)
  if (!child) return { error: t('Odkaz neplatí.') }
  // Dítě přihlášené ve stejném prohlížeči si souhlas samo udělit nemůže.
  if ((await getCurrentUser())?.id === child.id)
    return { error: t('Souhlas musí udělit rodič ze svého zařízení. Dítě se nejdřív musí odhlásit.') }
  const name = str(fd, 'parentName')
  if (name.length < 3 || name.length > 80) return { error: t('Napište prosím své jméno a příjmení.') }
  if (fd.get('confirm') !== 'on') return { error: t('Potvrďte prosím, že jste zákonný zástupce a souhlasíte.') }
  await prisma.user.update({
    where: { id: child.id },
    data: {
      parentConsentAt: new Date(),
      parentConsentName: name,
      indexable: fd.get('indexable') === 'on',
      // Odkazy, které dítě už vyplnilo, schvaluje rodič zvlášť (viz níže) — souhlas s účtem je nezahrnuje.
    },
  })
  await refreshBadgesSafe(child.id)
  revalidatePath(`/rodic/${str(fd, 'token')}`)
  return { ok: t('Děkujeme, souhlas je udělen. Účet je plně funkční.') }
}

export async function updateParentSettings(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const child = await childByToken(fd)
  if (!child) return { error: t('Odkaz neplatí.') }
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
  revalidatePath(`/rodic/${str(fd, 'token')}`)
  return { ok: t('Nastavení uloženo.') }
}

export async function revokeConsent(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const child = await childByToken(fd)
  if (!child) return { error: t('Odkaz neplatí.') }
  await prisma.user.update({
    where: { id: child.id },
    data: { parentConsentAt: null, parentConsentName: null, indexable: false, linksApprovedAt: null },
  })
  await prisma.session.deleteMany({ where: { userId: child.id } })
  revalidatePath(`/rodic/${str(fd, 'token')}`)
  return { ok: t('Souhlas byl odvolán. Účet je znovu omezený a dítě bylo odhlášeno.') }
}

export async function parentDeleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT()
  const child = await childByToken(fd)
  if (!child) return { error: t('Odkaz neplatí.') }
  if (str(fd, 'confirmNick') !== child.nickname) return { error: t('Pro potvrzení opište přesně přezdívku účtu.') }
  await prisma.user.delete({ where: { id: child.id } })
  redirect('/?smazano=1')
}
