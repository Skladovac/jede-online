"""Pomocné funkce, aby psaní působilo lidsky."""

from __future__ import annotations

import re

MAX_BUBBLES = 4


def split_bubbles(text: str, persona_name: str = "") -> list[str]:
    """Rozdělí odpověď modelu na jednotlivé zprávy (oddělené prázdným řádkem)."""
    parts = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    if persona_name:
        prefix = re.compile(rf"^{re.escape(persona_name)}\s*:\s*", re.IGNORECASE)
        parts = [prefix.sub("", p) for p in parts]
    parts = [p for p in parts if p]
    if len(parts) > MAX_BUBBLES:
        parts = parts[: MAX_BUBBLES - 1] + ["\n".join(parts[MAX_BUBBLES - 1 :])]
    return parts


# Rychlost „psaní“ a „čtení“. Všechna zpoždění se ještě násobí DELAY_MULTIPLIER (výchozí 1,5),
# takže ve výsledku píše asi 5 znaků za sekundu (rychlý pisatel na mobilu), nejvýš 24 s na jednu zprávu.
TYPING_CHARS_PER_SECOND = 7.5
MAX_TYPING_SECONDS = 16.0
READING_CHARS_PER_SECOND = 40.0
MAX_READING_SECONDS = 4.0


def typing_delay(bubble: str) -> float:
    """Jak dlouho „píše“ jednu zprávu (sekundy před vynásobením DELAY_MULTIPLIER)."""
    return max(1.0, min(MAX_TYPING_SECONDS, len(bubble) / TYPING_CHARS_PER_SECOND))


def reading_delay(text: str) -> float:
    """Jak dlouho čte její zprávy, než začne psát (sekundy před vynásobením DELAY_MULTIPLIER)."""
    return min(MAX_READING_SECONDS, len(text) / READING_CHARS_PER_SECOND)
