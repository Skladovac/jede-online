"""Předplatné zdarma pro první uživatele (PROMO_PREMIUM_USERS, PROMO_PREMIUM_DAYS)."""

import asyncio
import time

from anthropic import AsyncAnthropic

from app.brain import Brain
from app.config import Settings
from app.persona import ALEX
from app.storage import Storage
from app.telegram_bot import CompanionBot
from tests.test_end_to_end import AnthropicMock, TelegramMock, wait_until
from tests.test_payments import _calls

WEEK = 7 * 86400


def test_promo_only_for_first_users_and_only_once():
    st = Storage(":memory:")
    exp = time.time() + WEEK
    assert st.grant_promo(1, "alex", exp, 2)
    assert not st.grant_promo(1, "alex", exp + 100, 2)  # stejný člověk podruhé nic
    assert st.grant_promo(2, "alex", exp, 2)
    assert not st.grant_promo(3, "alex", exp, 2)  # místa došla
    st.delete_user(1, "alex")  # /zapomen místo neuvolní
    assert not st.grant_promo(3, "alex", exp, 2)
    assert abs(st.premium_until(2, "alex") - exp) < 1
    assert st.promo_until(2, "alex") == st.premium_until(2, "alex")
    assert st.premium_until(3, "alex") == 0
    assert not Storage(":memory:").grant_promo(1, "alex", exp, 0)  # 0 = vypnuto


async def scenario(admin: bool):
    tg, an = TelegramMock(), AnthropicMock()
    settings = Settings(telegram_token="123:TEST", model="claude-haiku-5-5", effort="medium", db_path=":memory:",
                        reply_debounce_seconds=0.3, typing_simulation=False,
                        free_messages_per_day=1, payments_enabled=True, free_replies_after_proactive=0,
                        promo_premium_users=3, promo_premium_days=7,
                        admin_user_ids=(555,) if admin else ())
    storage = Storage(":memory:")
    bot = CompanionBot(settings, ALEX, storage,
                       Brain(AsyncAnthropic(base_url=an.url, api_key="k", max_retries=0), settings.model, settings.effort))
    bot.telegram_base_url, bot.telegram_base_file_url = f"{tg.url}/bot", f"{tg.url}/file/bot"
    application = bot.build_application()
    await application.initialize()
    await application.post_init(application)
    await application.start()
    await application.updater.start_polling(poll_interval=0.05, timeout=0)
    try:
        tg.text("/start")
        await wait_until(lambda: any("18 let" in t for t in tg.sent_texts()))
        tg.button("age:adult")
        await wait_until(lambda: _calls(tg, "editMessageText"))
        await wait_until(lambda: len(an.chat_requests()) == 1)
        confirm = _calls(tg, "editMessageText")[0]["text"]
        if admin:  # správce místo nezabere
            assert "zdarma" not in confirm and storage.premium_until(555, "alex") == 0
            return
        assert "předplatné zdarma" in confirm
        assert abs(storage.premium_until(555, "alex") - (time.time() + WEEK)) < 60

        # limit je 1 zpráva denně, s předplatným zdarma projdou obě
        for i, text in enumerate(["první", "druhá"], start=2):
            tg.text(text)
            await wait_until(lambda i=i: len(an.chat_requests()) == i)
        assert not any("vyčerpané" in t for t in tg.sent_texts())

        tg.text("/predplatne")
        await wait_until(lambda: any("Máš předplatné zdarma" in t for t in tg.sent_texts()))
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        tg.server.shutdown()
        an.server.shutdown()


def test_first_user_gets_free_week():
    asyncio.run(scenario(admin=False))


def test_admin_does_not_take_promo_slot():
    asyncio.run(scenario(admin=True))
