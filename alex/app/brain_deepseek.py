"""Komunikace s DeepSeek API (přes OpenAI-kompatibilní rozhraní).

Stejné rozhraní jako Claude (app/brain.py), takže zbytek bota neví, který model běží.

Poznámky k DeepSeek API (podle veřejných informací, listopad 2026):
- základní adresa https://api.deepseek.com, model "deepseek-flash" (V4.1 Flash, umí i obrázky),
- přemýšlení je ve výchozím stavu zapnuté; pro chat ho vypínáme (rychlejší a levnější),
- JSON výstup přes response_format={"type": "json_object"} (v instrukci musí být slovo JSON),
- neměnný začátek požadavku se cachuje automaticky, proto jde statická část instrukcí první.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime

import openai
from openai import AsyncOpenAI
from pydantic import ValidationError

from .brain import build_api_messages
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

log = logging.getLogger(__name__)

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-flash"

REPLY_MAX_TOKENS = 1500
MEMORY_MAX_TOKENS = 3000
PHOTO_UNAVAILABLE = "(fotka se ti nenačetla, nevidíš ji)"

MEMORY_JSON_INSTRUCTION = (
    '\n\nOdpověz pouze platným JSON objektem v tomto tvaru: {"facts": ["první fakt", "druhý fakt"]}'
)


def to_openai_messages(system: str, api_messages: list[dict], with_images: bool = True) -> list[dict]:
    """Převede zprávy z formátu Claude na formát OpenAI/DeepSeek (systémová zpráva první)."""
    out: list[dict] = [{"role": "system", "content": system}]
    for m in api_messages:
        texts = [b["text"] for b in m["content"] if b["type"] == "text"]
        images = [b for b in m["content"] if b["type"] == "image"]
        if m["role"] == "user" and images and with_images:
            parts: list[dict] = [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{b['source']['media_type']};base64,{b['source']['data']}"},
                }
                for b in images
            ]
            parts += [{"type": "text", "text": t} for t in texts]
            out.append({"role": "user", "content": parts})
        else:
            if images and not with_images:
                texts = [f"{t} {PHOTO_UNAVAILABLE}" if t.startswith(("[Poslala ti fotku", "[Poslal ti fotku")) else t for t in texts]
            out.append({"role": m["role"], "content": ("\n\n" if m["role"] == "assistant" else "\n").join(texts)})
    return out


def _has_images(messages: list[dict]) -> bool:
    return any(isinstance(m["content"], list) for m in messages)


class DeepSeekBrain:
    def __init__(self, client: AsyncOpenAI, model: str = DEFAULT_MODEL, thinking: bool = False):
        self.client = client
        self.model = model
        self.thinking = thinking
        self.label = f"DeepSeek {model}"

    async def _complete(self, messages: list[dict], max_tokens: int, **extra):
        thinking = {"thinking": {"type": "enabled" if self.thinking else "disabled"}}
        try:
            return await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens * (4 if self.thinking else 1),
                extra_body=thinking,
                **extra,
            )
        except openai.APIStatusError as e:
            if e.status_code == 402:
                raise BrainError("DeepSeek: došel kredit (Insufficient Balance)") from e
            msg = str(e).lower()
            unknown_model = "model" in msg and "image" not in msg and any(
                w in msg for w in ("not exist", "not found", "invalid", "unknown", "does not")
            )
            if e.status_code in (400, 404) and unknown_model:
                raise BrainError(
                    f"DeepSeek nezná model '{self.model}'. Zkontroluj DEEPSEEK_MODEL v souboru .env. ({e})"
                ) from e
            raise BrainError(f"DeepSeek API: {e}") from e
        except openai.APIError as e:
            raise BrainError(f"DeepSeek API: {e}") from e

    async def _chat(
        self, persona: Persona, dynamic: str, api_messages: list[dict], turn_note: str | None = None
    ) -> str:
        system = static_system_prompt(persona) + "\n\n" + dynamic
        messages = to_openai_messages(system, api_messages)
        if turn_note:
            messages.append({"role": "system", "content": turn_note})
        try:
            resp = await self._complete(messages, REPLY_MAX_TOKENS)
        except BrainError as e:
            # Model fotky nepodporuje -> zkusit znovu bez nich (Alex se zeptá, co na nich je).
            if _has_images(messages) and "image" in str(e).lower():
                log.warning("DeepSeek nepřijal fotku, posílám bez ní: %s", e)
                messages = to_openai_messages(system, api_messages, with_images=False)
                if turn_note:
                    messages.append({"role": "system", "content": turn_note})
                resp = await self._complete(messages, REPLY_MAX_TOKENS)
            else:
                raise
        choice = resp.choices[0]
        usage = resp.usage
        if usage is not None:
            log.info(
                "DeepSeek %s: finish=%s in=%s cache_hit=%s out=%s",
                resp.model, choice.finish_reason, usage.prompt_tokens,
                getattr(usage, "prompt_cache_hit_tokens", None), usage.completion_tokens,
            )
        if choice.finish_reason == "content_filter":
            log.warning("DeepSeek odpověď zablokoval filtr obsahu")
            return REFUSAL_REPLY
        text = (choice.message.content or "").strip()
        if not text:
            log.warning("Prázdná odpověď (finish_reason=%s)", choice.finish_reason)
            return EMPTY_REPLY
        return text

    async def reply(
        self, persona: Persona, dynamic: str, history: list[Message], images: dict[int, bytes],
        turn_note: str | None = None,
    ) -> str:
        return await self._chat(persona, dynamic, build_api_messages(history, images), turn_note)

    async def proactive(self, persona: Persona, dynamic: str, history: list[Message]) -> str:
        note = PROACTIVE_NUDGE if history else FIRST_NUDGE
        return await self._chat(persona, dynamic, build_api_messages(history, trailing_user_note=note))

    async def update_memory(
        self, persona: Persona, facts: list[str], recent: list[Message], now: datetime
    ) -> list[str]:
        """Vrátí aktualizovaný seznam faktů. Při jakémkoli problému vrátí původní."""
        system = MEMORY_SYSTEM.format(name=persona.name, today=f"{now.day}. {now.month}. {now.year}")
        messages = [
            {"role": "system", "content": system + MEMORY_JSON_INSTRUCTION},
            {"role": "user", "content": memory_user_message(persona.name, facts, recent)},
        ]
        resp = await self._complete(messages, MEMORY_MAX_TOKENS, response_format={"type": "json_object"})
        content = (resp.choices[0].message.content or "").strip()
        try:
            parsed = MemoryUpdate.model_validate_json(content)
        except (ValidationError, json.JSONDecodeError, ValueError):
            log.warning("Aktualizace paměti se nepovedla, neplatný JSON: %.200s", content)
            return facts
        return clean_facts(parsed.facts)
