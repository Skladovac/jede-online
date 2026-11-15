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


def typing_delay(bubble: str) -> float:
    """Jak dlouho 'píše' zprávu – zhruba podle délky, v rozumných mezích (sekundy)."""
    return max(1.0, min(6.0, 0.6 + len(bubble) / 20))
