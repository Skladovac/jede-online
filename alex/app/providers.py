"""Vytvoří 'mozek' Alexe podle nastavení LLM_PROVIDER (claude nebo deepseek)."""

from __future__ import annotations

from .config import Settings


def create_brain(settings: Settings):
    if settings.provider == "deepseek":
        from openai import AsyncOpenAI

        from .brain_deepseek import DEEPSEEK_BASE_URL, DeepSeekBrain

        client = AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=DEEPSEEK_BASE_URL)
        return DeepSeekBrain(client, settings.deepseek_model)

    from anthropic import AsyncAnthropic

    from .brain import Brain

    return Brain(AsyncAnthropic(), settings.model, settings.effort)
