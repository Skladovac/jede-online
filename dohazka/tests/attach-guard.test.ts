import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { vyzadujeResetHesla } from '@/lib/attach-guard'

const zaklad = { existujeUcet: true, heslaNastavilMajitel: false, noveClenstvi: true, resetHesla: false }

describe('user-add: přidání existujícího účtu do další firmy', () => {
  it('heslo nenastavil majitel + nové členství + bez --reset-password = odmítnout', () => {
    expect(vyzadujeResetHesla(zaklad)).toBe(true)
  })

  it.each([
    ['--reset-password zadán', { resetHesla: true }],
    ['heslo si nastavil majitel', { heslaNastavilMajitel: true }],
    ['členství už existuje (oprava role)', { noveClenstvi: false }],
    ['nový účet (heslo dostane operátor sám)', { existujeUcet: false }],
  ])('%s = projde', (_n, zmena) => {
    expect(vyzadujeResetHesla({ ...zaklad, ...zmena })).toBe(false)
  })

  it('skript to opravdu používá před zápisem členství (upsert) a před výpisem hesla', () => {
    const src = readFileSync('scripts/user-add.ts', 'utf8')
    const guard = src.search(/^    if \(vyzadujeResetHesla\(\{/m)
    expect(guard).toBeGreaterThan(-1)
    expect(src).toMatch(/passwordSetByOwner: true/)
    expect(guard).toBeLessThan(src.indexOf('prisma.membership.upsert'))
    expect(guard).toBeLessThan(src.indexOf('prisma.user.update('))
    expect(src.slice(guard, guard + 800)).toMatch(/throw new Error/)
  })
})
