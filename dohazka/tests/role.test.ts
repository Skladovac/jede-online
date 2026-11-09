import { describe, expect, it } from 'vitest'
import { can, ROLE_LABEL } from '@/lib/role'

describe('can', () => {
  it('správce firmy smí všech sedm akcí matice', () => {
    for (const a of ['managePeople','manageOrgSettings','editOthersEntry','viewOthersEntries','exportCompany','lockPeriod','viewChangeLog'] as const)
      expect(can('OWNER', a), a).toBe(true)
  })
  it('účetní čte, exportuje a uzavírá, ale nespravuje', () => {
    for (const a of ['viewOthersEntries','exportCompany','lockPeriod'] as const) expect(can('ACCOUNTANT', a), a).toBe(true)
    for (const a of ['managePeople','manageOrgSettings','editOthersEntry','viewChangeLog'] as const) expect(can('ACCOUNTANT', a), a).toBe(false)
  })
  it('zaměstnanec nesmí nic z toho', () => {
    for (const a of ['managePeople','manageOrgSettings','editOthersEntry','viewOthersEntries','exportCompany','lockPeriod','viewChangeLog'] as const)
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
