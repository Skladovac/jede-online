# dohazka.jede.online Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evidence odpracovaných hodin a míst jako webová aplikace na plochu telefonu, s večerní připomínkou a měsíčním exportem pro zaměstnavatele.

**Architecture:** Nová samostatná Next.js aplikace ve složce `dohazka/` repa `jede.online`, vedle `pokemon/`, se vlastním Dockerfile a `deploy/`. Veškerá logika (období, validace zápisu, souhrny, řádky exportu, rozhodnutí o připomínce) žije v čistých funkcích v `src/lib/*`, které berou obyčejná data a nesahají do databáze — ty jsou pokryté testy bez databáze. Serverové akce a route handlery jsou jen tenké obaly, které načtou data Prismou a zavolají tyhle funkce.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind 3, Prisma 5 + PostgreSQL, zod 4, bcryptjs, web-push, exceljs, pdfkit, vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-dohazka-jede-online-design.md`

## Global Constraints

- Aplikace žije v `dohazka/`, samostatný compose projekt, nezávislý na ostatních webech.
- Host port `127.0.0.1:3500`, v kontejneru `3000`. Doména `dohazka.jede.online`.
- `TZ=Europe/Prague` v kontejneru. Veškeré „dnes" a „která je hodina" se počítá v pražském čase, nikdy v UTC.
- Hodiny jsou `Decimal`, nikdy `Float`. Zobrazují se desetinně s čárkou (`8,5`).
- Datum dne je v databázi `@db.Date`, nikdy `DateTime` s časem.
- PDF se generuje v procesu aplikace. **Žádný headless Chrome ani jiný prohlížeč** — server má 4 GB RAM.
- Registrace je zavřená: v aplikaci není registrační stránka ani reset hesla. Účty zakládá `npm run user:add`.
- Rozhraní, exporty i oznámení jsou česky.
- V patičce je „jede.online" zlatě, prokliknuté na `https://jede.online`.
- Server je Hetzner CX23 `178.104.231.220`. Na server ani repozitář Elasry se nesahá.
- Připomínka se pípá **každý den**, včetně víkendů a svátků. Žádná tabulka svátků, žádný rozvrh pracovních dnů.
- Když je vyplněné od–do i hodiny a nesouhlasí to, **platí hodiny**. Pauzy se nikdy neodečítají automaticky.

## Review Focus

Vstupy, které návrh předpokládá, ale samy by si testu nevyžádaly. Každý má přiřazený test v úkolu, který ten kód vlastní:

1. **Hodiny mimo rozsah a v cizím formátu** — `0`, `-3`, `25`, `8.5` s tečkou, `8,5,5`, prázdno, `"osm"`. Člověk píše na telefonu a trefí se vedle; uložit se musí dát jen číslo mezi 0 a 24. → Task 4.
2. **Od–do přes půlnoc** — `22:00`–`06:00`. Rozdíl časů je negativní; dopočet hodin musí vyjít 8, ne −16. → Task 4.
3. **Export prázdného měsíce** — měsíc bez jediného záznamu. Všechny tři formáty musí vzniknout s hlavičkou a nulovým součtem, ne spadnout na prázdném poli. → Task 7 a Task 8.
4. **Den před „zapisuje od"** — zpětné dopisování je povolené, ale měsíce před založením účtu se nesmí počítat jako prázdné ani se do nich pípat. Jinak obrazovka „vidí, co nemá zapsané" lže hned první den. → Task 6 a Task 10.
5. **Dvojí doručení připomínky** — timer běží každou hodinu a `Persistent=true` ho po výpadku spustí znovu. Jeden den smí pípnout jen jednou a jen do dvou hodin po své hodině. → Task 10.

---

### Task 1: Skeleton aplikace, testy a health endpoint

**Files:**
- Create: `dohazka/package.json`, `dohazka/tsconfig.json`, `dohazka/next.config.ts`, `dohazka/tailwind.config.ts`, `dohazka/postcss.config.mjs`, `dohazka/vitest.config.ts`, `dohazka/.gitignore`
- Create: `dohazka/src/app/layout.tsx`, `dohazka/src/app/globals.css`, `dohazka/src/app/page.tsx`, `dohazka/src/components/Footer.tsx`
- Create: `dohazka/src/lib/prisma.ts`, `dohazka/src/lib/date.ts`, `dohazka/src/app/api/health/route.ts`
- Test: `dohazka/tests/date.test.ts`

**Interfaces:**
- Consumes: nic.
- Produces:
  - `prisma` (sdílená instance `PrismaClient`) z `@/lib/prisma` — kopie `pokemon/src/lib/prisma.ts`.
  - `pragueDayKey(d: Date): string` → `"2026-11-08"`, den v pražském čase.
  - `pragueHour(d: Date): number` → 0–23 v pražském čase.
  - `parseDayKey(key: string): Date` → `Date` v UTC midnight, pro `@db.Date`.
  - `periodRange(startDay: number, year: number, month: number): { fromKey: string; toKey: string }` — období výkazu. `startDay === 1` dává kalendářní měsíc; `startDay === 16` dává 16. předchozího měsíce až 15. tohoto. `month` je 1–12.
  - `formatHours(h: number): string` → `"8,5"`, `"8"`, `"0"`.
  - `dayKeysInRange(fromKey, toKey): string[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/date.test.ts
import { describe, expect, it } from 'vitest'
import { dayKeysInRange, formatHours, parseDayKey, periodRange, pragueDayKey, pragueHour } from '@/lib/date'

describe('pražský čas', () => {
  it('den se láme podle Prahy, ne podle UTC', () => {
    expect(pragueDayKey(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09')
    expect(pragueDayKey(new Date('2026-07-08T22:30:00Z'))).toBe('2026-07-09') // letní čas
  })
  it('hodina je pražská', () => {
    expect(pragueHour(new Date('2026-11-08T18:00:00Z'))).toBe(19)
    expect(pragueHour(new Date('2026-07-08T17:00:00Z'))).toBe(19)
  })
})

describe('periodRange', () => {
  it('startDay 1 je kalendářní měsíc', () => {
    expect(periodRange(1, 2026, 11)).toEqual({ fromKey: '2026-11-01', toKey: '2026-11-30' })
  })
  it('startDay 16 jde přes přelom měsíce', () => {
    expect(periodRange(16, 2026, 11)).toEqual({ fromKey: '2026-10-16', toKey: '2026-11-15' })
  })
  it('startDay 31 v únoru nespadne na neexistující den', () => {
    expect(periodRange(31, 2026, 3)).toEqual({ fromKey: '2026-02-28', toKey: '2026-03-30' })
  })
})

describe('formatHours', () => {
  it('desetinná čárka, bez zbytečných nul', () => {
    expect(formatHours(8.5)).toBe('8,5')
    expect(formatHours(8)).toBe('8')
    expect(formatHours(0)).toBe('0')
    expect(formatHours(7.25)).toBe('7,25')
  })
})

describe('dayKeysInRange', () => {
  it('vrátí všechny dny včetně krajních', () => {
    expect(dayKeysInRange('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
  })
})

describe('parseDayKey', () => {
  it('dá UTC midnight, aby @db.Date neujížděl o zónu', () => {
    expect(parseDayKey('2026-11-08').toISOString()).toBe('2026-11-08T00:00:00.000Z')
    expect(parseDayKey('2026-07-08').toISOString()).toBe('2026-07-08T00:00:00.000Z') // letní čas nic nemění
  })
  it('kolečko tam a zpátky nemění den', () => {
    for (const key of ['2026-01-01', '2026-03-29', '2026-10-25', '2026-12-31']) {
      expect(pragueDayKey(parseDayKey(key)), key).toBe(key)
    }
  })
})
```

Pozor na poslední test: `2026-03-29` a `2026-10-25` jsou dny přechodu na letní a zimní čas. Pokud `pragueDayKey` počítá den posunem o fixní offset, tenhle test to odhalí.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test`
Expected: FAIL — `Cannot find module '@/lib/date'`

- [ ] **Step 3: Scaffold the app**

`package.json` jménem `dohazka-jede-online`, skripty `dev` (`next dev -p 3500`), `start` (`next start -p 3500`), `build` (`prisma generate && next build`), `build:docker` (totéž), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch` (`vitest`), `postinstall` (`prisma generate`). `next.config.ts`, `tsconfig.json` (alias `@/*` → `src/*`), `tailwind.config.ts` a `postcss.config.mjs` vezmi z `pokemon/` a vyhoď z nich `rewrites` na obrázkové CDN a pokémoní značkové barvy. `vitest.config.ts` nastaví `test.environment: 'node'` a stejný alias `@` jako tsconfig.

- [ ] **Step 4: Implement `src/lib/date.ts` with the signatures from Interfaces**

Pražský den i hodina přes `Intl.DateTimeFormat` s `timeZone: 'Europe/Prague'` — stejný přístup jako `isQuietNow` v `pokemon/src/lib/push.ts`. Žádná knihovna na datumy.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dohazka && npm test`
Expected: PASS, 4 describe bloky

- [ ] **Step 6: Add `src/lib/prisma.ts`, `src/app/api/health/route.ts`, layout, úvodní stránku a patičku**

`prisma.ts` a `api/health/route.ts` jsou kopie z `pokemon/` (health vrací `{ status, db, commit }` a 503 při spadlé databázi — deploy skript se na to dívá). `Footer.tsx` obsahuje odkaz `jede.online` zlatě na `https://jede.online`. Úvodní stránka zatím jen odkáže na přihlášení.

- [ ] **Step 7: Verify typecheck and build**

Run: `cd dohazka && npm run typecheck`
Expected: bez chyb

- [ ] **Step 8: Commit**

```bash
git add dohazka
git commit -m "Dohazka: skeleton aplikace, vitest a health endpoint"
```

---

### Task 2: Datový model a první migrace

**Files:**
- Create: `dohazka/prisma/schema.prisma`
- Create: `dohazka/prisma/migrations/` (generuje `prisma migrate dev`)

**Interfaces:**
- Consumes: nic.
- Produces: Prisma modely, na které staví všechny další úkoly:
  - `User` — `id String @id @default(cuid())`, `email String @unique`, `passwordHash String`, `name String`, `tracksFrom DateTime @db.Date` (od kdy se počítá, že má zapsáno), `periodStartDay Int @default(1)`, `remindHour Int @default(19)`, `remindEnabled Boolean @default(true)`, `createdAt`.
  - `Session` — kopie `pokemon/prisma/schema.prisma:169-177` (`id` je `sha256(token)`).
  - `EntryKind` enum — `WORK`, `VACATION`, `SICK`, `DAYOFF`.
  - `Entry` — `id`, `userId`, `day DateTime @db.Date`, `kind EntryKind @default(WORK)`, `hours Decimal? @db.Decimal(4, 2)`, `fromTime String?` a `toTime String?` (`"HH:MM"`), `place String?`, `note String?`, `createdAt`, `updatedAt`. Index `@@index([userId, day])`. **Žádný unique na `[userId, day]`** — jeden den může mít víc záznamů.
  - `PushSubscription` — kopie `pokemon/prisma/schema.prisma:676-686`.
  - `ReminderLog` — `id`, `userId`, `day DateTime @db.Date`, `sentAt DateTime @default(now())`, `@@unique([userId, day])`. Ten unique je pojistka proti dvojímu pípnutí.

- [ ] **Step 1: Write the schema**

`datasource db` na `postgresql` z `env("DATABASE_URL")`, generator `prisma-client-js` — jako u pokemonu. Modely podle Interfaces výše, s českými komentáři u `tracksFrom`, `periodStartDay` a `ReminderLog`, které vysvětlí, proč existují.

- [ ] **Step 2: Verify the schema is valid**

Run: `cd dohazka && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: Generate the first migration against a local database**

Run: `cd dohazka && npx prisma migrate dev --name init`
Expected: vznikne `prisma/migrations/<timestamp>_init/migration.sql`

Pokud lokální Postgres není, použij `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` a výstup ulož ručně do `prisma/migrations/0_init/migration.sql` plus `migration_lock.toml` s `provider = "postgresql"`.

- [ ] **Step 4: Verify the migration SQL contains the date columns as DATE**

Run: `grep -E '"day" DATE|"tracksFrom" DATE' dohazka/prisma/migrations/*/migration.sql`
Expected: oba výskyty. Pokud je tam `TIMESTAMP`, chybí `@db.Date` a dny se budou rozjíždět o časové zóny.

- [ ] **Step 5: Commit**

```bash
git add dohazka/prisma
git commit -m "Dohazka: datovy model a prvni migrace"
```

---

### Task 3: Přihlášení a zakládání účtů

**Files:**
- Create: `dohazka/src/lib/auth.ts`, `dohazka/src/lib/validation.ts`, `dohazka/src/lib/rate-limit.ts`
- Create: `dohazka/src/app/prihlaseni/page.tsx`, `dohazka/src/app/actions/auth.ts`
- Create: `dohazka/scripts/user-add.ts`
- Modify: `dohazka/package.json` (skript `user:add`)
- Test: `dohazka/tests/auth.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `User`/`Session` (Task 2).
- Produces:
  - `hashPassword(pw: string): Promise<string>`, `verifyPassword(pw: string, hash: string): Promise<boolean>`
  - `sha256(s: string): string`, `randomToken(): string`
  - `createSession(userId: string): Promise<void>`, `destroySession(): Promise<void>`
  - `getCurrentUser(): Promise<User | null>` — cookie `dh_session`, platnost 30 dní, obalené `cache()` z Reactu
  - `requireUser(): Promise<User>` — přesměruje na `/prihlaseni`, když není přihlášený
  - `loginSchema` (zod) → `{ email: string; password: string }`
  - serverová akce `login(formData: FormData): Promise<{ error: string } | never>`, `logout(): Promise<never>`

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/auth.test.ts
import { describe, expect, it } from 'vitest'
import { hashPassword, sha256, verifyPassword } from '@/lib/auth'
import { loginSchema } from '@/lib/validation'

describe('hesla', () => {
  it('ověří správné a odmítne špatné', async () => {
    const hash = await hashPassword('tajne-heslo-123')
    expect(await verifyPassword('tajne-heslo-123', hash)).toBe(true)
    expect(await verifyPassword('tajne-heslo-124', hash)).toBe(false)
  })
  it('hash není heslo', async () => {
    expect(await hashPassword('abc')).not.toContain('abc')
  })
})

describe('sha256', () => {
  it('je stabilní a 64 znaků', () => {
    expect(sha256('token')).toBe(sha256('token'))
    expect(sha256('token')).toHaveLength(64)
  })
})

describe('loginSchema', () => {
  it('vezme platný e-mail a heslo', () => {
    expect(loginSchema.safeParse({ email: 'a@b.cz', password: 'heslo1234' }).success).toBe(true)
  })
  it('odmítne nesmysl', () => {
    expect(loginSchema.safeParse({ email: 'neni-email', password: 'heslo1234' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.cz', password: '' }).success).toBe(false)
  })
})
```

Pozor: `src/lib/auth.ts` má v pokemonu `import 'server-only'`, což by test shodil. Čisté funkce (`hashPassword`, `verifyPassword`, `sha256`, `randomToken`) proto dej do `src/lib/crypto.ts` **bez** `server-only` a z `auth.ts` je jen re-exportuj. Test importuje z `@/lib/auth`; pokud to vitest neustojí, nech test importovat `@/lib/crypto` a `auth.ts` ponech jako serverový obal.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test -- auth`
Expected: FAIL — modul neexistuje

- [ ] **Step 3: Implement `src/lib/crypto.ts`, `src/lib/auth.ts`, `src/lib/validation.ts` a `src/lib/rate-limit.ts`**

`auth.ts` je `pokemon/src/lib/auth.ts` zkrácený: cookie `dh_session`, bez `bannedAt`, bez `touchLastSeen`, bez e-mailových tokenů. `rate-limit.ts` zkopíruj z pokemonu bez úprav.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dohazka && npm test -- auth`
Expected: PASS

- [ ] **Step 5: Implement the login page and server action**

`/prihlaseni` je jednoduchý formulář (e-mail, heslo, odeslat). Akce `login` omezí pokusy přes `rateLimit('login:' + await clientIp(), 10, 15 * 60_000)`, při neúspěchu vrátí jednu obecnou větu `Špatný e-mail nebo heslo.` — nikdy neprozradí, který z nich. Při úspěchu `createSession` a `redirect('/')`.

- [ ] **Step 6: Implement `scripts/user-add.ts` and the `user:add` script**

Spouští se `npm run user:add -- --email a@b.cz --name "Jméno" --tracks-from 2026-11-01`. Heslo nebere z argumentu (zůstalo by v historii shellu): vygeneruje 16 znaků, vypíše ho jednou na konec a uloží hash. Když účet s tím e-mailem existuje, přepíše mu heslo a řekne to — tím se řeší „zapomenuté heslo" z návrhu. Přidej do `package.json` `"user:add": "tsx scripts/user-add.ts"` a `tsx` do devDependencies.

- [ ] **Step 7: Verify typecheck**

Run: `cd dohazka && npm run typecheck`
Expected: bez chyb

- [ ] **Step 8: Commit**

```bash
git add dohazka
git commit -m "Dohazka: prihlaseni, zavrena registrace a skript na zakladani uctu"
```

---

### Task 4: Validace a normalizace zápisu dne

**Files:**
- Create: `dohazka/src/lib/entry.ts`
- Test: `dohazka/tests/entry.test.ts`

**Interfaces:**
- Consumes: nic (čistý modul).
- Produces:
  - `parseHours(raw: string): number | null` — přijme `"8,5"` i `"8.5"`, odmítne vše ostatní a cokoli mimo rozsah 0 (včetně) až 24 (včetně).
  - `parseTime(raw: string): string | null` — normalizuje `"7:00"`, `"07:00"`, `"7.00"` na `"07:00"`; jinak `null`.
  - `hoursFromRange(from: string, to: string): number | null` — rozdíl v hodinách, zaokrouhlený na 2 desetinná místa. Když je `to` dřív než `from`, počítá přes půlnoc.
  - `entrySchema` (zod) → `{ day: string; kind: EntryKindValue; hours: number | null; fromTime: string | null; toTime: string | null; place: string | null; note: string | null }`, kde `EntryKindValue = 'WORK' | 'VACATION' | 'SICK' | 'DAYOFF'`.
  - `validateEntry(input: unknown): { ok: true; value: EntryInput } | { ok: false; error: string }` — jediná česká věta v `error`. Pravidla: u `WORK` jsou hodiny i místo povinné; u ostatních typů jsou hodiny i místo volitelné; `place` se trimuje a nesmí přesáhnout 200 znaků; `note` 500 znaků.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/entry.test.ts
import { describe, expect, it } from 'vitest'
import { hoursFromRange, parseHours, parseTime, validateEntry } from '@/lib/entry'

describe('parseHours', () => {
  it('bere čárku i tečku', () => {
    expect(parseHours('8,5')).toBe(8.5)
    expect(parseHours('8.5')).toBe(8.5)
    expect(parseHours('8')).toBe(8)
    expect(parseHours(' 8,5 ')).toBe(8.5)
  })
  it('odmítne nesmysly a hodnoty mimo rozsah', () => {
    for (const bad of ['', 'osm', '8,5,5', '-3', '25', '24,5', 'NaN', '1e3']) {
      expect(parseHours(bad), bad).toBeNull()
    }
  })
  it('nula je platná', () => {
    expect(parseHours('0')).toBe(0)
  })
})

describe('parseTime', () => {
  it('normalizuje na HH:MM', () => {
    expect(parseTime('7:00')).toBe('07:00')
    expect(parseTime('07:00')).toBe('07:00')
    expect(parseTime('7.00')).toBe('07:00')
    expect(parseTime('23:59')).toBe('23:59')
  })
  it('odmítne neplatný čas', () => {
    for (const bad of ['', '24:00', '7:60', '-1:00', 'ráno']) expect(parseTime(bad), bad).toBeNull()
  })
})

describe('hoursFromRange', () => {
  it('spočítá běžnou směnu', () => {
    expect(hoursFromRange('07:00', '15:30')).toBe(8.5)
  })
  it('noční směna přes půlnoc není negativní', () => {
    expect(hoursFromRange('22:00', '06:00')).toBe(8)
  })
  it('stejný čas je nula', () => {
    expect(hoursFromRange('07:00', '07:00')).toBe(0)
  })
})

describe('validateEntry', () => {
  const base = { day: '2026-11-08', kind: 'WORK', fromTime: null, toTime: null, note: null }
  it('práce potřebuje hodiny i místo', () => {
    expect(validateEntry({ ...base, hours: '8', place: 'Zlín' }).ok).toBe(true)
    expect(validateEntry({ ...base, hours: '8', place: '  ' }).ok).toBe(false)
    expect(validateEntry({ ...base, hours: '', place: 'Zlín' }).ok).toBe(false)
  })
  it('volno nepotřebuje ani hodiny, ani místo', () => {
    const r = validateEntry({ ...base, kind: 'DAYOFF', hours: '', place: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.hours).toBeNull()
  })
  it('místo se trimuje a dlouhé se odmítne', () => {
    const r = validateEntry({ ...base, hours: '8', place: '  Zlín  ' })
    expect(r.ok && r.value.place).toBe('Zlín')
    expect(validateEntry({ ...base, hours: '8', place: 'x'.repeat(201) }).ok).toBe(false)
  })
  it('neznámý typ dne neprojde', () => {
    expect(validateEntry({ ...base, kind: 'DOVOLENA', hours: '8', place: 'Zlín' }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test -- entry`
Expected: FAIL — `Cannot find module '@/lib/entry'`

- [ ] **Step 3: Implement `src/lib/entry.ts` with the signatures from Interfaces**

`parseHours` kontroluje tvar regulárním výrazem (`^\d{1,2}([.,]\d{1,2})?$`) **před** převodem na číslo — `Number()` samo spolkne `"1e3"` i `" 8 "` a vrátí číslo tam, kde to nikdo nechce.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dohazka && npm test -- entry`
Expected: PASS, 4 describe bloky

- [ ] **Step 5: Commit**

```bash
git add dohazka/src/lib/entry.ts dohazka/tests/entry.test.ts
git commit -m "Dohazka: validace a normalizace zapisu dne"
```

---

### Task 5: Obrazovka zápisu dne

**Files:**
- Create: `dohazka/src/app/den/[day]/page.tsx`, `dohazka/src/app/den/DayForm.tsx`
- Create: `dohazka/src/app/actions/entry.ts`
- Create: `dohazka/src/lib/places.ts`
- Modify: `dohazka/src/app/page.tsx` (přesměrování na dnešní den)
- Test: `dohazka/tests/places.test.ts`

**Interfaces:**
- Consumes: `validateEntry`, `parseDayKey`, `pragueDayKey` (Tasks 1, 4), `requireUser` (Task 3), `Entry` (Task 2).
- Produces:
  - `recentPlaces(entries: { place: string | null; day: string }[], limit?: number): string[]` — nedávno použitá místa, bez duplicit, nejčerstvější první, výchozí `limit` 5.
  - serverové akce: `saveEntry(formData: FormData): Promise<{ error: string } | { ok: true }>`, `deleteEntry(id: string): Promise<{ ok: boolean }>`, `markDayOff(day: string): Promise<{ ok: boolean }>` (zapíše jeden `DAYOFF` bez hodin a smaže ostatní záznamy toho dne).

- [ ] **Step 1: Write the failing test**

```ts
// dohazka/tests/places.test.ts
import { describe, expect, it } from 'vitest'
import { recentPlaces } from '@/lib/places'

describe('recentPlaces', () => {
  const entries = [
    { place: 'Zlín', day: '2026-11-07' },
    { place: 'Otrokovice', day: '2026-11-06' },
    { place: 'Zlín', day: '2026-11-05' },
    { place: null, day: '2026-11-04' },
    { place: '  Vsetín  ', day: '2026-11-03' },
  ]
  it('bez duplicit, nejčerstvější první', () => {
    expect(recentPlaces(entries)).toEqual(['Zlín', 'Otrokovice', 'Vsetín'])
  })
  it('respektuje limit a přeskočí prázdná místa', () => {
    expect(recentPlaces(entries, 2)).toEqual(['Zlín', 'Otrokovice'])
    expect(recentPlaces([{ place: null, day: '2026-11-01' }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dohazka && npm test -- places`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/places.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dohazka && npm test -- places`
Expected: PASS

- [ ] **Step 5: Implement the server actions in `src/app/actions/entry.ts`**

Každá akce si vezme `requireUser()`, projde `validateEntry`, a sahá jen na záznamy toho uživatele (`where: { id, userId: user.id }`) — nikdy jen podle `id`. Na konci `revalidatePath` dne a měsíce.

- [ ] **Step 6: Implement the day screen**

`/den/[day]`, kde `day` je `YYYY-MM-DD`; `/` přesměruje na `pragueDayKey(new Date())`. Nahoře datum s odkazy na předchozí a další den. Velké pole na hodiny, pod ním místo s nabídkou z `recentPlaces` (datalist, aby se dalo i psát). Pod `<details>` od–do, druhý záznam, typ dne a poznámka. Dole „Uložit" a vedle nenápadné „Nepracoval", které volá `markDayOff`. Už zapsané záznamy toho dne jsou nad formulářem, každý s možností smazat. Když je vyplněné od–do a hodiny prázdné, klient hodiny **předvyplní** z `hoursFromRange`; když už v nich něco je, nesahá na ně.

- [ ] **Step 7: Verify typecheck and that the page renders**

Run: `cd dohazka && npm run typecheck`
Expected: bez chyb

- [ ] **Step 8: Commit**

```bash
git add dohazka
git commit -m "Dohazka: obrazovka zapisu dne a serverove akce"
```

---

### Task 6: Měsíc — souhrn, seznam dnů a prázdná místa

**Files:**
- Create: `dohazka/src/lib/month.ts`
- Create: `dohazka/src/app/mesic/[period]/page.tsx`, `dohazka/src/app/mesic/MonthList.tsx`
- Test: `dohazka/tests/month.test.ts`

**Interfaces:**
- Consumes: `periodRange`, `dayKeysInRange`, `formatHours` (Task 1), `requireUser` (Task 3), `Entry` (Task 2), `EntryKindValue` (Task 4).
- Produces:
  - `type MonthRow = { dayKey: string; entries: EntryRow[]; hours: number; state: 'filled' | 'empty' | 'before-start' }`
  - `type EntryRow = { id: string; kind: EntryKindValue; hours: number | null; fromTime: string | null; toTime: string | null; place: string | null; note: string | null }`
  - `buildMonth(args: { fromKey: string; toKey: string; tracksFromKey: string; entries: (EntryRow & { dayKey: string })[] }): { rows: MonthRow[]; totalHours: number; daysWorked: number }`
    - `rows` jsou všechny dny období, od nejnovějšího.
    - `state` je `'before-start'` pro dny před `tracksFromKey` — ty se nepočítají jako prázdné.
    - `totalHours` je součet hodin všech záznamů období.
    - `daysWorked` počítá dny, které mají aspoň jeden záznam typu `WORK`. `DAYOFF` se do nich nepočítá.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/month.test.ts
import { describe, expect, it } from 'vitest'
import { buildMonth } from '@/lib/month'

const e = (dayKey: string, hours: number | null, place: string | null, kind = 'WORK') =>
  ({ id: dayKey + kind + place, dayKey, kind, hours, fromTime: null, toTime: null, place, note: null }) as never

describe('buildMonth', () => {
  it('sečte hodiny a spočítá dny, dva záznamy v jednom dni se sloučí', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-03',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-02', 4, 'Zlín'), e('2026-11-02', 4, 'Vsetín'), e('2026-11-03', 8.5, 'Otrokovice')],
    })
    expect(r.totalHours).toBe(16.5)
    expect(r.daysWorked).toBe(2)
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0].dayKey).toBe('2026-11-03') // nejnovější první
    expect(r.rows.find((x) => x.dayKey === '2026-11-02')!.entries).toHaveLength(2)
  })
  it('den bez záznamu je prázdný, den před tracksFrom není', () => {
    const r = buildMonth({ fromKey: '2026-11-01', toKey: '2026-11-03', tracksFromKey: '2026-11-03', entries: [] })
    expect(r.rows.map((x) => x.state)).toEqual(['empty', 'before-start', 'before-start'])
  })
  it('volno se nepočítá jako odpracovaný den', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-02',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-01', null, null, 'DAYOFF'), e('2026-11-02', 8, 'Zlín')],
    })
    expect(r.daysWorked).toBe(1)
    expect(r.totalHours).toBe(8)
  })
  it('prázdné období nespadne', () => {
    const r = buildMonth({ fromKey: '2026-11-01', toKey: '2026-11-30', tracksFromKey: '2026-11-01', entries: [] })
    expect(r.totalHours).toBe(0)
    expect(r.daysWorked).toBe(0)
    expect(r.rows).toHaveLength(30)
  })
  it('součet neplave', () => {
    const r = buildMonth({
      fromKey: '2026-11-01',
      toKey: '2026-11-03',
      tracksFromKey: '2026-11-01',
      entries: [e('2026-11-01', 7.7, 'Zlín'), e('2026-11-02', 0.1, 'Zlín'), e('2026-11-03', 0.2, 'Zlín')],
    })
    expect(r.totalHours).toBe(8)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test -- month`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/month.ts`**

Součty počítej v celých setinách (hodiny × 100, sečti, vyděl 100), ne sčítáním `Float` — poslední test to hlídá. Prisma vrací `hours` jako `Decimal`; stránka ho převede na `number` dřív, než `buildMonth` zavolá, aby modul zůstal čistý a testovatelný bez Prismy.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dohazka && npm test -- month`
Expected: PASS, 5 testů

- [ ] **Step 5: Implement the month screen**

`/mesic/[period]`, kde `period` je `YYYY-MM`; odkaz na dnešní měsíc je v hlavičce. Nahoře dvě čísla (hodiny, dny) jako v mockupu. Pod tím seznam dnů; `empty` dny jsou tiše šedé, `before-start` se nevypisují vůbec. Každý den je odkaz na `/den/[day]`. Dole tři tlačítka exportu (zapojí se v Tasks 7 a 8). Přepínání měsíců odkazy na předchozí a další `period`.

- [ ] **Step 6: Verify typecheck**

Run: `cd dohazka && npm run typecheck`
Expected: bez chyb

- [ ] **Step 7: Commit**

```bash
git add dohazka
git commit -m "Dohazka: mesicni prehled se souctem a prazdnymi dny"
```

---

### Task 7: Export CSV a Excel

**Files:**
- Create: `dohazka/src/lib/export/rows.ts`, `dohazka/src/lib/export/csv.ts`, `dohazka/src/lib/export/xlsx.ts`
- Create: `dohazka/src/app/api/export/[format]/route.ts`
- Modify: `dohazka/package.json` (`exceljs`)
- Test: `dohazka/tests/export-csv.test.ts`, `dohazka/tests/export-xlsx.test.ts`

**Interfaces:**
- Consumes: `buildMonth` a jeho typy (Task 6), `formatHours` (Task 1), `requireUser` (Task 3).
- Produces:
  - `type ReportRow = { dayKey: string; weekday: string; fromTime: string; toTime: string; hours: string; place: string; kind: string; note: string }` — všechna pole už jako hotové české texty, prázdno je `''`.
  - `type Report = { title: string; personName: string; periodLabel: string; rows: ReportRow[]; totalHours: string; daysWorked: number }`
  - `buildReport(args: { personName: string; fromKey: string; toKey: string; month: ReturnType<typeof buildMonth> }): Report` — vynechá dny bez záznamu i `before-start` dny; `kind` je `''` u práce, jinak `Dovolená` / `Nemoc` / `Volno`.
  - `toCsv(report: Report): string` — středník jako oddělovač, `\r\n` konce řádků, BOM `\uFEFF` na začátku, hodnoty s `;` nebo `"` v dvojitých uvozovkách.
  - `toXlsx(report: Report): Promise<Buffer>` — jeden list „Výkaz", hlavička, řádky, součtový řádek.
  - route `GET /api/export/[format]?period=YYYY-MM` pro `format` ∈ `csv` | `xlsx` | `pdf`, s `Content-Disposition: attachment` a jménem `dohazka-<jmeno>-<period>.<ext>`.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/export-csv.test.ts
import { describe, expect, it } from 'vitest'
import { toCsv } from '@/lib/export/csv'
import type { Report } from '@/lib/export/rows'

const report = (rows: Report['rows']): Report => ({
  title: 'Výkaz odpracovaných hodin',
  personName: 'Jan Novák',
  periodLabel: 'listopad 2026',
  rows,
  totalHours: rows.length ? '16,5' : '0',
  daysWorked: rows.length,
})

describe('toCsv', () => {
  const row = { dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '07:00', toTime: '15:30', hours: '8,5', place: 'Zlín', kind: '', note: '' }
  it('má BOM, středníky a CRLF', () => {
    const csv = toCsv(report([row]))
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Datum;Den;Od;Do;Hodiny;Místo;Typ;Poznámka\r\n')
    expect(csv).toContain('2026-11-02;pondělí;07:00;15:30;8,5;Zlín;;\r\n')
  })
  it('uvozuje hodnoty se středníkem a uvozovkou', () => {
    const csv = toCsv(report([{ ...row, place: 'Zlín; Vsetín', note: 'řekl "ano"' }]))
    expect(csv).toContain('"Zlín; Vsetín"')
    expect(csv).toContain('"řekl ""ano"""')
  })
  it('prázdný měsíc má hlavičku a nulový součet', () => {
    const csv = toCsv(report([]))
    expect(csv).toContain('Datum;Den;Od;Do;Hodiny;Místo;Typ;Poznámka')
    expect(csv).toContain('0')
  })
})
```

```ts
// dohazka/tests/export-xlsx.test.ts
import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { toXlsx } from '@/lib/export/xlsx'
import type { Report } from '@/lib/export/rows'

const empty: Report = { title: 'Výkaz odpracovaných hodin', personName: 'Jan Novák', periodLabel: 'listopad 2026', rows: [], totalHours: '0', daysWorked: 0 }

describe('toXlsx', () => {
  it('vyrobí skutečný xlsx, ne csv s jinou příponou', async () => {
    const buf = await toXlsx({ ...empty, rows: [{ dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '', toTime: '', hours: '8,5', place: 'Zlín', kind: '', note: '' }], totalHours: '8,5', daysWorked: 1 })
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK') // zip
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('Výkaz')!
    expect(ws.getCell('A1').value).toContain('Jan Novák')
    expect(ws.getCell('F4').value).toBe('Zlín')
  })
  it('prázdný měsíc nespadne', async () => {
    const buf = await toXlsx(empty)
    expect(buf.length).toBeGreaterThan(0)
  })
})
```

Řádek `F4` předpokládá: 1. řádek jméno a období, 2. prázdný, 3. hlavička, 4. první data. Když zvolíš jiné rozvržení, srovnej test s ním — jen ať test zkoumá konkrétní buňku, ne jen délku bufferu.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test -- export`
Expected: FAIL

- [ ] **Step 3: Install exceljs and implement `rows.ts`, `csv.ts`, `xlsx.ts`**

Run: `cd dohazka && npm install exceljs`
Názvy dnů česky z `Intl.DateTimeFormat('cs-CZ', { weekday: 'long' })`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dohazka && npm test -- export`
Expected: PASS

- [ ] **Step 5: Implement the export route for csv and xlsx**

Route si vezme `requireUser()`, spočítá období z `user.periodStartDay` a `?period=`, načte záznamy a složí `Report`. Neznámý `format` nebo rozsypané `period` → 400. `pdf` zatím vrací 501; dodělá ho Task 8.

- [ ] **Step 6: Commit**

```bash
git add dohazka
git commit -m "Dohazka: export CSV a Excel"
```

---

### Task 8: Export PDF

**Files:**
- Create: `dohazka/src/lib/export/pdf.ts`
- Modify: `dohazka/src/app/api/export/[format]/route.ts` (zapojit pdf)
- Modify: `dohazka/package.json` (`pdfkit`), `dohazka/Dockerfile` (font)
- Test: `dohazka/tests/export-pdf.test.ts`

**Interfaces:**
- Consumes: `Report` (Task 7).
- Produces:
  - `resolvePdfFont(candidates?: string[]): string` — vrátí první existující cestu k TTF. Výchozí seznam: `process.env.DOHAZKA_PDF_FONT`, `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`, `C:\\Windows\\Fonts\\arial.ttf`. Když žádná neexistuje, vyhodí `Error` s českou větou, co doinstalovat.
  - `toPdf(report: Report): Promise<Buffer>` — A4 na výšku, jedna stránka na období.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/export-pdf.test.ts
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolvePdfFont, toPdf } from '@/lib/export/pdf'
import type { Report } from '@/lib/export/rows'

const empty: Report = { title: 'Výkaz odpracovaných hodin', personName: 'Jan Novák', periodLabel: 'listopad 2026', rows: [], totalHours: '0', daysWorked: 0 }

describe('resolvePdfFont', () => {
  it('vybere existující cestu', () => {
    expect(existsSync(resolvePdfFont())).toBe(true)
  })
  it('bez fontu řekne proč, místo aby spadl na undefined', () => {
    expect(() => resolvePdfFont(['/takovy/font/neexistuje.ttf'])).toThrow(/font/i)
  })
})

describe('toPdf', () => {
  it('vyrobí PDF s českou diakritikou', async () => {
    const buf = await toPdf({ ...empty, rows: [{ dayKey: '2026-11-02', weekday: 'pondělí', fromTime: '', toTime: '', hours: '8,5', place: 'Zlín', kind: '', note: '' }], totalHours: '8,5', daysWorked: 1 })
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(1000)
  })
  it('prázdný měsíc vyrobí PDF s hlavičkou, ne chybu', async () => {
    const buf = await toPdf(empty)
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test -- export-pdf`
Expected: FAIL

- [ ] **Step 3: Install pdfkit and implement `src/lib/export/pdf.ts`**

Run: `cd dohazka && npm install pdfkit && npm install -D @types/pdfkit`
`toPdf` posbírá `doc` do bufferu přes `on('data')` / `on('end')`. Font registruj přes `doc.registerFont('body', resolvePdfFont())` a používej jen ten — vestavěná Helvetica nemá české znaky a diakritika by se tiše rozsypala.

- [ ] **Step 4: Add the font to the Docker image**

V `dohazka/Dockerfile` do `apt-get install` ve stage `base` přidej `fonts-dejavu-core`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd dohazka && npm test -- export-pdf`
Expected: PASS

- [ ] **Step 6: Wire pdf into the export route and verify all three formats**

Run: `cd dohazka && npm run typecheck && npm test`
Expected: bez chyb, všechny testy PASS

- [ ] **Step 7: Commit**

```bash
git add dohazka
git commit -m "Dohazka: export PDF bez prohlizece, font s diakritikou v imagi"
```

> **Pozn. k rozvržení:** hlavička, podpisové řádky a identifikace firmy čekají na fotku papírového výkazu (viz spec). `toPdf` proto bere všechny texty z `Report`; až fotka přijde, mění se jen rozvržení v tomhle jednom souboru, ne datová cesta.

---

### Task 9: Instalace na plochu a push odběr

**Files:**
- Create: `dohazka/public/sw.js`, `dohazka/public/manifest.webmanifest`, `dohazka/public/icons/icon-192.png`, `dohazka/public/icons/icon-512.png`
- Create: `dohazka/src/lib/push.ts`, `dohazka/src/app/actions/push.ts`, `dohazka/src/components/Push.tsx`
- Create: `dohazka/src/app/nastaveni/page.tsx`
- Modify: `dohazka/package.json` (`web-push`), `dohazka/src/app/layout.tsx` (manifest)
- Test: `dohazka/tests/push.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `getCurrentUser` (Task 3), `PushSubscription`/`User` (Task 2).
- Produces:
  - `isPushEndpoint(endpoint: string): boolean` — kopie z `pokemon/src/lib/push.ts`, ochrana proti SSRF.
  - `pushPublicKey(): string | null`
  - `sendPush(userId: string, n: { title: string; body?: string; url?: string }): Promise<{ sent: number; skipped?: string }>` — neplatné odběry (404/410) maže, nikdy nevyhodí chybu. **Bez nočního klidu** — pípá se v 19:00, žádné časové okno tu nepatří.
  - serverové akce `savePushSubscription(sub)`, `removePushSubscription(endpoint)`, `setReminder(opts: { enabled: boolean; hour: number })`, `sendTestPush()`.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/push.test.ts
import { describe, expect, it } from 'vitest'
import { isPushEndpoint } from '@/lib/push'

describe('isPushEndpoint', () => {
  it('pustí jen skutečné push služby prohlížečů', () => {
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true)
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
  })
  it('odmítne cokoli, co by server donutilo zavolat domů nebo jinam', () => {
    for (const bad of [
      'http://web.push.apple.com/abc',
      'https://web.push.apple.com:8443/abc',
      'https://user:pw@web.push.apple.com/abc',
      'https://127.0.0.1/abc',
      'https://localhost/abc',
      'https://evil.example.com/abc',
      'https://web.push.apple.com.evil.example.com/abc',
      'not-a-url',
      '',
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dohazka && npm test -- push`
Expected: FAIL

- [ ] **Step 3: Install web-push and implement `src/lib/push.ts`**

Run: `cd dohazka && npm install web-push && npm install -D @types/web-push`
Vezmi `pokemon/src/lib/push.ts` a vyhoď z něj noční klid (`QUIET_FROM`, `isQuietNow`, `quietApplies`) i `flagPushAsk`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dohazka && npm test -- push`
Expected: PASS

- [ ] **Step 5: Add the service worker, manifest and icons**

`public/sw.js` je kopie z pokemonu s výchozí adresou `/` místo `/upozorneni`. `manifest.webmanifest` má `display: "standalone"`, `start_url: "/"`, české `name` a `short_name` a obě ikony. Ikony vyrob jako jednoduchý monogram — nekopíruj pokémoní.

- [ ] **Step 6: Implement the subscribe component and settings page**

`Push.tsx` vezmi z `pokemon/src/components/Push.tsx`, nech z něj `enablePush`, `disablePush`, `keyBytes`, `isIosBrowser` a stavový přehled; vyhoď i18n, noční klid a dětské účty. `/nastaveni` má: zapnutí notifikací na tomhle zařízení, hodinu připomínky (select 0–23), zkušební pípnutí a odhlášení. Když `isIosBrowser()` hlásí, že web není na ploše, ukaž větu „Na iPhonu fungují notifikace jen v aplikaci na ploše: Sdílet → Přidat na plochu, pak ji otevři z plochy." — bez toho nebude kamarádovi pípat nic a nepozná proč.

- [ ] **Step 7: Verify typecheck**

Run: `cd dohazka && npm run typecheck`
Expected: bez chyb

- [ ] **Step 8: Commit**

```bash
git add dohazka
git commit -m "Dohazka: instalace na plochu, service worker a push odber"
```

---

### Task 10: Večerní připomínka

**Files:**
- Create: `dohazka/src/lib/reminder.ts`, `dohazka/src/app/api/cron/reminder/route.ts`
- Create: `dohazka/deploy/dohazka-reminder.service`, `dohazka/deploy/dohazka-reminder.timer`
- Test: `dohazka/tests/reminder.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1), `sendPush` (Task 9), `pragueDayKey`/`pragueHour` (Task 1), `User`/`Entry`/`ReminderLog` (Task 2).
- Produces:
  - `shouldRemind(args: { nowHour: number; todayKey: string; user: { remindEnabled: boolean; remindHour: number; tracksFromKey: string }; hasEntryToday: boolean; alreadyRemindedToday: boolean }): boolean`
  - `runReminder(opts?: { now?: Date; force?: boolean }): Promise<{ checked: number; sent: number }>` — projde uživatele s odběrem, pro každého zavolá `shouldRemind`, pošle push („Zapiš si dnešní hodiny", odkaz `/`) a zapíše `ReminderLog`. `ReminderLog` zapisuje **před** odesláním a chybu unique bere jako „už odesláno, přeskoč" — tím je dvojí pípnutí vyloučené i při dvou souběžných spuštěních.

- [ ] **Step 1: Write the failing tests**

```ts
// dohazka/tests/reminder.test.ts
import { describe, expect, it } from 'vitest'
import { shouldRemind } from '@/lib/reminder'

const user = { remindEnabled: true, remindHour: 19, tracksFromKey: '2026-01-01' }
const base = { nowHour: 19, todayKey: '2026-11-08', user, hasEntryToday: false, alreadyRemindedToday: false }

describe('shouldRemind', () => {
  it('pípne ve svou hodinu, když není zapsáno', () => {
    expect(shouldRemind(base)).toBe(true)
  })
  it('pípne i hodinu po termínu, ale ne po dvou', () => {
    expect(shouldRemind({ ...base, nowHour: 20 })).toBe(true)
    expect(shouldRemind({ ...base, nowHour: 21 })).toBe(true)
    expect(shouldRemind({ ...base, nowHour: 22 })).toBe(false)
    expect(shouldRemind({ ...base, nowHour: 2 })).toBe(false)
  })
  it('nepípne před svou hodinou', () => {
    expect(shouldRemind({ ...base, nowHour: 18 })).toBe(false)
  })
  it('nepípne, když už je zapsáno nebo odbyto', () => {
    expect(shouldRemind({ ...base, hasEntryToday: true })).toBe(false)
  })
  it('nepípne dvakrát za den', () => {
    expect(shouldRemind({ ...base, alreadyRemindedToday: true })).toBe(false)
  })
  it('nepípne vypnutým', () => {
    expect(shouldRemind({ ...base, user: { ...user, remindEnabled: false } })).toBe(false)
  })
  it('nepípne před datem, od kdy si zapisuje', () => {
    expect(shouldRemind({ ...base, user: { ...user, tracksFromKey: '2026-12-01' } })).toBe(false)
  })
  it('pípne i v sobotu a na Vánoce', () => {
    expect(shouldRemind({ ...base, todayKey: '2026-11-07' })).toBe(true) // sobota
    expect(shouldRemind({ ...base, todayKey: '2026-12-24' })).toBe(true)
  })
  it('hodina 23 má okno jen do konce dne, ne do rána', () => {
    expect(shouldRemind({ ...base, nowHour: 23, user: { ...user, remindHour: 23 } })).toBe(true)
    expect(shouldRemind({ ...base, nowHour: 0, user: { ...user, remindHour: 23 } })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dohazka && npm test -- reminder`
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/reminder.ts`**

Okno je `nowHour >= remindHour && nowHour <= remindHour + 2`, počítané **bez** přetečení přes půlnoc — po půlnoci je `todayKey` už jiný den, takže připomínka za včerejšek propadá úmyslně (viz spec: telefon nemá pípat ve dvě ráno).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dohazka && npm test -- reminder`
Expected: PASS, 9 testů

- [ ] **Step 5: Implement the cron route**

`POST /api/cron/reminder` podle `pokemon/src/app/api/cron/weekly-digest/route.ts`: `authorization: Bearer ${CRON_SECRET}`, jinak 401; `?force=1` pro ruční test mimo čas. `export const dynamic = 'force-dynamic'`.

- [ ] **Step 6: Write the systemd units**

`dohazka-reminder.timer` s `OnCalendar=*-*-* *:05:00`, `Persistent=true`, `RandomizedDelaySec=60` — každou hodinu, pět minut po, aby to nekolidovalo s ostatními timery. `dohazka-reminder.service` je `Type=oneshot`, který zavolá `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3500/api/cron/reminder`, secret čte přes `EnvironmentFile=/opt/jede/dohazka.env` (ne na příkazové řádce, kde by ho viděl každý `ps`).

- [ ] **Step 7: Verify typecheck and the whole suite**

Run: `cd dohazka && npm run typecheck && npm test`
Expected: bez chyb, všechno PASS

- [ ] **Step 8: Commit**

```bash
git add dohazka
git commit -m "Dohazka: vecerni pripominka kazdy den s oknem dvou hodin"
```

---

### Task 11: Nasazení — image, compose, nginx, deploy a záloha

**Files:**
- Create: `dohazka/Dockerfile`
- Create: `dohazka/deploy/docker-compose.yml`, `dohazka/deploy/nginx-dohazka.jede.online.conf`, `dohazka/deploy/deploy-dohazka.sh`, `dohazka/deploy/backup-dohazka.sh`, `dohazka/deploy/dohazka-backup.service`, `dohazka/deploy/dohazka-backup.timer`, `dohazka/deploy/init-db.sql`, `dohazka/deploy/.env.example`, `dohazka/deploy/README.md`

**Interfaces:**
- Consumes: health endpoint (Task 1), cron endpoint (Task 10).
- Produces: nic pro další úkoly; tohle je poslední.

- [ ] **Step 1: Write the Dockerfile**

Kopie `pokemon/Dockerfile` s `fonts-dejavu-core` v `apt-get install` (Task 8) a bez pokémoních zvláštností. Stage `builder` zůstává migrační bránou.

- [ ] **Step 2: Write the compose file**

Podle `pokemon/deploy/docker-compose.yml`: `name: dohazka`, služba `dohazka` na `127.0.0.1:3500:3000`, služba `dohazka-migrate` v profilu `tools`, externí síť `jede_default`. Proměnné **vypsané jmenovitě** (co tam není, do kontejneru nedojde): `NODE_ENV`, `TZ: Europe/Prague`, `DATABASE_URL: ${DOHAZKA_DATABASE_URL}`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `DOHAZKA_PDF_FONT`, `GIT_COMMIT`.

- [ ] **Step 3: Write the nginx config**

Podle `pokemon/deploy/nginx-pokemon.jede.online.conf`, ale **bez** keše obrázků a proxy na cizí CDN: jen přesměrování 80 → 443, certifikát, bezpečnostní hlavičky (HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) a `location /` na `127.0.0.1:3500`. V komentáři nahoře nech příkaz na certbot a cestu k acme webrootu `/opt/jede/dohazka-acme`.

- [ ] **Step 4: Write the deploy script**

Kopie `pokemon/deploy/deploy-pokemon.sh` s cestami `dohazka`, `HEALTH=http://127.0.0.1:3500/api/health` a `ENVF=/opt/jede/dohazka.env`. **Všech sedm pojistek zůstává**: kontrola IP serveru, hard reset na `origin/$BRANCH` (ne `git pull`, nikdy `git clean`), build gate před výměnou kontejneru, přestavba i migračního image, migrační brána na drift, `prisma migrate deploy`, výměna kontejneru, restart nginxu a smoke test, který ověří `"db":"up"` i běžící commit.

- [ ] **Step 5: Write the backup script and its units**

Podle `pokemon/deploy/backup-pokemon.sh`: `pg_dump` databáze `dohazka`, ověření, že dump vznikl a není prázdný, rotace. Timer na `03:25` pražského času (pokemon má 03:05, ať se nepotkají).

- [ ] **Step 6: Write `init-db.sql` and `.env.example`**

`init-db.sql`: `CREATE USER dohazka WITH PASSWORD 'ZMEN_HESLO'; CREATE DATABASE dohazka OWNER dohazka;`. `.env.example` vypíše všechny proměnné z compose s prázdnými hodnotami a u VAPID klíčů poznámku, že se generují `npx web-push generate-vapid-keys`.

- [ ] **Step 7: Write `deploy/README.md` — the server checklist**

V pořadí, jak se to dělá, a výslovně to, co není v mojí moci:
1. `A` záznam `dohazka.jede.online` → `178.104.231.220` **u WEDOSu, dělá majitel**.
2. Ověřit, že Hetzner Backups na stroji běží — podle spec je to podmínka nasazení.
3. `init-db.sql` do postgresu, `/opt/jede/dohazka.env` podle `.env.example`, VAPID klíče, `CRON_SECRET`.
4. nginx vhost, certbot.
5. `deploy-dohazka.sh`.
6. Nainstalovat a zapnout obě dvojice unit (připomínka, záloha).
7. `npm run user:add` pro kamarádův účet.
8. Na iPhonu: otevřít, Sdílet → Přidat na plochu, otevřít z plochy, povolit notifikace, poslat zkušební pípnutí.

- [ ] **Step 8: Verify the shell scripts parse and the image builds**

Run: `bash -n dohazka/deploy/deploy-dohazka.sh && bash -n dohazka/deploy/backup-dohazka.sh`
Expected: bez výstupu

Run: `cd dohazka && npm run build`
Expected: build projde a vznikne `.next/standalone/server.js`

- [ ] **Step 9: Commit**

```bash
git add dohazka
git commit -m "Dohazka: Dockerfile, compose, nginx, deploy skript a zaloha"
```
