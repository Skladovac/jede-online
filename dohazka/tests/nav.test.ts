import { describe, expect, it } from 'vitest'
import { navLinks } from '@/lib/nav'
import { ROLES, type RoleValue } from '@/lib/role'

const labels = (role: RoleValue, isSuperAdmin = false) => navLinks({ role, isSuperAdmin, period: '2026-11' }).map((l) => l.label)

describe('navLinks', () => {
  it('zaměstnanec vidí jen Měsíc a Nastavení', () => {
    expect(labels('EMPLOYEE')).toEqual(['Měsíc', 'Nastavení'])
  })
  it('účetní navíc Výkazy, ale ne Lidé ani Nastavení firmy', () => {
    expect(labels('ACCOUNTANT')).toEqual(['Měsíc', 'Výkazy', 'Nastavení'])
  })
  it('správce navíc Lidé a Nastavení firmy, bez Firem', () => {
    expect(labels('OWNER')).toEqual(['Měsíc', 'Výkazy', 'Lidé', 'Nastavení firmy', 'Nastavení'])
  })
  it('super admin v jakékoli roli vidí i Firmy a vše ostatní', () => {
    for (const role of ROLES) expect(labels(role, true)).toEqual(['Měsíc', 'Výkazy', 'Lidé', 'Nastavení firmy', 'Nastavení', 'Firmy'])
  })
  it('Firmy nikdy nevidí nikdo bez příznaku, ani správce', () => {
    for (const role of ROLES) expect(labels(role)).not.toContain('Firmy')
  })
  it('odkazy vedou na existující cesty a Měsíc na zadané období', () => {
    const l = navLinks({ role: 'OWNER', isSuperAdmin: true, period: '2026-12' })
    expect(l.map((x) => x.href)).toEqual(['/mesic/2026-12', '/firma/vykazy', '/firma/lide', '/firma/nastaveni', '/nastaveni', '/admin'])
  })
})
