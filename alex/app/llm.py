"""Věci společné pro všechny AI modely (Claude, DeepSeek)."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .storage import Message

MAX_FACTS = 40

REFUSAL_REPLY = "Hmm, o tomhle se mi teď psát nechce 🙈\n\nPojďme radši o něčem jiném. Co děláš?"
EMPTY_REPLY = "😅 Promiň, nějak jsem se zamyslel. Co jsi říkala?"

PROACTIVE_NUDGE = "[Automatická poznámka: uživatelka teď nic nenapsala. Napiš jí sám podle úkolu v instrukcích.]"
FIRST_NUDGE = "[Automatická poznámka: uživatelka si tě právě přidala a ještě nic nenapsala.]"


class BrainError(Exception):
    """Volání AI modelu selhalo (výpadek, došel kredit, špatný klíč…)."""


class MemoryUpdate(BaseModel):
    facts: list[str] = Field(description="Úplný aktualizovaný seznam faktů o uživatelce")


def memory_user_message(persona_name: str, facts: list[str], recent: list[Message]) -> str:
    transcript = "\n".join(
        f"{'Uživatelka' if m.role == 'user' else persona_name}: {m.content}" for m in recent
    )
    current = "\n".join(f"- {f}" for f in facts) or "(zatím nic)"
    return f"Dosavadní fakta:\n{current}\n\nNová část konverzace:\n{transcript}"


def clean_facts(facts: list[str]) -> list[str]:
    return [f.strip() for f in facts if f and f.strip()][:MAX_FACTS]
