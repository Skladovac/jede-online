'use server'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { notifyLead } from '@/lib/email'
import { formatPrice } from '@/lib/format'

export type FormState = { ok?: boolean; error?: string; fields?: Record<string, string>; values?: Record<string, string> }

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max)

/** Při chybě vrátit i vyplněné hodnoty — React po odeslání formulář vymaže a pole by zůstala prázdná. */
function withValues(fd: FormData, state: FormState): FormState {
  if (!state.error) return state
  const values: Record<string, string> = {}
  for (const [k, v] of fd.entries()) if (typeof v === 'string' && !k.startsWith('$')) values[k] = v.slice(0, 3000)
  return { ...state, values }
}

/** Společné kontroly všech veřejných formulářů. Vrací chybu, 'bot', nebo kontaktní údaje. */
async function common(fd: FormData) {
  // Past na roboty: skryté pole vyplní jen robot; formulář odeslaný do 3 s po načtení taky.
  const started = Number(fd.get('ts'))
  if (str(fd, 'web') || (started && Date.now() - started < 3000)) return 'bot' as const
  if (!rateLimit(`lead:${await clientIp()}`, 6, 10 * 60_000)) {
    return { error: 'Odeslali jste několik zpráv za sebou. Zkuste to prosím za pár minut, nebo nám zavolejte.' }
  }
  const name = str(fd, 'name', 100)
  const phone = str(fd, 'phone', 40)
  const email = str(fd, 'email', 120).toLowerCase()
  const fields: Record<string, string> = {}
  if (name.length < 2) fields.name = 'Vyplňte prosím jméno.'
  if (!phone && !email) fields.phone = 'Zadejte telefon nebo e-mail, ať se vám můžeme ozvat.'
  if (phone && phone.replace(/\D/g, '').length < 9) fields.phone = 'Telefon nevypadá úplně — zkontrolujte ho prosím.'
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = 'E-mail nevypadá správně.'
  if (fd.get('consent') !== 'on') fields.consent = 'Bez souhlasu vám nemůžeme odpovědět.'
  if (Object.keys(fields).length) return { error: 'Zkontrolujte prosím označená pole.', fields }
  return { name, phone, email }
}

async function save(data: Prisma.LeadUncheckedCreateInput) {
  return prisma.lead.create({ data })
}

/** Zájem o prohlídku z detailu nemovitosti. */
export async function submitViewing(_: FormState, fd: FormData): Promise<FormState> {
  return withValues(fd, await submitViewingInner(fd))
}

async function submitViewingInner(fd: FormData): Promise<FormState> {
  const c = await common(fd)
  if (c === 'bot') return { ok: true }
  if ('error' in c) return c
  const listing = await prisma.listing.findUnique({
    where: { id: str(fd, 'listingId', 40) },
    select: { id: true, title: true, locality: true, slug: true, price: true, agentId: true },
  })
  if (!listing) return { error: 'Nemovitost už není v nabídce.' }
  const message = str(fd, 'message', 2000)
  const lead = await save({ type: 'VIEWING', ...c, message, listingId: listing.id, source: `/nabidka/${listing.slug}` })
  await notifyLead({
    subject: `Prohlídka: ${listing.title}, ${listing.locality}`,
    rows: [
      ['Nemovitost', `${listing.title}, ${listing.locality} (${formatPrice(listing.price)})`],
      ['Jméno', c.name],
      ['Telefon', c.phone],
      ['E-mail', c.email],
      ['Zpráva', message],
    ],
    replyTo: c.email ? { email: c.email, name: c.name } : undefined,
    agentId: listing.agentId,
    adminPath: `/admin/poptavky?id=${lead.id}`,
  })
  return { ok: true }
}

const VALUATION_TYPES = ['Byt', 'Rodinný dům', 'Pozemek', 'Chata / chalupa', 'Komerční', 'Jiné']
const CONDITIONS = ['Novostavba', 'Velmi dobrý', 'Dobrý', 'Před rekonstrukcí']
const TIMINGS = ['Co nejdříve', 'Do 3 měsíců', 'Do roka', 'Jen zjišťuji cenu']

/** Odhad ceny zdarma (vícekrokový formulář). */
export async function submitValuation(_: FormState, fd: FormData): Promise<FormState> {
  return withValues(fd, await submitValuationInner(fd))
}

async function submitValuationInner(fd: FormData): Promise<FormState> {
  const c = await common(fd)
  if (c === 'bot') return { ok: true }
  if ('error' in c) return c
  const pick = (k: string, allowed: string[]) => {
    const v = str(fd, k, 60)
    return allowed.includes(v) ? v : ''
  }
  const data = {
    typ: pick('propertyType', VALUATION_TYPES),
    lokalita: str(fd, 'locality', 160),
    plocha: str(fd, 'area', 12).replace(/[^\d]/g, ''),
    pozemek: str(fd, 'landArea', 12).replace(/[^\d]/g, ''),
    dispozice: str(fd, 'disposition', 20),
    stav: pick('condition', CONDITIONS),
    kdy: pick('timing', TIMINGS),
  }
  if (!data.lokalita) return { error: 'Doplňte prosím, kde nemovitost je.', fields: { locality: 'Kde se nemovitost nachází?' } }
  const message = str(fd, 'message', 2000)
  const lead = await save({ type: 'VALUATION', ...c, message, data, source: '/odhad-nemovitosti-zdarma' })
  await notifyLead({
    subject: `Odhad ceny: ${data.typ || 'nemovitost'}, ${data.lokalita}`,
    rows: [
      ['Typ', data.typ],
      ['Lokalita', data.lokalita],
      ['Plocha', data.plocha && `${data.plocha} m²`],
      ['Pozemek', data.pozemek && `${data.pozemek} m²`],
      ['Dispozice', data.dispozice],
      ['Stav', data.stav],
      ['Prodej', data.kdy],
      ['Jméno', c.name],
      ['Telefon', c.phone],
      ['E-mail', c.email],
      ['Poznámka', message],
    ],
    replyTo: c.email ? { email: c.email, name: c.name } : undefined,
    adminPath: `/admin/poptavky?id=${lead.id}`,
  })
  return { ok: true }
}

/** Obecný dotaz z kontaktní stránky. */
export async function submitContact(_: FormState, fd: FormData): Promise<FormState> {
  return withValues(fd, await submitContactInner(fd))
}

async function submitContactInner(fd: FormData): Promise<FormState> {
  const c = await common(fd)
  if (c === 'bot') return { ok: true }
  if ('error' in c) return c
  const message = str(fd, 'message', 3000)
  if (message.length < 5) return { error: 'Napište nám prosím, s čím vám můžeme pomoci.', fields: { message: 'Napište prosím zprávu.' } }
  const lead = await save({ type: 'CONTACT', ...c, message, source: str(fd, 'source', 120) || '/kontakt' })
  await notifyLead({
    subject: `Dotaz z webu: ${c.name}`,
    rows: [
      ['Jméno', c.name],
      ['Telefon', c.phone],
      ['E-mail', c.email],
      ['Zpráva', message],
    ],
    replyTo: c.email ? { email: c.email, name: c.name } : undefined,
    adminPath: `/admin/poptavky?id=${lead.id}`,
  })
  return { ok: true }
}
