import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hledání člena firmy pro stránku historie změn. Stránky se netestují, takže smazání `orgId` z dotazu
// uvnitř stránky by nic neshodilo — a správce by viděl auditní stopu cizí firmy. Proto je hledání
// v téhle funkci a tenhle test je to, co takovou změnu odhalí.
vi.mock('server-only', () => ({}))
const db = vi.hoisted(() => ({ membership: { findFirst: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { findOrgMemberName } from '@/lib/org-member'

describe('findOrgMemberName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Věrná náhrada databáze: řádek m-b patří firmě o2 a vrátí se, pokud ho `where` nevylučuje.
    // Dotaz BEZ orgId by ho tedy našel; jen dotaz s orgId aktivní firmy o1 ne.
    db.membership.findFirst.mockImplementation(async ({ where }: { where: { id: string; orgId?: string; active?: boolean } }) => {
      const radky = [
        { id: 'm-a', orgId: 'o1', active: true, user: { name: 'Eva Nová' } },
        { id: 'm-b', orgId: 'o2', active: true, user: { name: 'Petr z cizí firmy' } },
        { id: 'm-c', orgId: 'o1', active: false, user: { name: 'Odešlý Jan' } },
      ]
      const r = radky.find(
        (m) => m.id === where.id && (where.orgId === undefined || m.orgId === where.orgId) && (where.active === undefined || m.active === where.active),
      )
      return r ? { user: r.user } : null
    })
  })

  it('člena vlastní firmy najde a vrátí jeho uložené jméno', async () => {
    expect(await findOrgMemberName('o1', 'm-a')).toBe('Eva Nová')
  })

  it('členství cizí firmy se tváří, jako by neexistovalo: dotaz nese orgId aktivní firmy', async () => {
    expect(await findOrgMemberName('o1', 'm-b')).toBeNull()
    expect(db.membership.findFirst.mock.calls[0][0].where).toEqual({ id: 'm-b', orgId: 'o1' })
  })

  it('neaktivní člen vlastní firmy se najde (odešlý člověk má historii, kterou je potřeba dohledat)', async () => {
    expect(await findOrgMemberName('o1', 'm-c')).toBe('Odešlý Jan')
    expect(db.membership.findFirst.mock.calls[0][0].where).not.toHaveProperty('active')
  })

  it('neznámé id vrací null (stránka na to volá notFound)', async () => {
    expect(await findOrgMemberName('o1', 'nic')).toBeNull()
  })

  it('čte jen jméno, nic dalšího z účtu', async () => {
    await findOrgMemberName('o1', 'm-a')
    expect(db.membership.findFirst.mock.calls[0][0].select).toEqual({ user: { select: { name: true } } })
  })
})
