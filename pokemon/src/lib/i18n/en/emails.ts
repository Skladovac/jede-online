// Překlady (en) – oblast „emails“. Klíč = český text přesně jak je v kódu.
const dict: Record<string, string> = {
  // Obal e-mailu
  'Pokémon karty': 'Pokémon cards',
  'Nebo zkopírujte odkaz:': 'Or copy the link:',
  'Tento e-mail byl odeslán automaticky z pokemon.jede.online. Pokud jste o nic nežádali, můžete ho ignorovat.':
    'This email was sent automatically by pokemon.jede.online. If you didn\'t ask for anything, you can ignore it.',

  // Potvrzení e-mailu, hesla
  'Potvrď svůj e-mail': 'Confirm your email',
  'Ahoj <strong>{name}</strong>,': 'Hi <strong>{name}</strong>,',
  'díky za registraci. Potvrď prosím, že tento e-mail patří tobě.': 'thanks for signing up. Please confirm that this email belongs to you.',
  'Potvrdit e-mail': 'Confirm email',
  'Obnovení hesla': 'Password reset',
  'Někdo (snad ty) požádal o nové heslo. Odkaz platí 1 hodinu.': 'Someone (hopefully you) asked for a new password. The link is valid for 1 hour.',
  'Nastavit nové heslo': 'Set a new password',
  'Heslo bylo změněno': 'Your password was changed',
  'heslo k tvému účtu na pokemon.jede.online bylo právě změněno a ostatní přihlášená zařízení jsme odhlásili.':
    'the password for your account on pokemon.jede.online was just changed and we signed out all other devices.',
  'Pokud jsi to nebyl(a) ty, nastav si hned nové heslo přes „Zapomenuté heslo“ a napiš nám na pokemon@jede.online.':
    'If it wasn\'t you, set a new password right away using “Forgot password” and write to us at pokemon@jede.online.',
  'Zapomenuté heslo': 'Forgot password',

  // Rodič
  'Žádost o souhlas: účet „{name}“ na Pokémon karty': 'Consent request: account “{name}” on Pokémon cards',
  'Dobrý den,': 'Hello,',
  'vaše dítě si na webu <strong>pokemon.jede.online</strong> založilo účet s přezdívkou <strong>{name}</strong> a uvedlo tento e-mail jako e-mail rodiče.':
    'your child has created an account on <strong>pokemon.jede.online</strong> with the nickname <strong>{name}</strong> and gave this address as their parent\'s email.',
  'Web slouží k evidenci sbírky Pokémon karet a k domluvě výměn mezi sběrateli. Bez vašeho souhlasu zůstane účet omezený: profil není vidět a dítě nemůže posílat ani přijímat nabídky.':
    'The website is for keeping track of a Pokémon card collection and arranging trades between collectors. Without your consent the account stays limited: the profile is hidden and your child can\'t send or receive offers.',
  'Na odkazu níže uvidíte, jaké údaje dítě zadalo, a můžete souhlas udělit, údaje upravit nebo účet smazat. Odkaz si uschovejte — slouží i pro pozdější správu účtu.':
    'Using the link below you can see what details your child entered, and you can give consent, edit the details or delete the account. Please keep the link — you can use it to manage the account later too.',
  'Zobrazit účet a rozhodnout': 'View account and decide',
  '„{name}“ přidal(a) odkazy na sociální sítě': '“{name}” added social media links',
  'Účet <strong>{name}</strong> má na profilu nové odkazy (Facebook, Instagram, Aukro). Zobrazí se ostatním až po vašem schválení.':
    'The account <strong>{name}</strong> has new links on its profile (Facebook, Instagram, Aukro). Others will only see them after you approve them.',
  'Zkontrolovat a schválit': 'Review and approve',

  // Hodnocení
  '{name} tě ohodnotil(a)': '{name} rated you',
  '{name} tě ohodnotil(a) {icon}': '{name} rated you {icon}',
  '<strong>{name}</strong> ti dal(a) {kind} hodnocení{tag}.': '<strong>{name}</strong> gave you a {kind} rating{tag}.',
  'kladné 👍': 'positive 👍',
  'záporné 👎': 'negative 👎',
  'Zobrazit hodnocení': 'View rating',
  'rychle odesláno': 'shipped quickly',
  'odpovídá popisu': 'as described',
  'příjemná domluva': 'friendly to deal with',
  'pomalé': 'slow',
  'neodpovídá popisu': 'not as described',
  'neodesláno': 'not sent',
  '{name} tě ohodnotil(a) po výměně': '{name} rated you after a trade',

  // Žádosti o výměnu
  'Nová žádost o výměnu od {name}': 'New trade request from {name}',
  '<strong>{name}</strong> má zájem o {what}:': '<strong>{name}</strong> is interested in {what}:',
  'tuto kartu': 'this card',
  '{count} karet': '{count} cards',
  'výměna': 'trade',
  'prodej': 'sale',
  'dar za poštovné': 'free for postage',
  'za {price} Kč': 'for {price} Kč',
  'Když žádost přijmete, uvidíte navzájem e-mail a domluvíte se na předání. Web neřeší platby ani dopravu.':
    'If you accept the request, you\'ll both see each other\'s email and can arrange the handover. The website doesn\'t handle payments or shipping.',
  'Zobrazit výměnu': 'View trade',
  '{name} přijal(a) tvoji žádost': '{name} accepted your request',
  '{name} žádost odmítl(a)': '{name} declined your request',
  'Kontakt pro domluvu najdeš v detailu výměny.': 'You\'ll find their contact details in the trade detail.',
  '<strong>{name}</strong> přijal(a) žádost. Kontakt pro domluvu: <strong>{email}</strong>{parent}.':
    '<strong>{name}</strong> accepted the request. Contact: <strong>{email}</strong>{parent}.',
  '(rodič: {email})': '(parent: {email})',
  'Domluvte se na předání nebo zaslání. Až bude hotovo, potvrďte to na webu a ohodnoťte se.':
    'Agree on how to hand over or send the cards. When it\'s done, confirm it on the website and rate each other.',
  'Nevadí — zkus kartu najít u někoho jiného.': 'Never mind — try to find the card with someone else.',
  'Kontakt na {name}': 'Contact for {name}',
  'Přijal(a) jsi žádost od <strong>{name}</strong>. Kontakt pro domluvu: <strong>{email}</strong>{parent}.':
    'You accepted the request from <strong>{name}</strong>. Contact: <strong>{email}</strong>{parent}.',
  '{name} zrušil(a) výměnu': '{name} cancelled the trade',
  'Výměna byla zrušena.': 'The trade was cancelled.',
  'Zobrazit': 'View',
  'Výměna je dokončená': 'The trade is complete',
  'Nezapomeň druhou stranu ohodnotit.': 'Don\'t forget to rate the other person.',
  '{name} potvrdil(a), že výměna proběhla': '{name} confirmed the trade happened',
  'Potvrď to prosím taky, ať se kusy odečtou ze sbírek.': 'Please confirm it too, so the cards are removed from your collections.',

  // Denní souhrn shod
  'vymění': 'will trade',
  'prodá': 'is selling',
  'daruje': 'is giving away',
  '<strong>(tvoje cena: do {max} Kč)</strong>': '<strong>(your price: up to {max} Kč)</strong>',
  'koupí': 'wants to buy',
  'za max. {price} Kč': 'for up to {price} Kč',
  '{count}× nabídka za tvou cenu nebo levněji': '{count}× offer at your price or cheaper',
  'Nové nabídky toho, co ti chybí ({count})': 'New offers for cards you\'re missing ({count})',
  'Někdo chce koupit, co nabízíš ({count})': 'Someone wants to buy what you\'re offering ({count})',
  '…a dalších {count}.': '…and {count} more.',
  '✅ Nabídka za tvou cenu nebo levněji': '✅ An offer at your price or cheaper',
  '✅ {count} nabídky za tvou cenu nebo levněji': '✅ {count} offers at your price or cheaper',
  'Někdo nabízí, co ti chybí': 'Someone is offering something you\'re missing',
  'Někdo chce koupit, co nabízíš': 'Someone wants to buy what you\'re offering',
  'od posledního e-mailu se objevily nabídky toho, co sháníš:': 'since our last email, there are new offers for things you\'re looking for:',
  '💰 <strong>Někdo chce koupit, co nabízíš:</strong>': '💰 <strong>Someone wants to buy what you\'re offering:</strong>',
  '<small>Tyto e-maily můžeš vypnout v <a href="{url}">Můj účet</a>.</small>':
    '<small>You can turn these emails off in <a href="{url}">My account</a>.</small>',
  'Zobrazit, kdo to nabízí': 'See who\'s offering it',
  'Otevřít moji sbírku': 'Open my collection',
  'Pošli mi v neděli odpoledne týdenní souhrn (nové nabídky, sledující, hodnocení, zájem o moje karty).': 'Send me a weekly summary on Sunday afternoon (new offers, followers, ratings, interest in my cards).',
  'Nové nabídky karet, které ti chybí ({n})': 'New offers of cards you are missing ({n})',
  '…a další na webu.': '…and more on the site.',
  'Noví sledující: {names}': 'New followers: {names}',
  'Nová hodnocení: 👍 {pos} · 👎 {neg}': 'New ratings: 👍 {pos} · 👎 {neg}',
  'Tvoje nabídky ({offers}): žádosti o výměnu za týden {requests}, v košíku je má teď {carts} lidí.': 'Your offers ({offers}): trade requests this week {requests}, currently in {carts} people’s carts.',
  'Týdenní souhrn vypneš v Můj účet.': 'You can turn off the weekly summary in My account.',
  'Tvůj týden na pokemon.jede.online': 'Your week on pokemon.jede.online',
  'Ahoj {name}, tohle se za poslední týden stalo kolem tvé sbírky:': 'Hi {name}, here is what happened around your collection this week:',
  'Otevřít web': 'Open the site',
  'Co všechno umí pokemon.jede.online': 'What pokemon.jede.online can do',
  'e-mail máš potvrzený. Tady je v kostce, co web umí — ať z něj dostaneš maximum.': 'your e-mail is confirmed. Here is a quick tour of what the site can do, so you get the most out of it.',
  '1. Sady jako album': '1. Sets as an album',
  'Otevři sadu, kterou sbíráš, a odklikej karty, které máš. Hned vidíš, co chybí a kolik zbývá. Vyber si, co sbíráš: Base (základní karty), Complete (i secret) nebo Master (všechny varianty — normal, holo, reverse). Zobrazení „Seznam“ má políčka variant u každé karty.': 'Open the set you collect and tick the cards you own. You instantly see what is missing and how much is left. Choose your goal: Base (main cards), Complete (incl. secrets) or Master (every variant — normal, holo, reverse). The “List” view has variant checkboxes next to each card.',
  '2. Přidávání karet číslem': '2. Add cards by number',
  'V Moje sbírka napiš jen číslo karty, třeba „MEP 101, SVI 045, 2x 30C 071“ — web kartu pozná a přidá. Rychlé i pro celý balík.': 'In My collection just type card numbers like “MEP 101, SVI 045, 2x 30C 071” — the site recognises and adds them. Fast even for a whole stack.',
  '3. Výměny a tržiště': '3. Trades and marketplace',
  'Označ, co ti chybí, a web ti ukáže sběratele, kteří to mají — nejdřív ty, se kterými jde udělat výměnu oběma směry. Karty navíc nabídni k výměně nebo prodeji; obchod jde domluvit v chatu a potvrdit s hodnocením.': 'Mark what you are missing and the site shows collectors who have it — starting with those where a trade works both ways. Offer your spare cards for trade or sale; deals are arranged in chat and confirmed with a rating.',
  '4. Jak fungují ceny': '4. How prices work',
  'U každé karty je orientační cena z Cardmarketu (trend prodejů), aktualizuje se jednou denně. Částky v Kč jsou přepočet z eur kurzem ČNB — je to vodítko pro férovou výměnu, ne výkupní cena.': 'Every card shows a guide price from Cardmarket (sales trend), updated once a day. CZK amounts are converted from euros at the Czech National Bank rate — a guide for a fair trade, not a buy-back price.',
  'Podívat se na ceny': 'See prices',
  '5. Propoj svou AI (ChatGPT, Claude…)': '5. Connect your AI (ChatGPT, Claude…)',
  'V Můj účet si vytvoř klíč a vlož ho do své AI. Pak jí stačí poslat fotku karty a napsat „přidej do sbírky“, nebo se zeptat „které karty ze sady 151 mi chybí“. Běží to na tvém účtu u AI, u nás je to zdarma.': 'Create a key in My account and add it to your AI. Then just send it a photo of a card and say “add to my collection”, or ask “which cards from set 151 am I missing”. It runs on your AI account; on our side it is free.',
  'Nastavit propojení': 'Set up the connection',
  '6. Odznaky, kamarádi, chyby': '6. Badges, friends, bugs',
  'Za sbírání a férové obchody sbíráš odznaky na profilu. Pozvi kamarády odkazem ze svého účtu. A když něco nefunguje, napiš nám přes „Nahlásit chybu“ v patičce — opravdu to čteme.': 'Collecting and fair trades earn you badges on your profile. Invite friends with the link from your account. And if something does not work, use “Report a bug” in the footer — we really do read it.',
  'Otevřít pokemon.jede.online': 'Open pokemon.jede.online',
}
export default dict
