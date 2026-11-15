"""Texty pro /terms (podmínky) a /paysupport (podpora k platbám).

Telegram vyžaduje, aby bot, který prodává za hvězdy, odpovídal na /paysupport
a měl snadno dostupné podmínky (/terms). Spory a vracení hvězd řeší provozovatel,
podpora Telegramu s nákupy v botu nepomáhá.

Jméno provozovatele a kontakt se berou ze souboru .env (PROVOZOVATEL, KONTAKT_PODPORA).
"""

from __future__ import annotations

TERMS_DATE = "15. 11. 2026"
NOT_SET = "(zatím nedoplněno)"
TELEGRAM_LIMIT = 4096  # maximální délka jedné zprávy v Telegramu

# Kdo vytváří odpovědi a kam tečou data. Klíče = hodnoty LLM_PROVIDER (config.PROVIDERS),
# jinak by podmínky lhaly o tom, kam zprávy jdou.
AI_VENDORS = {
    "deepseek": (
        "jazykový model DeepSeek od čínské společnosti Hangzhou DeepSeek",
        "Kvůli vytvoření odpovědí se posílají společnosti DeepSeek a zpracovávají se na jejích serverech v Číně. "
        "DeepSeek je podle svých zásad může používat i ke zlepšování svých modelů.",
    ),
    "claude": (
        "model Claude od společnosti Anthropic",
        "Kvůli vytvoření odpovědí se posílají společnosti Anthropic (USA).",
    ),
}


def terms_text(persona_name: str, operator: str, contact: str, provider: str = "claude") -> str:
    n = persona_name
    model_line, data_line = AI_VENDORS.get(provider, AI_VENDORS["claude"])
    return f"""\
📄 Podmínky používání – {n}
Platí od {TERMS_DATE}

1. Co to je
{n} je AI postava, ne skutečný člověk. Jeho odpovědi vytváří umělá inteligence ({model_line}) a jeho fotky jsou vygenerované umělou inteligencí. Může se mýlit a nenahrazuje lékaře, psychologa ani jinou odbornou pomoc.

2. Zkušební provoz
Služba běží ve zkušebním provozu. Může mít výpadky, měnit se nebo skončit a je poskytována bez záruky.

3. Jen pro dospělé
Službu smí používat jen lidé starší 18 let.

4. Pravidla
Nepoužívej službu k ničemu nezákonnému. Při porušení můžeme přístup omezit.

5. Tvoje data
Zprávy, fotky a to, co si o tobě {n} pamatuje, ukládáme v databázi provozovatele. {data_line} Co si o tobě pamatuje, uvidíš přes /pamet. Všechno smažeš přes /zapomen.

6. Platby
Placené funkce se platí v Telegram Stars a cenu uvidíš před nákupem. Jde o digitální obsah, který dostaneš hned po zaplacení. Nákupem souhlasíš s okamžitým dodáním a bereš na vědomí, že tím ztrácíš právo odstoupit od smlouvy do 14 dnů. Ve zkušebním provozu ti hvězdy na požádání vrátíme.

7. Reklamace a podpora
Problém s platbou nebo reklamaci nahlas přes /paysupport. Přijetí potvrdíme a vyřídíme ji v přiměřené době, nejpozději do 30 dnů. Podpora Telegramu ani @BotSupport s nákupy v tomto botu pomoct nemůže.
Spor můžeš řešit i mimosoudně u České obchodní inspekce (adr.coi.cz).

8. Provozovatel
{operator or NOT_SET}
Kontakt: {contact or NOT_SET}"""


def paysupport_text(contact: str, user_id: int) -> str:
    return f"""\
💳 Podpora k platbám

Nefunguje nákup, něco se pokazilo s platbou, nebo chceš vrátit hvězdy? Napiš provozovateli: {contact or NOT_SET}

Do zprávy uveď:
• co se stalo a kdy jsi platil(a),
• ID transakce (najdeš ho v Telegramu v Nastavení, v sekci hvězd),
• tvoje ID: {user_id}

Přijetí potvrdíme a vyřídíme v přiměřené době, nejpozději do 30 dnů. Ve zkušebním provozu hvězdy vrátíme každému, kdo o to požádá.

Podpora Telegramu ani @BotSupport s nákupy v tomto botu pomoct nemůže.
Podmínky najdeš přes /terms."""
