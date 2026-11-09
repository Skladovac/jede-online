# Organizace, role a admin prostředí — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Z jednouživatelské Docházky udělat systém víc firem se čtyřmi rolemi, admin prostředím, firemním exportem a uzávěrkou měsíce.

**Architecture:** Výkaz přestává patřit uživateli a začíná patřit **členství** (`Membership` = uživatel × firma × role). Tím je izolace firem vynucená jedním cizím klíčem: `Entry.membershipId` určuje zároveň člověka i firmu, takže nejde omylem spárovat cizí dvojici. Období a hodina připomínky se stěhují z uživatele na firmu, `tracksFrom` na členství. Kdo má víc firem, přepíná je; zaměstnanec má právě jednu.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma 5 + PostgreSQL, Tailwind 3, zod 4, vitest, Resend (pozvánky).

**Spec:** [docs/superpowers/specs/2026-11-09-dohazka-organizace-role.md](../specs/2026-11-09-dohazka-organizace-role.md)

## Global Constraints

- Aplikace žije v `dohazka/`, host port `127.0.0.1:3600`, v kontejneru `3000`.
- `TZ=Europe/Prague`. Každé „dnes" a „kolik je hodin" je pražský čas, nikdy UTC.
- Hodiny jsou `Decimal`, nikdy `Float`, zobrazují se s čárkou (`8,5`).
- Datum dne je `@db.Date`.
- **Veřejná registrace neexistuje.** Firmu zakládá super admin, lidi zakládá správce firmy.
- Rozhraní, exporty i oznámení jsou česky.
- V patičce je „jede.online" zlatě, prokliknuté na `https://jede.online`.
- PDF se generuje v procesu, žádný prohlížeč na serveru.
- **Každý dotaz do `Entry` je omezený na `membershipId`**, nikdy jen na `userId`. Super admin není výjimka — i on pracuje přes členství té firmy, kterou má přepnutou.
- Server je Hetzner CX23 `178.104.231.220`. Na server ani repozitář Elasry se nesahá.
- Firemní export je **jen XLSX a CSV**. PDF zůstává u výkazu jednotlivce.

## Review Focus

1. **Přepnutá firma vs. starý odkaz.** Kdo má víc firem a otevře `/den/<datum>` nebo `/mesic/<období>` po přepnutí, musí vidět data přepnuté firmy — ne zbytek předchozí. (Task 3)
2. **Zápis do uzavřeného měsíce mimo UI.** Serverová akce musí odmítnout zápis i mazání, i když tlačítko v UI zmizelo. (Task 10)
3. **Pozvánka použitá dvakrát nebo po vypršení.** Musí selhat česky a nenastavit heslo. (Task 7)
4. **Deaktivovaný člověk s živou relací.** Dokud relace nevyprší, nesmí nic zapsat ani číst. (Task 3)
5. **Správce sáhne přes URL do cizí firmy.** `/firma/<cizí id>/lide` musí skončit odmítnutím, ne výpisem. (Task 5)

---

## File Structure

**Nové čisté moduly (bez `server-only`, testovatelné)**
- `src/lib/role.ts` — role, jejich české názvy, matice oprávnění.
- `src/lib/membership.ts` — výběr aktivního členství ze seznamu.
- `src/lib/period-lock.ts` — je období uzavřené.
- `src/lib/company-report.ts` — firemní výkaz z výkazů jednotlivců.

**Serverové moduly**
- `src/lib/org.ts` — kontext firmy: aktivní členství, oprávnění, přepínání.
- `src/lib/mail.ts` — odesílání přes Resend.
- `src/lib/invitation.ts` — pozvánky a obnova hesla.
- `src/lib/export/company-xlsx.ts`, `src/lib/export/company-csv.ts`.

**Serverové akce**
- `src/app/actions/org.ts` — založení firmy, nastavení firmy.
- `src/app/actions/people.ts` — lidé ve firmě, role, deaktivace.
- `src/app/actions/invitation.ts` — pozvánka, nastavení hesla.
- `src/app/actions/lock.ts` — uzávěrka.

**Stránky**
- `src/app/admin/page.tsx` — seznam firem (super admin).
- `src/app/admin/nova-firma/page.tsx` — založení firmy a jejího správce.
- `src/app/firma/lide/page.tsx` — lidé ve firmě.
- `src/app/firma/nastaveni/page.tsx` — pravidla firmy.
- `src/app/firma/vykazy/page.tsx` — výkazy lidí, kdo nemá zapsáno, firemní export.
- `src/app/firma/vykazy/[membershipId]/page.tsx` — výkaz jednoho člověka očima správce.
- `src/app/pozvanka/[token]/page.tsx` — nastavení hesla z pozvánky.
- `src/app/zapomenute-heslo/page.tsx` — žádost o obnovu.
- `src/app/api/export/firma/[format]/route.ts` — firemní export.

**Komponenty**
- `src/components/OrgSwitcher.tsx` — přepínač firmy (jen pro víc členství).
- `src/components/AdminNav.tsx` — odkazy podle role.

---

## Task 1: Role a matice oprávnění

**Files:**
- Create: `src/lib/role.ts`
- Test: `tests/role.test.ts`

**Interfaces:**
- Produces:
  - `ROLES = ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] as const`, `type RoleValue`
  - `ROLE_LABEL: Record<RoleValue, string>` — `OWNER: 'Správce firmy'`, `ACCOUNTANT: 'Účetní'`, `EMPLOYEE: 'Zaměstnanec'`
  - `ACTIONS = ['managePeople','manageOrgSettings','editOthersEntry','viewOthersEntries','exportCompany','lockPeriod','viewChangeLog'] as const`, `type ActionValue`
  - `can(role: RoleValue, action: ActionValue, isSuperAdmin?: boolean): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/role.test.ts
import { describe, expect, it } from 'vitest'
import { can, ROLE_LABEL } from '@/lib/role'

describe('can', () => {
  it('správce firmy smí všechno kromě zakládání firem', () => {
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
```

- [ ] **Step 2: Run test to verify it fails** — `cd dohazka && npm test -- role` → FAIL (modul neexistuje)
- [ ] **Step 3: Implement `src/lib/role.ts`** — matice jako `Record<RoleValue, ReadonlySet<ActionValue>>`; `isSuperAdmin === true` vrací vždy `true`.
- [ ] **Step 4: Run test to verify it passes** — PASS, 5 testů
- [ ] **Step 5: Commit** — `Dohazka: role a matice opravneni`

---

## Task 2: Schéma a migrace dat

**Files:**
- Modify: `dohazka/prisma/schema.prisma`
- Create: `dohazka/prisma/migrations/<timestamp>_organizace/migration.sql`

**Interfaces:**
- Consumes: `RoleValue` (Task 1) — enum v databázi má **stejné hodnoty** `OWNER | ACCOUNTANT | EMPLOYEE`.
- Produces: modely `Organization`, `Membership`, `PeriodLock`, `EntryChangeLog`, `Invitation`; `User.isSuperAdmin`; `Entry.membershipId`.

- [ ] **Step 1: Napiš modely do `schema.prisma`**

- `Organization`: `id`, `name String`, `reportName String`, `periodStartDay Int @default(1)`, `remindHour Int @default(19)`, `createdAt`.
- `enum Role { OWNER ACCOUNTANT EMPLOYEE }`
- `Membership`: `id`, `userId`, `orgId`, `role Role`, `active Boolean @default(true)`, `tracksFrom DateTime @db.Date`, `createdAt`, `@@unique([userId, orgId])`, `@@index([orgId])`.
- `Entry`: **přidat `membershipId String`** a relaci, `@@index([membershipId, day])`; **odebrat `userId`** a jeho relaci.
- `User`: přidat `isSuperAdmin Boolean @default(false)`; **odebrat `periodStartDay`, `remindHour`, `tracksFrom`** (stěhují se); `remindEnabled` zůstává.
- `PeriodLock`: `id`, `orgId`, `periodKey String`, `lockedById String`, `lockedAt`, `@@unique([orgId, periodKey])`.
- `EntryChangeLog`: `id`, `membershipId`, `dayKey String`, `changedById String`, `changedAt`, `before Json?`, `after Json?`, `@@index([membershipId, dayKey])`.
- `Invitation`: `id String @id` (sha256 tokenu), `membershipId String @unique`, `kind String` (`invite` / `reset`), `expiresAt`, `createdAt`.

- [ ] **Step 2: Vyrob migraci a doplň do ní převod živých dat**

Run: `cd dohazka && npx prisma migrate dev --name organizace --create-only`

Do vygenerovaného SQL **před** odstranění `Entry.userId` vlož převod. Prisma ho nevymyslí a bez něj by se existující záznamy ztratily:

```sql
INSERT INTO "Organization" (id, name, "reportName", "periodStartDay", "remindHour", "createdAt")
SELECT 'org_default', 'Výchozí firma', 'Výchozí firma', 1, 19, now()
WHERE EXISTS (SELECT 1 FROM "User");

INSERT INTO "Membership" (id, "userId", "orgId", role, active, "tracksFrom", "createdAt")
SELECT 'mem_' || u.id, u.id, 'org_default', 'EMPLOYEE', true, u."tracksFrom", now() FROM "User" u;

UPDATE "Entry" e SET "membershipId" = 'mem_' || e."userId";
```

- [ ] **Step 3: Ověř, že migrace projde a data přežijí**

Run: `cd dohazka && npx prisma migrate reset --force --skip-seed && npx prisma migrate deploy`
Expected: bez chyby, `_prisma_migrations` obsahuje obě migrace.

- [ ] **Step 4: Ověř, že `Entry.userId` nikde nezůstal**

Run: `cd dohazka && grep -rn "userId" prisma/schema.prisma`
Expected: `userId` jen u `Membership`, `Session` a `PushSubscription` — **ne** u `Entry`.

- [ ] **Step 5: Commit** — `Dohazka: schema organizaci, clenstvi a uzaverky`

---

## Task 3: Kontext firmy v auth

**Files:**
- Create: `src/lib/membership.ts`, `src/lib/org.ts`
- Modify: `src/lib/auth.ts` (`USER_SELECT` — přidat `isSuperAdmin`, odebrat přestěhovaná pole)
- Test: `tests/membership.test.ts`

**Interfaces:**
- Consumes: `can`, `RoleValue` (Task 1); `requireUser` (stávající).
- Produces:
  - `pickMembership(list: M[], wantedOrgId: string | null): M | null` v `membership.ts` — čistá funkce; `M = { id, orgId, active }`. Vrací chtěné aktivní členství, jinak první aktivní, jinak `null`.
  - `getOrgContext()` v `org.ts` → `{ user, membership, org, role, isSuperAdmin } | null`
  - `requireOrgContext()` — jinak `redirect('/prihlaseni')`
  - `requireCan(action: ActionValue)` — jinak `redirect('/')`
  - `requireSuperAdmin()` — jinak `redirect('/')`
  - `setActiveOrg(orgId: string)` — serverová akce, zapíše cookie `dh_org`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/membership.test.ts
import { describe, expect, it } from 'vitest'
import { pickMembership } from '@/lib/membership'

const a = { id: 'm1', orgId: 'o1', active: true }
const b = { id: 'm2', orgId: 'o2', active: true }
const zrusene = { id: 'm3', orgId: 'o3', active: false }

describe('pickMembership', () => {
  it('vybere chtěnou firmu', () => expect(pickMembership([a, b], 'o2')).toBe(b))
  it('bez volby vezme první aktivní', () => expect(pickMembership([a, b], null)).toBe(a))
  it('cizí nebo neznámé id firmy spadne na první aktivní, ne na cizí data', () =>
    expect(pickMembership([a, b], 'o-cizi')).toBe(a))
  it('deaktivované členství nevybere nikdy', () => {
    expect(pickMembership([zrusene], 'o3')).toBe(null)
    expect(pickMembership([zrusene], null)).toBe(null)
  })
  it('bez členství vrací null', () => expect(pickMembership([], 'o1')).toBe(null))
})
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- membership` → FAIL
- [ ] **Step 3: Implement `membership.ts`, pak `org.ts`**

`org.ts` načte členství přihlášeného (`where: { userId: user.id, active: true }`, `include: { org: true }`), přečte cookie `dh_org`, prožene to `pickMembership`. **Bez aktivního členství vrací `null`** — tím je pokrytý deaktivovaný člověk s živou relací (Review Focus 4).

- [ ] **Step 4: Run test to verify it passes** — PASS, 5 testů
- [ ] **Step 5: Commit** — `Dohazka: kontext firmy a vyber clenstvi`

---

## Task 4: Přepnutí stávajícího kódu na členství

**Files:**
- Modify: `src/app/page.tsx`, `src/app/den/[day]/page.tsx`, `src/app/mesic/[period]/page.tsx`, `src/app/nastaveni/page.tsx`, `src/app/actions/entry.ts`, `src/app/actions/push.ts`, `src/app/api/export/[format]/route.ts`, `src/lib/reminder.ts`, `scripts/user-add.ts`
- Test: `tests/entry-actions.test.ts` (nový), stávající testy upravit

**Interfaces:**
- Consumes: `requireOrgContext` (Task 3).
- Produces: nic nového; mění se jen omezení dotazů.

- [ ] **Step 1: Write the failing test**

```ts
// tests/entry-actions.test.ts — pin, že se dotazy omezují členstvím
it('saveEntry zapisuje a maže jen pod aktivním členstvím', async () => {
  // mock prisma; po zavolání saveEntry musí where/data obsahovat membershipId: 'm1'
  expect(db.entry.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ membershipId: 'm1' }) }))
  expect(db.entry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ membershipId: 'm1' }) }))
})
```

- [ ] **Step 2: Run test to verify it fails** — FAIL
- [ ] **Step 3: Přepiš všechna místa**

Každé `where: { userId: user.id }` nad `Entry` → `where: { membershipId: ctx.membership.id }`. `user.periodStartDay` → `ctx.org.periodStartDay`, `user.tracksFrom` → `ctx.membership.tracksFrom`, `user.remindHour` → `ctx.org.remindHour`. `runReminder` prochází **členství** s odběrem, ne uživatele. `user-add.ts` dostane `--org` a `--role`.

- [ ] **Step 4: Ověř, že nikde nezbyl dotaz na `Entry` podle `userId`**

Run: `cd dohazka && grep -rn "entry\.\(findMany\|findFirst\|create\|update\|deleteMany\|count\)" src/ -A3 | grep -c "userId"`
Expected: `0`

- [ ] **Step 5: Celá sada a typecheck** — `npm test && npm run typecheck` → vše PASS
- [ ] **Step 6: Commit** — `Dohazka: vsechny dotazy omezene clenstvim misto uzivatelem`

---

## Task 5: Admin prostředí — firmy

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/nova-firma/page.tsx`, `src/app/actions/org.ts`, `src/components/AdminNav.tsx`
- Test: `tests/org-actions.test.ts`

**Interfaces:**
- Consumes: `requireSuperAdmin` (Task 3), `ROLE_LABEL` (Task 1).
- Produces: `createOrganization(input: OrgInput): Promise<{ ok: true; orgId: string } | { error: string }>`; `orgSchema` ve `validation.ts` (`name` 1–120, `reportName` 1–120, `ownerEmail` e-mail, `ownerName` 1–120).

- [ ] **Step 1: Write the failing tests** — `createOrganization` vytvoří firmu **a** členství role `OWNER` v jedné transakci; při už existujícím e-mailu připojí existujícího uživatele místo zdvojení; nesuperadmin dostane odmítnutí.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement** — `requireSuperAdmin()` jako první řádek akce. `/admin` vypíše firmy s počtem aktivních lidí.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit** — `Dohazka: admin prostredi, zakladani firem`

---

## Task 6: Správa lidí ve firmě

**Files:**
- Create: `src/app/firma/lide/page.tsx`, `src/app/actions/people.ts`, `src/components/OrgSwitcher.tsx`
- Test: `tests/people-actions.test.ts`

**Interfaces:**
- Consumes: `requireCan('managePeople')`, `getOrgContext` (Task 3).
- Produces: `addPerson(input)`, `setRole(membershipId, role)`, `setActive(membershipId, active)` — všechny vrací `{ ok: true } | { error: string }`.

- [ ] **Step 1: Write the failing tests**

Pin **Review Focus 5**: `setRole` na členství z cizí firmy musí vrátit chybu a neprovést zápis — test ověří, že `membership.update` nebyl zavolán.
Dále: poslední správce firmy nesmí být deaktivován ani přeřazen (jinak firma osiří).

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement** — každý dotaz nad `Membership` má v `where` i `orgId: ctx.org.id`.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit** — `Dohazka: sprava lidi ve firme`

---

## Task 7: Pozvánky, nastavení hesla a jeho obnova

**Files:**
- Create: `src/lib/mail.ts`, `src/lib/invitation.ts`, `src/app/actions/invitation.ts`, `src/app/pozvanka/[token]/page.tsx`, `src/app/zapomenute-heslo/page.tsx`
- Test: `tests/invitation.test.ts`

**Interfaces:**
- Consumes: `sha256`, `randomToken`, `hashPassword` (`@/lib/crypto`).
- Produces:
  - `createInvitation(membershipId, kind: 'invite' | 'reset'): Promise<string>` — vrací **token**, do databáze ukládá jen `sha256(token)`, platnost 48 h.
  - `consumeInvitation(token: string, password: string): Promise<{ ok: true } | { error: string }>`
  - `sendMail(to: string, subject: string, html: string): Promise<boolean>` v `mail.ts` — Resend přes `fetch`, klíč z `RESEND_API_KEY`, bez klíče vrací `false` a nevyhodí.
  - `passwordSchema` ve `validation.ts` — min. 10 znaků, max. 200.

- [ ] **Step 1: Write the failing tests**

Pin **Review Focus 3**: tytéž pozvánky nelze použít dvakrát (druhé volání `consumeInvitation` vrátí chybu a heslo nezmění) a po `expiresAt` selže. Dále: token se nikdy neukládá v původní podobě — test ověří, že uložené `id` se nerovná tokenu.

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement** — `consumeInvitation` v jedné transakci nastaví heslo, smaže pozvánku a zruší existující relace uživatele.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit** — `Dohazka: pozvanky e-mailem a obnova hesla`

---

## Task 8: Nastavení firmy

**Files:**
- Create: `src/app/firma/nastaveni/page.tsx`
- Modify: `src/app/actions/org.ts` (`updateOrgSettings`), `src/lib/validation.ts`
- Test: rozšířit `tests/org-actions.test.ts`

**Interfaces:**
- Produces: `updateOrgSettings(input: OrgSettingsInput)`; `orgSettingsSchema` — `reportName` 1–120, `periodStartDay` celé 1–28, `remindHour` celé 0–23.

- [ ] **Step 1: Write the failing tests** — `periodStartDay` 0 i 29 jsou odmítnuty (`periodRange` by z 0 vyrobil klíč `2026-10-00`); účetní dostane odmítnutí.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement** — `requireCan('manageOrgSettings')` jako první řádek.
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit** — `Dohazka: nastaveni firmy`

---

## Task 9: Pohled účetní a firemní export

**Files:**
- Create: `src/lib/company-report.ts`, `src/lib/export/company-xlsx.ts`, `src/lib/export/company-csv.ts`, `src/app/firma/vykazy/page.tsx`, `src/app/firma/vykazy/[membershipId]/page.tsx`, `src/app/api/export/firma/[format]/route.ts`
- Test: `tests/company-report.test.ts`, `tests/export-company.test.ts`

**Interfaces:**
- Consumes: `buildMonth`, `buildReport`, `formatHours`, `periodRange`, `dayKeysInRange`.
- Produces:
  - `type CompanyRow = { personName: string; totalHours: string; totalHoursValue: number; daysWorked: number; missingDays: string[] }`
  - `type CompanyReport = { orgName: string; periodLabel: string; rows: CompanyRow[]; totalHours: string; totalHoursValue: number }`
  - `buildCompanyReport(args: { orgName: string; fromKey: string; toKey: string; people: { personName: string; month: ReturnType<typeof buildMonth> }[] }): CompanyReport`
  - `toCompanyXlsx(r: CompanyReport): Promise<Buffer>`, `toCompanyCsv(r: CompanyReport): string`

- [ ] **Step 1: Write the failing tests**

```ts
it('součet firmy je součtem lidí a počítá se v setinách', () => {
  // dva lidé: 7,7+0,1+0,2 a 8,0 -> firma 16,0 přesně, ne 15,999...
  expect(r.totalHoursValue).toBe(16)
  expect(r.totalHours).toBe('16,0')
})
it('chybějící dny jsou dny bez záznamu od tracksFrom do dneška, ne budoucí', () => { /* ... */ })
it('firemní XLSX má hodiny jako čísla, ne text', () => {
  expect(ws.getCell('B2').type).toBe(ExcelJS.ValueType.Number)
})
it('firemní CSV má BOM a chrání vzorce stejně jako výkaz jednotlivce', () => { /* ... */ })
```

- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement** — route `/api/export/firma/[format]` přijímá jen `csv` a `xlsx`, `pdf` vrací 400 s českou hláškou. První řádek `requireCan('exportCompany')`.
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit** — `Dohazka: firemni export a prehled der`

---

## Task 10: Uzávěrka měsíce

**Files:**
- Create: `src/lib/period-lock.ts`, `src/app/actions/lock.ts`
- Modify: `src/app/actions/entry.ts`, `src/app/den/[day]/page.tsx`, `src/app/firma/vykazy/page.tsx`
- Test: `tests/period-lock.test.ts`

**Interfaces:**
- Produces:
  - `isLocked(lockedPeriods: string[], periodStartDay: number, dayKey: string): boolean` — čistá funkce
  - `lockPeriod(periodKey)`, `unlockPeriod(periodKey)` — akce; `unlockPeriod` smí jen `OWNER`

- [ ] **Step 1: Write the failing tests**

Pin **Review Focus 2**: `saveEntry`, `deleteEntry` i `markDayOff` na den z uzavřeného období vrátí `{ error: 'Měsíc je uzavřený…' }` **a neprovedou žádný zápis** — test ověří, že `entry.create`/`deleteMany` nebyly zavolány. Dále: uzávěrka ctí `periodStartDay` firmy (při 16 patří 20. 11. do období `2026-12`).

- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement** — kontrola uzamčení je v serverové akci, ne jen ve stránce.
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit** — `Dohazka: uzaverka mesice`

---

## Task 11: Oprava cizího zápisu a historie změn

**Files:**
- Modify: `src/app/actions/entry.ts`, `src/app/firma/vykazy/[membershipId]/page.tsx`
- Create: `src/app/firma/vykazy/[membershipId]/historie/page.tsx`
- Test: rozšířit `tests/entry-actions.test.ts`

**Interfaces:**
- Produces: `saveEntryFor(membershipId: string, formData: FormData)`, `deleteEntryFor(membershipId: string, id: string)` — vyžadují `can('editOthersEntry')` a zapisují `EntryChangeLog`.

- [ ] **Step 1: Write the failing tests** — oprava cizího zápisu zapíše do `EntryChangeLog` `before`/`after` a `changedById`; **vlastní** zápis zaměstnance žádný log nezakládá; `viewChangeLog` účetní nemá.
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement** — zápis do logu ve stejné transakci jako změna záznamu.
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit** — `Dohazka: oprava ciziho zapisu s historii zmen`

---

## Task 12: Navigace, přepínač firmy a nasazení

**Files:**
- Modify: `src/components/SettingsLink.tsx` → `AdminNav.tsx`, `src/app/den/[day]/page.tsx`, `src/app/mesic/[period]/page.tsx`, `dohazka/deploy/.env.example`, `dohazka/deploy/docker-compose.yml`, `dohazka/deploy/README.md`
- Test: `tests/nav.test.ts`

- [ ] **Step 1: Write the failing test** — odkazy podle role: zaměstnanec vidí jen Měsíc a Nastavení; účetní navíc Výkazy; správce navíc Lidé a Nastavení firmy; super admin navíc Firmy.
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement** — `OrgSwitcher` se vykreslí jen při víc než jednom aktivním členství. Do compose a `.env.example` přidat `RESEND_API_KEY` a `APP_URL` (základ odkazů v pozvánkách).
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Doplň README** — převod živých dat, nový `user:add --org --role`, první super admin.
- [ ] **Step 6: Celá sada, typecheck, build** — `npm test && npm run typecheck && npm run build:docker`
- [ ] **Step 7: Commit** — `Dohazka: navigace podle role, prepinac firmy, nasazeni`

---

## Self-review

**Pokrytí specifikace:** role → T1; firmy a členství → T2; kontext a izolace → T3, T4; admin prostředí → T5; správa lidí → T6; pozvánky i obnova hesla → T7; nastavení firmy → T8; firemní export a přehled děr → T9; uzávěrka → T10; historie změn → T11; přepínač a nasazení → T12. Bez pokrytí nezůstalo nic.

**Review Focus:** 1 → T3 (`pickMembership` neznámé id), 2 → T10, 3 → T7, 4 → T3 (bez aktivního členství `null`), 5 → T6.

**Typová shoda:** `RoleValue` z T1 = hodnoty enumu v T2; `Membership.id` je to, co nese `Entry.membershipId` (T2) a co berou akce v T6, T9, T11.

**Proporce:** 12 úkolů, plán je kratší než kód, který popisuje. Těla funkcí nikde — jen podpisy, testy a hodnoty.
