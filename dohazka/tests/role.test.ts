import { describe, expect, it } from 'vitest'
import { ACTIONS, can, ROLE_LABEL } from '@/lib/role'

describe('can', () => {
  it('správce firmy smí přesně tu množinu akcí, kterou známe', () => {
    // Přesná rovnost, ne „obsahuje": přidání deváté akce do ACTIONS musí test shodit,
    // aby se autor rozhodl, jestli ji správce dostane.
    const known = ['managePeople','manageOrgSettings','editOthersEntry','viewOthersEntries','exportCompany','lockPeriod','unlockPeriod','viewChangeLog']
    expect([...ACTIONS].sort()).toEqual([...known].sort())
    expect(ACTIONS.filter((a) => can('OWNER', a)).sort()).toEqual([...known].sort())
  })
  it('správce firmy smí všech osm akcí matice', () => {
    for (const a of ['managePeople','manageOrgSettings','editOthersEntry','viewOthersEntries','exportCompany','lockPeriod','unlockPeriod','viewChangeLog'] as const)
      expect(can('OWNER', a), a).toBe(true)
  })
  it('účetní čte, exportuje a uzavírá, ale nespravuje ani neotevírá', () => {
    for (const a of ['viewOthersEntries','exportCompany','lockPeriod'] as const) expect(can('ACCOUNTANT', a), a).toBe(true)
    for (const a of ['managePeople','manageOrgSettings','editOthersEntry','unlockPeriod','viewChangeLog'] as const)
      expect(can('ACCOUNTANT', a), a).toBe(false)
  })
  it('uzavřený měsíc otevře jen správce firmy (a super admin), ne účetní ani zaměstnanec', () => {
    // Pravidlo bylo dřív ručně napsané v akci i na stránce; patří do matice, ať se ty dvě místa nerozejdou.
    expect(can('OWNER', 'unlockPeriod')).toBe(true)
    expect(can('ACCOUNTANT', 'unlockPeriod')).toBe(false)
    expect(can('EMPLOYEE', 'unlockPeriod')).toBe(false)
    expect(can('ACCOUNTANT', 'unlockPeriod', true)).toBe(true)
  })
  it('zaměstnanec nesmí nic z toho', () => {
    for (const a of ['managePeople','manageOrgSettings','editOthersEntry','viewOthersEntries','exportCompany','lockPeriod','unlockPeriod','viewChangeLog'] as const)
      expect(can('EMPLOYEE', a), a).toBe(false)
  })
  it('super admin smí všechno i s rolí zaměstnance', () => {
    expect(can('EMPLOYEE', 'managePeople', true)).toBe(true)
  })
  it('české názvy rolí', () => {
    expect(ROLE_LABEL.OWNER).toBe('Správce firmy')
    expect(ROLE_LABEL.ACCOUNTANT).toBe('Účetní')
    expect(ROLE_LABEL.EMPLOYEE).toBe('Zaměstnanec')
  })
})
