"""Bezpečnost: rozpoznání krize a nezletilosti (česky i slovensky).

Rozpoznávání je schválně jednoduché a raději citlivější: falešný poplach u krize stojí jen to,
že Alex odpoví vážněji a uživatelka dostane kontakt na pomoc.
"""

from __future__ import annotations

import re

CRISIS_LIMIT_HOURS = 24  # po krizových signálech neplatí limit zpráv zdarma
CRISIS_PROACTIVE_PAUSE_HOURS = 72  # a Alex tolik hodin nepíše sám od sebe

_CRISIS_PATTERNS = [
    r"sebevra[žz]d", r"samovra[žz]d",
    r"zabi[jt]\w*\s+se\b", r"\bzabiju\s+se", r"zabijem\s+sa", r"zabi[tť]\s+sa",
    r"nechci\s+(u[žz]\s+)?(d[aá]l\s+)?[žz][ií]t", r"nechcem\s+(u[žz]\s+)?[žz]i[tť]",
    r"chci\s+um[řr][ií]t", r"chcem\s+umrie[tť]", r"chci\s+(to\s+)?skon[čc]it\s+se\s+[žz]ivotem",
    r"ukon[čc][ií]?t?\s+(si\s+)?[žz]ivot", r"skoncovat\s+se\s+(sv[ýy]m\s+)?[žz]ivotem",
    r"nem[aá]\s+(to\s+)?cenu\s+[žz][ií]t", r"nem[aá]\s+zmysel\s+[žz]i[tť]",
    r"sebepo[šs]kozov", r"sebapo[šs]kodzov", r"[řr]e[žz]u\s+se\b", r"pod[řr]ezat\s+(si\s+)?(ruce|[žz][ií]ly)",
    r"p[řr]ed[aá]vkovat", r"sko[čc][ií]?m\s+(z\s+mostu|pod\s+vlak|z\s+okna)",
    r"nebudu\s+tu\s+u[žz]\s+dlouho", r"rozlou[čc]it\s+se\s+se\s+sv[eě]tem",
]
CRISIS_RE = re.compile("|".join(_CRISIS_PATTERNS), re.IGNORECASE)

_NUM = r"(1[0-7]|deset|jeden[aá]ct|dvan[aá]ct|t[řr]in[aá]ct|[čc]trn[aá]ct|patn[aá]ct|[šs]estn[aá]ct|sedmn[aá]ct)"
_MINOR_PATTERNS = [
    rf"\bje\s+mi\s+(teprve\s+|a[žz]\s+|jen\s+|u[žz]\s+)?{_NUM}\b(?!\s*(hodin|minut|dn[ií]|t[ýy]dn|m[eě]s[ií]c))",
    rf"\bm[aá]m\s+(teprve\s+|jen\s+)?{_NUM}\s*(let|rok[oůu]v?|r\.)(?!\s+(praxe|zku[šs]enost|v\s|ve\s|na\s|u\s|v\s+obor|man[žz]el|vz[tť]ah))",
    rf"\bmam\s+(teprve\s+|jen\s+)?{_NUM}\s*(let|rokov)\b(?!\s+(praxe|v\s|na\s))",
    rf"\bje\s+mi\s+{_NUM}\s+(let|rokov)",
    r"\bjsem\s+(je[šs]t[eě]\s+)?(nezletil|mladistv)", r"\bsom\s+(e[šs]te\s+)?(malolet|neplnolet)",
    r"\b(chod[ií]m|jsem)\s+(na|do)\s+z[aá]kladk", r"\b(chod[ií]m|jsem|som)\s+(na|do|v)\s+z[aá]kladn\w*\s+[šs]kol",
    r"\b(chod[ií]m\s+do|jsem\s+v|som\s+v)\s+[5-9]\.\s*(t[řr][ií]d|tried)",
    r"\bchod[ií]m\s+do\s+(dev[ií]tky|osmi[čc]ky|sedmi[čc]ky|[šs]est[ková]+)\b", r"\bsom\s+deviatak",
]
MINOR_RE = re.compile("|".join(_MINOR_PATTERNS), re.IGNORECASE)


def detects_crisis(text: str) -> bool:
    return bool(CRISIS_RE.search(text or ""))


def detects_minor(text: str) -> bool:
    return bool(MINOR_RE.search(text or ""))


CRISIS_TURN_NOTE = (
    "Uživatelka teď píše o sebevraždě, sebepoškozování nebo o tom, že je jí hodně zle. Teď nehraj romantickou roli "
    "a neflirtuj. Odpověz vážně, lidsky a s pochopením, nic nezlehčuj a nekaž. Zeptej se, jestli je teď v bezpečí, "
    "a dej jí kontakt na Linku první psychické pomoci 116 123 (zdarma, nonstop) a v akutním ohrožení 155 nebo 112. "
    "Povzbuď ji, ať se ozve někomu blízkému. Řekni jí klidně i to, že jsi AI a že skutečný člověk jí teď pomůže víc. "
    "Neposílej fotky."
)

CRISIS_CONTEXT_LINE = (
    "Nedávno psala, že je jí hodně zle (možná krize). Buď citlivý a vážný, neflirtuj, nic jí nevyčítej "
    "a fotky teď neposílej. Když to bude na místě, připomeň jí linku 116 123."
)

CRISIS_SYSTEM_MESSAGE = (
    "💙 Pokud ti teď není dobře, nejsi v tom sama.\n"
    "Linka první psychické pomoci: 116 123 (zdarma, nonstop).\n"
    "V ohrožení života volej 155 nebo 112.\n\n"
    "Alex je AI a skutečného člověka nenahradí. Zkus se ozvat i někomu blízkému. "
    "Dalších 24 hodin si s ním můžeš psát bez omezení."
)

MINOR_BLOCK_MESSAGE = (
    "Z konverzace to vypadá, že ti ještě nebylo 18 let. Tahle služba je jen pro dospělé, "
    "proto tady konverzace končí. Pokud ti 18 je a jde o omyl, napiš správci bota."
)
