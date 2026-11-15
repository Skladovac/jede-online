"""Knihovna fotek postavy a zpracování značky [FOTKA: id] v odpovědi modelu.

Fotky leží ve složce photos/<postava>/ a popisuje je soubor photos.json:
  [{"id": "rano_kafe", "soubor": "rano_kafe.jpg", "popis": "ranní kafe na balkoně", "kdy": ["rano"]}, ...]
"kdy" je seznam z: rano, den, vecer, noc, kdykoliv. Používají se jen fotky, jejichž soubor existuje.
Nepovinné: "podminka" (svetlo = venku za světla a bez deště, slunce = svítí slunce, dest = prší,
zapad = západ slunce na jasné obloze) a "obdobi" (seznam z: jaro, leto, podzim, zima).
Fotka se pak pošle jen tehdy, když to odpovídá skutečnému počasí a světlu (app/weather.py).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from datetime import time
from pathlib import Path

from .texting import split_bubbles
from .weather import CONDITIONS, SEASONS, Conditions

log = logging.getLogger(__name__)

PHOTOS_ROOT = Path(__file__).resolve().parent.parent / "photos"
MARKER_RE = re.compile(r"\[\s*FOTKA\s*:\s*([A-Za-z0-9_\-]+)\s*\]", re.IGNORECASE)
# vymyšlené „akce“ v hranatých závorkách, např. „[Poslal jsi jí fotku: …]“ – nikdy je neposílat uživatelce
PSEUDO_RE = re.compile(r"\[[^\]\n]*(fotk|foto|selfie|poslal)[^\]\n]*\]", re.IGNORECASE)
TIMES = ("rano", "den", "vecer", "noc", "kdykoliv")
ASK_RE = re.compile(
    r"fot[kotečy]|selfi|vyfo[tť]|obr[aá]z[ek]|uka[zž]\s+se|jak\s+vypad[aá][sš]|uka[zž]\s+mi", re.IGNORECASE
)


PLACEHOLDER_RE = re.compile(r"^\[Poslala? ti [^\]]*\]")  # "[Poslala ti fotku] s popiskem: …"


def asks_for_photo(text: str) -> bool:
    """Zhruba pozná, jestli si uživatelka o fotku řekla („pošli fotku“, „jak vypadáš?“…).

    Když fotku poslala ona sama, počítá se jen její popisek, ne označení „[Poslala ti fotku]“.
    """
    return bool(ASK_RE.search(PLACEHOLDER_RE.sub("", text or "")))


ASKED_TURN_NOTE = (
    "Právě si řekla o fotku. Fotku ze seznamu „Fotky, které můžeš poslat“ teď pošli: napiš značku "
    "[FOTKA: id] a připiš k ní něco svého. Pokud jsi dřív psal, že fotky posílat nemůžeš, už to neplatí. "
    "Běžná slušná fotka není nic intimního."
)

SAMPLE_TURN_NOTE = (
    "Pošli jí teď sám od sebe jednu fotku ze seznamu „Fotky, které můžeš poslat“ (značka [FOTKA: id]), "
    "přirozeně, jako by ses chtěl podělit o kus svého dne. Připiš k ní něco svého a navaž na to, o čem se bavíte."
)

TEASE_TURN_NOTE = (
    "Právě si řekla o fotku. Tentokrát ji ještě neposílej: hravě a s úsměvem dělej drahoty (třeba ať si ji "
    "zaslouží, nebo že možná později), ale neodmítej natvrdo a nedělej z toho velkou věc. Značku [FOTKA] teď nepoužij."
)


@dataclass(frozen=True)
class Photo:
    id: str
    path: Path
    description: str
    when: tuple[str, ...]
    need: str | None = None  # podmínka počasí/světla (viz CONDITIONS)
    seasons: tuple[str, ...] = ()  # roční období, kdy se hodí (prázdné = kdykoliv)


def time_of_day(t: time) -> str:
    if 5 <= t.hour < 10:
        return "rano"
    if 10 <= t.hour < 17:
        return "den"
    if 17 <= t.hour < 22:
        return "vecer"
    return "noc"


class PhotoLibrary:
    def __init__(self, folder: Path):
        self.folder = folder
        self.photos: dict[str, Photo] = {}
        index = folder / "photos.json"
        if not index.exists():
            return
        for item in json.loads(index.read_text(encoding="utf-8")):
            path = folder / item["soubor"]
            when = tuple(w for w in item.get("kdy", ["kdykoliv"]) if w in TIMES) or ("kdykoliv",)
            need = item.get("podminka") if item.get("podminka") in CONDITIONS else None
            seasons = tuple(x for x in item.get("obdobi", []) if x in SEASONS)
            if path.exists():
                self.photos[item["id"]] = Photo(item["id"], path, item["popis"], when, need, seasons)
        log.info("Fotky %s: %d připravených", folder.name, len(self.photos))

    @classmethod
    def for_persona(cls, persona_key: str, root: Path = PHOTOS_ROOT) -> "PhotoLibrary":
        return cls(root / persona_key)

    def get(self, photo_id: str) -> Photo | None:
        return self.photos.get(photo_id)

    def available(self, now: time, exclude: set[str], conditions: Conditions | None = None) -> list[Photo]:
        """Fotky, které se teď hodí. S `conditions` i podle skutečného světla, počasí a ročního období."""
        tod = time_of_day(now)
        return [
            p for p in self.photos.values()
            if p.id not in exclude and ("kdykoliv" in p.when or tod in p.when)
            and (conditions is None or conditions.fits(p.need, p.seasons))
        ]


@dataclass
class ReplyPlan:
    parts: list[tuple[str, object]]  # ("text", str) nebo ("photo", Photo)
    history_text: str  # co se uloží do historie (místo fotky značka [FOTKA: id])
    photo: Photo | None


def plan_reply(text: str, persona_name: str, allowed: dict[str, Photo]) -> ReplyPlan:
    """Rozdělí odpověď na bubliny a nanejvýš jednu fotku (podle první platné značky)."""
    chosen: Photo | None = None
    before, after = text, ""
    for m in MARKER_RE.finditer(text):
        photo = allowed.get(m.group(1))
        if photo is not None:
            chosen = photo
            before, after = text[: m.start()], text[m.end():]
            break
    before = PSEUDO_RE.sub("", MARKER_RE.sub("", before))
    after = PSEUDO_RE.sub("", MARKER_RE.sub("", after))
    b1, b2 = split_bubbles(before, persona_name), split_bubbles(after, persona_name)
    parts: list[tuple[str, object]] = [("text", b) for b in b1]
    history: list[str] = list(b1)
    if chosen is not None:
        parts.append(("photo", chosen))
        history.append(f"[FOTKA: {chosen.id}]")  # v historii stejná značka, jakou model fotku posílá
    parts += [("text", b) for b in b2]
    history += b2
    return ReplyPlan(parts, "\n\n".join(history), chosen)
