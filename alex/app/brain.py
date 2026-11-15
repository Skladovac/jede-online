"""Komunikace s Claude API: odpovědi, zprávy 'sám od sebe' a aktualizace paměti."""

from __future__ import annotations

import base64
import logging
from datetime import datetime

import anthropic
from anthropic import AsyncAnthropic

from .llm import (
    EMPTY_REPLY,
    FIRST_NUDGE,
    PROACTIVE_NUDGE,
    REFUSAL_REPLY,
    BrainError,
    MemoryUpdate,
    clean_facts,
    memory_user_message,
)
from .persona import Persona
from .prompts import MEMORY_SYSTEM, static_system_prompt
from .storage import Message

__all__ = ["Brain", "BrainError", "REFUSAL_REPLY", "FALLBACK_MODELS", "build_api_messages"]

log = logging.getLogger(__name__)

# Modely, které podporují serverový "fallback": když model z bezpečnostních důvodů odmítne
# odpovědět, API to samo zkusí na jiném vhodném modelu v rámci stejného požadavku.
# Haiku 5.5 fallback nemá – tam se odmítnutí řeší náhradní odpovědí v roli (REFUSAL_REPLY).
FALLBACK_MODELS = {
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-opus-5",
    "claude-fable-5-2",
    "claude-fable-5-1",
}
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# Modely, které podporují systémovou zprávu uprostřed konverzace (pokyn těsně před odpovědí).
MID_SYSTEM_MODELS = {
    "claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-opus-4-8",
    "claude-fable-5-2", "claude-fable-5-1", "claude-fable-5",
}

REPLY_MAX_TOKENS = 4000  # obsahuje i přemýšlení modelu; samotné zprávy jsou krátké
MEMORY_MAX_TOKENS = 4000


def order_for_reply(history: list[Message], last_answered_user_msg_id: int) -> list[Message]:
    """Nezodpovězené zprávy uživatele přesune na konec.

    Když napíše, zatímco Alex ještě odpovídá na předchozí zprávu, uloží se její zpráva dřív než
    jeho odpověď. Bez přeřazení by historie končila jeho zprávou a model by pak psal „za ni“.
    """
    pending = [m for m in history if m.role == "user" and m.id > last_answered_user_msg_id]
    pending_ids = {m.id for m in pending}
    return [m for m in history if m.id not in pending_ids] + pending


def build_api_messages(
    history: list[Message],
    images: dict[int, bytes] | None = None,
    trailing_user_note: str | None = None,
) -> list[dict]:
    """Převede historii z databáze na formát Messages API.

    - po sobě jdoucí zprávy od stejné strany sloučí do jedné,
    - konverzace musí začínat zprávou od uživatele,
    - k zprávám s fotkou přidá obrázek (jen pokud ho máme v paměti).
    """
    images = images or {}
    out: list[dict] = []

    def add(role: str, blocks: list[dict]) -> None:
        if out and out[-1]["role"] == role:
            out[-1]["content"].extend(blocks)
        else:
            out.append({"role": role, "content": list(blocks)})

    for m in history:
        blocks: list[dict] = []
        if m.role == "user" and m.id in images:
            blocks.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64.standard_b64encode(images[m.id]).decode("ascii"),
                    },
                }
            )
        blocks.append({"type": "text", "text": m.content})
        add(m.role, blocks)

    if trailing_user_note:
        add("user", [{"type": "text", "text": trailing_user_note}])

    if out and out[0]["role"] != "user":
        out.insert(0, {"role": "user", "content": [{"type": "text", "text": "[Začátek konverzace]"}]})
    return out


def _response_text(resp) -> str:
    return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text").strip()


class Brain:
    """Claude (Anthropic)."""

    def __init__(self, client: AsyncAnthropic, model: str, effort: str | None = "medium"):
        self.client = client
        self.model = model
        self.effort = effort or None
        self.label = f"Claude {model}"

    def _base_kwargs(self, max_tokens: int) -> dict:
        kwargs: dict = {"model": self.model, "max_tokens": max_tokens}
        if self.effort:
            kwargs["output_config"] = {"effort": self.effort}
        return kwargs

    async def _create(self, **kwargs):
        try:
            if self.model in FALLBACK_MODELS:
                return await self.client.beta.messages.create(
                    **kwargs, betas=[FALLBACK_BETA], fallbacks="default"
                )
            return await self.client.messages.create(**kwargs)
        except anthropic.APIError as e:
            raise BrainError(f"Claude API: {e}") from e

    async def _chat(self, persona: Persona, dynamic: str, messages: list[dict]) -> str:
        resp = await self._create(
            **self._base_kwargs(REPLY_MAX_TOKENS),
            system=[
                # Statická část – stejná pro všechny zprávy, proto ji API cachuje (levnější a rychlejší).
                {
                    "type": "text",
                    "text": static_system_prompt(persona),
                    "cache_control": {"type": "ephemeral"},
                },
                # Dynamická část – čas, paměť, stav vztahu. Je až za cache, takže ji nerozbíjí.
                {"type": "text", "text": dynamic},
            ],
            messages=messages,
        )
        usage = resp.usage
        log.info(
            "Claude %s: stop=%s in=%s cache_read=%s cache_write=%s out=%s",
            resp.model, resp.stop_reason, usage.input_tokens,
            getattr(usage, "cache_read_input_tokens", None),
            getattr(usage, "cache_creation_input_tokens", None), usage.output_tokens,
        )
        if resp.stop_reason == "refusal":
            log.warning("Model odmítl odpovědět: %s", getattr(resp, "stop_details", None))
            return REFUSAL_REPLY
        text = _response_text(resp)
        if not text:
            log.warning("Prázdná odpověď (stop_reason=%s)", resp.stop_reason)
            return EMPTY_REPLY
        return text

    async def reply(
        self, persona: Persona, dynamic: str, history: list[Message], images: dict[int, bytes],
        turn_note: str | None = None,
    ) -> str:
        messages = build_api_messages(history, images)
        if turn_note:
            if self.model in MID_SYSTEM_MODELS:
                messages.append({"role": "system", "content": turn_note})
            else:  # starší modely: pokyn do poslední zprávy uživatele
                messages[-1]["content"].append({"type": "text", "text": f"[Pokyn systému: {turn_note}]"})
        return await self._chat(persona, dynamic, messages)

    async def proactive(self, persona: Persona, dynamic: str, history: list[Message]) -> str:
        note = PROACTIVE_NUDGE if history else FIRST_NUDGE
        return await self._chat(persona, dynamic, build_api_messages(history, trailing_user_note=note))

    async def update_memory(
        self, persona: Persona, facts: list[str], recent: list[Message], now: datetime
    ) -> list[str]:
        """Vrátí aktualizovaný seznam faktů. Při jakémkoli problému vrátí původní."""
        kwargs = self._base_kwargs(MEMORY_MAX_TOKENS)
        kwargs.update(
            system=MEMORY_SYSTEM.format(name=persona.name, today=f"{now.day}. {now.month}. {now.year}"),
            messages=[{"role": "user", "content": memory_user_message(persona.name, facts, recent)}],
            output_format=MemoryUpdate,
        )
        try:
            if self.model in FALLBACK_MODELS:
                resp = await self.client.beta.messages.parse(
                    **kwargs, betas=[FALLBACK_BETA], fallbacks="default"
                )
            else:
                resp = await self.client.messages.parse(**kwargs)
        except anthropic.APIError as e:
            raise BrainError(f"Claude API: {e}") from e
        parsed = getattr(resp, "parsed_output", None)
        if resp.stop_reason == "refusal" or parsed is None:
            log.warning("Aktualizace paměti se nepovedla (stop_reason=%s)", resp.stop_reason)
            return facts
        return clean_facts(parsed.facts)
