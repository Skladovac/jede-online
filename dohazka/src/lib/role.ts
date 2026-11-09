// Čistá matice oprávnění: kdo v rámci firmy smí co. Žádné `server-only` a žádná databáze —
// testy tenhle modul importují přímo v Node.

// Role uvnitř firmy. Super admin není role firmy, je to příznak na uživateli,
// proto přichází jako samostatný argument `isSuperAdmin` v `can`.
export const ROLES = ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] as const
export type RoleValue = (typeof ROLES)[number]

// České názvy rolí — jediné místo pro obrazovky i exporty.
export const ROLE_LABEL: Record<RoleValue, string> = {
  OWNER: 'Správce firmy',
  ACCOUNTANT: 'Účetní',
  EMPLOYEE: 'Zaměstnanec',
}

// Akce, proti kterým se kontrolují oprávnění. Přidání akce = přidání do matice níže.
export const ACTIONS = [
  'managePeople',
  'manageOrgSettings',
  'editOthersEntry',
  'viewOthersEntries',
  'exportCompany',
  'lockPeriod',
  'viewChangeLog',
] as const
export type ActionValue = (typeof ACTIONS)[number]

const ALL_ACTIONS = new Set<ActionValue>(ACTIONS)

// Matice rolí. Záměrně explicitní seznamy místo odvozování: zaměstnanec nemá nic,
// účetní jen čtení, export a uzavírání období — nikdy správu lidí ani nastavení.
const MATRIX: Record<RoleValue, ReadonlySet<ActionValue>> = {
  OWNER: ALL_ACTIONS,
  ACCOUNTANT: new Set<ActionValue>(['viewOthersEntries', 'exportCompany', 'lockPeriod']),
  EMPLOYEE: new Set<ActionValue>(),
}

/**
 * Smí uživatel provést akci?
 * Super admin smí vždy — jeho přístup nevychází z role v žádné firmě,
 * takže se matice vůbec nečte.
 */
export function can(role: RoleValue, action: ActionValue, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true
  return MATRIX[role].has(action)
}
