"""Podmínky (/terms), podpora k platbám (/paysupport) a starší název AI_PROVIDER."""

from app.config import PROVIDERS, load_settings
from app.legal import AI_VENDORS, NOT_SET, TELEGRAM_LIMIT, paysupport_text, terms_text


def test_texts_fit_one_message_and_show_missing_operator():
    for provider in PROVIDERS:
        terms = terms_text("Tereza", "", "", provider)
        assert len(terms) < TELEGRAM_LIMIT
        assert terms.count(NOT_SET) == 2
    support = paysupport_text("", 12345)
    assert len(support) < TELEGRAM_LIMIT and NOT_SET in support and "12345" in support


def test_terms_name_the_real_model_vendor():
    assert set(AI_VENDORS) == set(PROVIDERS)  # každý povolený LLM_PROVIDER má své podmínky
    deepseek = terms_text("Tereza", "Firma s.r.o., IČO 123", "podpora@example.cz", "deepseek")
    assert "Číně" in deepseek and "Anthropic" not in deepseek
    assert "Firma s.r.o." in deepseek and NOT_SET not in deepseek
    claude = terms_text("Tereza", "", "", "claude")
    assert "Anthropic" in claude and "DeepSeek" not in claude


def test_old_ai_provider_name_still_works(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "1:x")
    monkeypatch.setenv("LLM_PROVIDER", "")
    monkeypatch.setenv("AI_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    monkeypatch.setenv("PROVOZOVATEL", "Firma")
    monkeypatch.setenv("KONTAKT_PODPORA", "@podpora")
    s = load_settings()
    assert s.provider == "claude" and s.operator_name == "Firma" and s.support_contact == "@podpora"


def test_bot_commands_answer_without_age_check():
    import asyncio
    from types import SimpleNamespace

    from app.config import Settings
    from app.persona import ALEX
    from app.storage import Storage
    from app.telegram_bot import CompanionBot

    sent = []

    async def reply_text(text, **kwargs):
        sent.append(text)

    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                        typing_simulation=False, provider="deepseek", support_contact="@podpora")
    bot = CompanionBot(settings, ALEX, Storage(":memory:"), brain=None)
    update = SimpleNamespace(message=SimpleNamespace(reply_text=reply_text), effective_user=SimpleNamespace(id=42))
    asyncio.run(bot.cmd_terms(update, None))
    asyncio.run(bot.cmd_paysupport(update, None))
    assert "Číně" in sent[0] and "@podpora" in sent[0]
    assert "@podpora" in sent[1] and "42" in sent[1]
