import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { SITE } from '@/lib/site'

/** Veřejné údaje makléře (nikdy heslo ani přihlašovací e-mail). */
export const agentSelect = {
  id: true,
  name: true,
  slug: true,
  role: true,
  phone: true,
  publicEmail: true,
  bio: true,
  story: true,
  specialties: true,
  yearsInField: true,
  soldCount: true,
  avgSaleDays: true,
  videoUrl: true,
  photo: true,
} as const

/** Makléři pro web (patička, O nás, kontakty, osobní stránky). Bez hesel a přihlašovacích údajů. */
export const getAgents = cache(() => prisma.user.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: agentSelect }))

export const getAgentBySlug = cache((slug: string) => prisma.user.findUnique({ where: { slug }, select: agentSelect }))

export type Agent = Awaited<ReturnType<typeof getAgents>>[number]

export const agentHref = (a: Pick<Agent, 'slug'>) => `/makleri/${a.slug}`
export const firstName = (a: Pick<Agent, 'name'>) => a.name.split(' ')[0]
/** Rod podle pozice („makléřka“) — kvůli tvarům „prodal/prodala“. */
export const isFemale = (a: Pick<Agent, 'role'>) => /ka$/i.test(a.role.trim().split(' ').pop() ?? '')

/** Krátké představení: vlastní text z administrace, jinak jen ověřená fakta. */
export function agentIntro(a: Agent) {
  if (a.bio.trim()) return a.bio.trim()
  const years = a.yearsInField ? ` V realitách působí více než ${a.yearsInField} let.` : ''
  return `${firstName(a)} je ${a.role} VRM pro ${SITE.region}.${years}`
}

/** Společné údaje týmu (jediný řádek; když chybí, bere se prázdný). */
export const getTeam = cache(async () => {
  const t = await prisma.teamSettings.findUnique({ where: { id: 1 } })
  return t ?? { id: 1, yearsInField: null, soldCount: null, avgSaleDays: null, story: '' }
})

export type Stat = { value: string; label: string }

/** Čísla k zobrazení — jen vyplněné hodnoty, nic se nedomýšlí. */
export function statsOf(s: { yearsInField: number | null; soldCount: number | null; avgSaleDays: number | null }): Stat[] {
  const out: Stat[] = []
  if (s.yearsInField) out.push({ value: `${s.yearsInField}+`, label: 'let v realitách' })
  if (s.soldCount) out.push({ value: `${s.soldCount}+`, label: 'prodaných nemovitostí' })
  if (s.avgSaleDays) out.push({ value: `${s.avgSaleDays}`, label: s.avgSaleDays < 5 ? 'dny průměrně do prodeje' : 'dní průměrně do prodeje' })
  return out
}
