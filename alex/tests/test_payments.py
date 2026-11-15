"""Limit zpráv zdarma a předplatné za Telegram Stars (simulovaný Telegram + simulovaný Claude)."""

import asyncio
import time

from anthropic import AsyncAnthropic

from app.brain import Brain
from app.config import Settings
from app.persona import ALEX
from app.storage import Storage
from app.telegram_bot import SUBSCRIPTION_PERIOD, CompanionBot
from tests.test_end_to_end import USER, AnthropicMock, TelegramMock, _last_user_text, wait_until


def _calls(tg, method):
    with tg.lock:
        return [p for m, p in tg.calls if m == method]


async def scenario():
    tg, an = TelegramMock(), AnthropicMock()
    settings = Settings(telegram_token="123:TEST", model="claude-haiku-5-5", effort="medium", db_path=":memory:",
                        reply_debounce_seconds=0.3, typing_simulation=False,
                        free_messages_per_day=2, payments_enabled=True, subscription_stars=300, free_replies_after_proactive=0)
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
        cmds = [c["command"] for c in _calls(tg, "setMyCommands")[0]["commands"]]
        assert "predplatne" in cmds

        tg.text("/start")
        await wait_until(lambda: any("18 let" in t for t in tg.sent_texts()))
        tg.button("age:adult")
        await wait_until(lambda: len(an.chat_requests()) == 1)

        # 2 zprávy zdarma projdou
        for i, text in enumerate(["první", "druhá"], start=2):
            tg.text(text)
            await wait_until(lambda i=i: len(an.chat_requests()) == i)
            await wait_until(lambda: storage.latest_user_message_id(555, "alex")
                             <= storage.get_user(555, "alex").last_answered_user_msg_id)

        # třetí -> upozornění od systému s tlačítkem, AI se nevolá
        n_ai = len(an.chat_requests())
        tg.text("třetí")
        await wait_until(lambda: any("zprávy zdarma (2) jsou vyčerpané" in t for t in tg.sent_texts()))
        notice = [p for p in _calls(tg, "sendMessage") if "vyčerpané" in p.get("text", "")][0]
        button = notice["reply_markup"]["inline_keyboard"][0][0]
        assert button["url"] == "https://t.me/$test_invoice" and "300 ⭐" in button["text"]
        inv = _calls(tg, "createInvoiceLink")[0]
        assert inv["currency"] == "XTR" and inv["prices"] == [{"label": "30 dní", "amount": 300}]
        assert int(inv["subscription_period"]) == SUBSCRIPTION_PERIOD and inv["payload"] == "sub:alex:300"
        assert "provider_token" not in inv or inv["provider_token"] in ("", None)

        # čtvrtá hned potom -> žádné další upozornění (max 1× za 10 min), AI pořád ne
        tg.text("čtvrtá")
        await asyncio.sleep(1.0)
        assert sum("vyčerpané" in t for t in tg.sent_texts()) == 1
        assert len(an.chat_requests()) == n_ai
        assert storage.count_messages(555, "alex") == 1 + 2 * 2  # nad limit se nic neukládá

        # /predplatne bez předplatného
        tg.text("/predplatne")
        await wait_until(lambda: any("Dnes ti zbývá 0 z 2" in t for t in tg.sent_texts()))

        # kontrola před platbou
        tg.push(pre_checkout_query={"id": "pc1", "from": USER, "currency": "XTR", "total_amount": 300,
                                    "invoice_payload": "sub:alex:300"})
        await wait_until(lambda: _calls(tg, "answerPreCheckoutQuery"))
        assert _calls(tg, "answerPreCheckoutQuery")[0]["ok"] is True
        tg.push(pre_checkout_query={"id": "pc2", "from": USER, "currency": "XTR", "total_amount": 1,
                                    "invoice_payload": "neco-jineho"})
        await wait_until(lambda: len(_calls(tg, "answerPreCheckoutQuery")) == 2)
        assert _calls(tg, "answerPreCheckoutQuery")[1]["ok"] is False

        # zaplaceno -> potvrzení a odpověď na zprávy, které čekaly
        exp = int(time.time()) + SUBSCRIPTION_PERIOD
        tg.push(message={"successful_payment": {
            "currency": "XTR", "total_amount": 300, "invoice_payload": "sub:alex:300",
            "telegram_payment_charge_id": "charge-1", "provider_payment_charge_id": "",
            "subscription_expiration_date": exp, "is_recurring": True, "is_first_recurring": True}})
        await wait_until(lambda: any("Předplatné je aktivní" in t for t in tg.sent_texts()))
        await wait_until(lambda: len(an.chat_requests()) == n_ai + 1)
        assert _last_user_text(an.chat_requests()[-1]) == ["třetí", "čtvrtá"]
        assert abs(storage.premium_until(555, "alex") - exp) < 1

        # s předplatným už limit neplatí
        tg.text("pátá")
        await wait_until(lambda: len(an.chat_requests()) == n_ai + 2)
        tg.text("/predplatne")
        await wait_until(lambda: any("Předplatné máš aktivní" in t for t in tg.sent_texts()))

        # automatické prodloužení -> uloží se, uživatel nedostane další potvrzení
        n_confirm = sum("Předplatné je aktivní" in t for t in tg.sent_texts())
        tg.push(message={"successful_payment": {
            "currency": "XTR", "total_amount": 300, "invoice_payload": "sub:alex:300",
            "telegram_payment_charge_id": "charge-2", "provider_payment_charge_id": "",
            "subscription_expiration_date": exp + SUBSCRIPTION_PERIOD, "is_recurring": True,
            "is_first_recurring": False}})
        await wait_until(lambda: abs(storage.premium_until(555, "alex") - (exp + SUBSCRIPTION_PERIOD)) < 1)
        await asyncio.sleep(0.5)
        assert sum("Předplatné je aktivní" in t for t in tg.sent_texts()) == n_confirm
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        tg.server.shutdown()
        an.server.shutdown()


def test_free_limit_and_stars_subscription():
    asyncio.run(scenario())
