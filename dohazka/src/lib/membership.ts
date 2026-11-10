// Čistý výběr členství — žádné `server-only`, žádná databáze, testuje se přímo v Node.

export type MembershipLike = { id: string; orgId: string; active: boolean }

/**
 * Které členství je pro požadavek „aktuální“?
 * `wantedOrgId` pochází z cookie, tedy od uživatele — je to jen klíč pro hledání mezi
 * členstvími, která člověk skutečně má. Neznámé, zastaralé nebo cizí id nikdy nevybere
 * nic mimo `list`; spadne na první aktivní. Deaktivované členství nevybere nikdy.
 * Žádné aktivní členství = `null`.
 */
export function pickMembership<M extends MembershipLike>(list: M[], wantedOrgId: string | null): M | null {
  const aktivni = list.filter((m) => m.active)
  if (wantedOrgId) {
    const chtene = aktivni.find((m) => m.orgId === wantedOrgId)
    if (chtene) return chtene
  }
  return aktivni[0] ?? null
}
