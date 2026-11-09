// Čistý výběr odkazů hlavní navigace podle role. Bez `server-only` a bez databáze, ať ho jde testovat v Node.
// Oprávnění se berou z matice (`can`), nikdy z výčtu rolí: odkaz tak nevede tam, kam `requireCan`
// na cílové stránce nepustí, a nová role či akce v matici se do navigace propíše sama.
import { can, type RoleValue } from '@/lib/role'

export type NavLink = { href: string; label: string }

export function navLinks(opts: { role: RoleValue; isSuperAdmin: boolean; period: string }): NavLink[] {
  const { role, isSuperAdmin, period } = opts
  const links: NavLink[] = [{ href: `/mesic/${period}`, label: 'Měsíc' }]
  if (can(role, 'viewOthersEntries', isSuperAdmin)) links.push({ href: '/firma/vykazy', label: 'Výkazy' })
  if (can(role, 'managePeople', isSuperAdmin)) links.push({ href: '/firma/lide', label: 'Lidé' })
  if (can(role, 'manageOrgSettings', isSuperAdmin)) links.push({ href: '/firma/nastaveni', label: 'Nastavení firmy' })
  links.push({ href: '/nastaveni', label: 'Nastavení' })
  // Super admin není role firmy, proto se řídí příznakem, ne maticí.
  if (isSuperAdmin) links.push({ href: '/admin', label: 'Firmy' })
  return links
}
