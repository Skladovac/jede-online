/**
 * Podezřelý souhlas rodiče: e-mail „rodiče“ vypadá jako druhá schránka dítěte
 * (stejná doména a podobné jméno, nebo stejná schránka s +něco / tečkami). Souhlas se udělí, jen se upozorní admin.
 */
export function suspiciousParentEmail(childEmail: string | null | undefined, parentEmail: string | null | undefined) {
  if (!childEmail || !parentEmail) return false
  const [cl, cd] = childEmail.toLowerCase().split('@')
  const [pl, pd] = parentEmail.toLowerCase().split('@')
  if (!cl || !pl || !cd || cd !== pd) return false
  // Gmail a spol. ignorují tečky a vše za „+“ → stejná schránka.
  const norm = (s: string) => s.split('+')[0].replace(/[._-]/g, '')
  const a = norm(cl)
  const b = norm(pl)
  if (a === b) return true
  // Bez číslic: „honza123“ vs „honzarodic“ → společný začátek „honza“.
  const A = a.replace(/\d+/g, '')
  const B = b.replace(/\d+/g, '')
  if (A.length >= 3 && B.length >= 3 && (A.includes(B) || B.includes(A))) return true
  let common = 0
  while (common < A.length && common < B.length && A[common] === B[common]) common++
  return common >= 4
}
