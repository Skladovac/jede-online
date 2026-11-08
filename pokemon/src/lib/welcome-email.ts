import 'server-only'
import { prisma } from '@/lib/prisma'
import { APP_URL, esc, notify } from '@/lib/email'
import { tFor } from '@/lib/i18n/server'

/**
 * Uvítací e-mail s přehledem funkcí — jednou na uživatele, hned po ověření e-mailu.
 * Záměrně bez naší fotkové AI (placená): focení karet vedeme přes vlastní AI uživatele (jeho účet, u nás zdarma).
 */
export async function sendWelcomeIfNeeded(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, nickname: true, locale: true, isMinor: true, parentEmail: true, emailVerifiedAt: true, bannedAt: true, welcomeSentAt: true },
  })
  if (!u || !u.emailVerifiedAt || u.bannedAt || u.welcomeSentAt) return false
  // Příznak napřed — kdyby dvě cesty (ověření + přihlášení přes Google) proběhly zároveň, odejde jen jeden.
  const claimed = await prisma.user.updateMany({ where: { id: u.id, welcomeSentAt: null }, data: { welcomeSentAt: new Date() } })
  if (!claimed.count) return false
  const tt = tFor(u.locale)
  const link = (path: string, label: string) => `<a href="${APP_URL}${path}" style="color:#1d4e89;font-weight:600">${esc(label)} →</a>`
  const block = (title: string, text: string, path: string, label: string) =>
    `<strong>${esc(title)}</strong><br>${esc(text)}<br>${link(path, label)}`
  const ok = await notify(
    u.email,
    u.isMinor && u.parentEmail ? [u.parentEmail] : [],
    tt('Co všechno umí pokemon.jede.online'),
    [
      tt('Ahoj <strong>{name}</strong>,', { name: esc(u.nickname) }),
      tt('e-mail máš potvrzený. Tady je v kostce, co web umí — ať z něj dostaneš maximum.'),
      block(
        tt('1. Sady jako album'),
        tt('Otevři sadu, kterou sbíráš, a odklikej karty, které máš. Hned vidíš, co chybí a kolik zbývá. Vyber si, co sbíráš: Base (základní karty), Complete (i secret) nebo Master (všechny varianty — normal, holo, reverse). Zobrazení „Seznam“ má políčka variant u každé karty.'),
        '/sady', tt('Všechny sady'),
      ),
      block(
        tt('2. Přidávání karet číslem'),
        tt('V Moje sbírka napiš jen číslo karty, třeba „MEP 101, SVI 045, 2x 30C 071“ — web kartu pozná a přidá. Rychlé i pro celý balík.'),
        '/sbirka', tt('Moje sbírka'),
      ),
      block(
        tt('3. Výměny a tržiště'),
        tt('Označ, co ti chybí, a web ti ukáže sběratele, kteří to mají — nejdřív ty, se kterými jde udělat výměnu oběma směry. Karty navíc nabídni k výměně nebo prodeji; obchod jde domluvit v chatu a potvrdit s hodnocením.'),
        '/sberatele', tt('Najdi sběratele'),
      ),
      block(
        tt('4. Jak fungují ceny'),
        tt('U každé karty je orientační cena z Cardmarketu (trend prodejů), aktualizuje se jednou denně. Částky v Kč jsou přepočet z eur kurzem ČNB — je to vodítko pro férovou výměnu, ne výkupní cena.'),
        '/sady', tt('Podívat se na ceny'),
      ),
      block(
        tt('5. Propoj svou AI (ChatGPT, Claude…)'),
        tt('V Můj účet si vytvoř klíč a vlož ho do své AI. Pak jí stačí poslat fotku karty a napsat „přidej do sbírky“, nebo se zeptat „které karty ze sady 151 mi chybí“. Běží to na tvém účtu u AI, u nás je to zdarma.'),
        '/ucet', tt('Nastavit propojení'),
      ),
      block(
        tt('6. Odznaky, kamarádi, chyby'),
        tt('Za sbírání a férové obchody sbíráš odznaky na profilu. Pozvi kamarády odkazem ze svého účtu. A když něco nefunguje, napiš nám přes „Nahlásit chybu“ v patičce — opravdu to čteme.'),
        '/ucet', tt('Můj účet'),
      ),
    ],
    { label: tt('Otevřít pokemon.jede.online'), url: `${APP_URL}/` },
    u.locale,
  )
  if (!ok) await prisma.user.update({ where: { id: u.id }, data: { welcomeSentAt: null } })
  return ok
}

/** Jednorázové dorovnání pro stávající ověřené uživatele (ruční spuštění přes cron endpoint). */
export async function runWelcomeBackfill(limit = 200) {
  const users = await prisma.user.findMany({
    where: { emailVerifiedAt: { not: null }, bannedAt: null, welcomeSentAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  let sent = 0
  let failed = 0
  for (const u of users) {
    try {
      if (await sendWelcomeIfNeeded(u.id)) sent++
      else failed++
    } catch (err) {
      failed++
      console.error('[welcome] odeslání selhalo:', err)
    }
  }
  return { candidates: users.length, sent, failed }
}
