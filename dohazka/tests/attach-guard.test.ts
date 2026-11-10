import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { vyzadujeResetHesla } from '@/lib/attach-guard'

// ÚPLNÁ tabulka všech 32 kombinací pěti vstupů s ručně napsaným očekáváním (ne přepočtem vzorcem z implementace).
// Důvod: dřívější testy překlápěly vždy jeden vstup proti základnímu případu, a proto minuly kombinaci
// "--super-admin bez nového členství". Přidá-li se šestý vstup, tabulka se musí rozšířit (hlídá to test počtu řádků).
//
// Sloupce: existujeUcet, heslaNastavilMajitel, noveClenstvi, resetHesla, udelujeSuperAdmin -> musí se vyměnit heslo?
const R = true
const o = false
const TABULKA: [boolean, boolean, boolean, boolean, boolean, boolean][] = [
  // Účet NEEXISTUJE: dostane nové heslo sám, nikdy se nevyžaduje reset (příznak majitele nemá smysl, ale musí být definovaný).
  [o, o, o, o, o, o],
  [o, o, o, o, R, o],
  [o, o, o, R, o, o],
  [o, o, o, R, R, o],
  [o, o, R, o, o, o],
  [o, o, R, o, R, o],
  [o, o, R, R, o, o],
  [o, o, R, R, R, o],
  [o, R, o, o, o, o],
  [o, R, o, o, R, o],
  [o, R, o, R, o, o],
  [o, R, o, R, R, o],
  [o, R, R, o, o, o],
  [o, R, R, o, R, o],
  [o, R, R, R, o, o],
  [o, R, R, R, R, o],
  // Účet existuje, heslo NENASTAVIL majitel (příznak false): nebezpečné je nové členství NEBO super admin, bez resetu.
  [R, o, o, o, o, o], // jen oprava jména/role ve stávající firmě: nic se nerozšiřuje
  [R, o, o, o, R, R], // PÁTÉ DVEŘE: --super-admin bez --org
  [R, o, o, R, o, o],
  [R, o, o, R, R, o], // s resetem to projde
  [R, o, R, o, o, R], // nové členství bez resetu
  [R, o, R, o, R, R], // obojí bez resetu
  [R, o, R, R, o, o],
  [R, o, R, R, R, o],
  // Účet existuje, heslo si nastavil majitel (příznak true): nic z toho není nebezpečné.
  [R, R, o, o, o, o],
  [R, R, o, o, R, o],
  [R, R, o, R, o, o],
  [R, R, o, R, R, o],
  [R, R, R, o, o, o],
  [R, R, R, o, R, o],
  [R, R, R, R, o, o],
  [R, R, R, R, R, o],
]

describe('vyzadujeResetHesla: úplná tabulka kombinací', () => {
  it('tabulka pokrývá všech 2^5 kombinací právě jednou', () => {
    expect(TABULKA).toHaveLength(32)
    const klice = new Set(TABULKA.map((r) => r.slice(0, 5).join()))
    expect(klice.size).toBe(32)
  })

  it.each(TABULKA)('existuje=%s majitel=%s noveClenstvi=%s reset=%s superAdmin=%s -> vyžadovat reset: %s', (existujeUcet, heslaNastavilMajitel, noveClenstvi, resetHesla, udelujeSuperAdmin, ocekavano) => {
    expect(vyzadujeResetHesla({ existujeUcet, heslaNastavilMajitel, noveClenstvi, resetHesla, udelujeSuperAdmin })).toBe(ocekavano)
  })
})

describe('skript user-add používá hlídače', () => {
  const src = readFileSync('scripts/user-add.ts', 'utf8')

  it('hlídač je nepodmíněný if před upsertem členství i před zápisem uživatele', () => {
    const guard = src.search(/^    if \(vyzadujeResetHesla\(\{/m)
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(src.indexOf('prisma.membership.upsert'))
    expect(guard).toBeLessThan(src.indexOf('prisma.user.update('))
    expect(src.slice(guard, guard + 900)).toMatch(/throw new Error/)
  })

  it('skript předává všech pět vstupů a neposílá si je z nesprávných zdrojů', () => {
    const guard = src.slice(src.search(/^    if \(vyzadujeResetHesla\(\{/m))
    const volani = guard.slice(0, guard.indexOf('})') + 2)
    expect(volani).toContain('existujeUcet: !!existuje')
    expect(volani).toContain('existuje?.passwordSetByOwner')
    expect(volani).toContain('noveClenstvi: !!org && !clenstvi')
    expect(volani).toContain("udelujeSuperAdmin: values['super-admin'] === true")
    expect(volani).toContain("resetHesla: values['reset-password'] === true")
  })

  it('ruční reset označí heslo jako nenastavené majitelem', () => {
    expect(src).toMatch(/passwordSetByOwner: false/)
  })
})
