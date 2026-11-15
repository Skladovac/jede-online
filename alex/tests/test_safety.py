"""Bezpečnost a férovost: krize, nezletilí, odpovědi zdarma, ukázková fotka, rozloučení."""

import asyncio
import json
import time
from datetime import datetime, timedelta

from anthropic import AsyncAnthropic

from app.brain import Brain
from app.config import TIMEZONE, Settings
from app.persona import ALEX
from app.photos import PhotoLibrary, SAMPLE_TURN_NOTE
from app.prompts import static_system_prompt
from app.safety import CRISIS_CONTEXT_LINE, CRISIS_SYSTEM_MESSAGE, CRISIS_TURN_NOTE, MINOR_BLOCK_MESSAGE
from app.storage import Storage
from app.telegram_bot import CompanionBot
from tests.test_end_to_end import JPEG, AnthropicMock, TelegramMock, wait_until


def _library(folder):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "photos.json").write_text(json.dumps([
        {"id": "selfie", "soubor": "selfie.jpg", "kdy": ["kdykoliv"], "popis": "selfie u okna"}]), encoding="utf-8")
    (folder / "selfie.jpg").write_bytes(JPEG)
    return PhotoLibrary(folder)


class Harness:
    async def start(self, tmp_path, **overrides):
        self.tg, self.an = TelegramMock(), AnthropicMock()
        base = dict(telegram_token="123:TEST", model="claude-haiku-5-5", effort="medium", db_path=":memory:",
                    reply_debounce_seconds=0.3, typing_simulation=False)
        base.update(overrides)
        self.settings = Settings(**base)
        self.storage = Storage(":memory:")
        brain = Brain(AsyncAnthropic(base_url=self.an.url, api_key="k", max_retries=0), "claude-haiku-5-5", "medium")
        self.bot = CompanionBot(self.settings, ALEX, self.storage, brain)
        self.bot.photos = _library(tmp_path / "alex")
        self.bot.telegram_base_url = f"{self.tg.url}/bot"
        self.bot.telegram_base_file_url = f"{self.tg.url}/file/bot"
        self.app = self.bot.build_application()
        await self.app.initialize()
        await self.app.post_init(self.app)
        await self.app.start()
        await self.app.updater.start_polling(poll_interval=0.05, timeout=0)
        self.tg.text("/start")
        await wait_until(lambda: any("18 let" in t for t in self.tg.sent_texts()))
        self.tg.button("age:adult")
        await wait_until(lambda: len(self.an.chat_requests()) == 1 and "Jak se máš?" in self.tg.sent_texts())

    async def say(self, text, expect_reply=True):
        n = len(self.an.chat_requests())
        self.tg.text(text)
        if expect_reply:
            await wait_until(lambda: len(self.an.chat_requests()) == n + 1)
            await wait_until(lambda: self.storage.latest_user_message_id(555, "alex")
                             <= self.storage.get_user(555, "alex").last_answered_user_msg_id)
        else:
            await asyncio.sleep(1.0)

    def last_request(self):
        return self.an.chat_requests()[-1]

    async def stop(self):
        await self.app.updater.stop()
        await self.app.stop()
        await self.app.shutdown()
        self.tg.server.shutdown()
        self.an.server.shutdown()


def run(coro):
    return asyncio.run(coro)


# --- krize má přednost před limitem i fotkami ------------------------------------------------

def test_crisis_bypasses_limit_and_changes_behaviour(tmp_path):
    async def scenario():
        h = Harness()
        await h.start(tmp_path, free_messages_per_day=1, payments_enabled=True, free_replies_after_proactive=0, sample_photo_after=0)
        try:
            await h.say("ahoj")  # 1/1
            n_ai = len(h.an.chat_requests())
            await h.say("a ještě", expect_reply=False)  # nad limit -> upozornění, AI ne
            assert any("vyčerpané" in t for t in h.tg.sent_texts()) and len(h.an.chat_requests()) == n_ai

            await h.say("už nechci žít, nemá to cenu")  # krize: i nad limitem odpoví
            assert CRISIS_SYSTEM_MESSAGE in h.tg.sent_texts()
            req = h.last_request()
            assert req["messages"][-1] == {"role": "system", "content": CRISIS_TURN_NOTE}
            assert CRISIS_CONTEXT_LINE in req["system"][1]["text"]
            assert h.storage.get_user(555, "alex").crisis_at > 0

            await h.say("díky, že mě posloucháš")  # další den/zpráva: limit pořád neplatí, kontext zůstává
            req = h.last_request()
            assert CRISIS_CONTEXT_LINE in req["system"][1]["text"] and req["messages"][-1]["role"] == "user"
            assert h.tg.sent_texts().count(CRISIS_SYSTEM_MESSAGE) == 1  # systémová zpráva jen jednou za 24 h

            # 3 dny nepíše sama od sebe
            user = h.storage.get_user(555, "alex")
            n_ai = len(h.an.chat_requests())
            await h.bot._maybe_write_first(h.app.bot, user, datetime.now(TIMEZONE).replace(hour=8))
            assert len(h.an.chat_requests()) == n_ai
        finally:
            await h.stop()
    run(scenario())


# --- nezletilí ----------------------------------------------------------------------------------

def test_minor_signal_ends_conversation(tmp_path):
    async def scenario():
        h = Harness()
        await h.start(tmp_path)
        try:
            n_ai = len(h.an.chat_requests())
            await h.say("ahoj, je mi 15", expect_reply=False)
            assert MINOR_BLOCK_MESSAGE in h.tg.sent_texts()
            assert h.storage.get_user(555, "alex").age_status == "minor"
            await h.say("haló?", expect_reply=False)
            assert any("jen pro dospělé" in t for t in h.tg.sent_texts()[-1:])
            assert len(h.an.chat_requests()) == n_ai  # AI se už nevolá
        finally:
            await h.stop()
    run(scenario())


# --- odpovědi na její zprávy se do limitu nepočítají ------------------------------------------------

def test_replies_to_her_messages_are_free(tmp_path):
    async def scenario():
        h = Harness()
        await h.start(tmp_path, free_messages_per_day=1, payments_enabled=True, free_replies_after_proactive=3, sample_photo_after=0)
        try:
            for t in ("jedna", "dvě", "tři"):  # odpovědi na její uvítání (zpráva sama od sebe) -> zdarma
                await h.say(t)
            await h.say("čtyři")  # první placená 1/1
            assert not any("vyčerpané" in t for t in h.tg.sent_texts())
            await h.say("pět", expect_reply=False)
            assert any("vyčerpané" in t for t in h.tg.sent_texts())
        finally:
            await h.stop()
    run(scenario())


def test_no_proactive_messages_when_limit_exhausted():
    st = Storage(":memory:")
    user = st.get_or_create_user(1, "alex", 1, "T")
    st.update_user(1, "alex", age_status="adult")
    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                        typing_simulation=False, free_messages_per_day=1, payments_enabled=True)
    bot = CompanionBot(settings, ALEX, st, brain=None)  # brain=None: kdyby chtěla psát, spadlo by to
    st.add_message(1, "alex", "user", "ahoj", created_at=time.time() - 10 * 3600)
    asyncio.run(bot._maybe_write_first(None, st.get_user(1, "alex"), datetime.now(TIMEZONE).replace(hour=8)))
    assert user is not None


# --- ukázková fotka pro všechny, stejně ---------------------------------------------------------

def test_sample_photo_once_for_new_users(tmp_path):
    async def scenario():
        h = Harness()
        await h.start(tmp_path, sample_photo_after=3, free_replies_after_proactive=0)
        try:
            h.an.reply_text = "[FOTKA: selfie]\n\njak se ti líbí moje kytky? 😊"
            await h.say("jak se máš")
            await h.say("já dobře")
            assert not [1 for m, _ in h.tg.calls if m == "sendPhoto"]
            await h.say("co děláš?")  # 3. zpráva -> ukázková fotka
            assert h.last_request()["messages"][-1] == {"role": "system", "content": SAMPLE_TURN_NOTE}
            assert len([1 for m, _ in h.tg.calls if m == "sendPhoto"]) == 1
            await h.say("hezká fotka")  # už ne podruhé
            assert h.last_request()["messages"][-1]["role"] == "user"
            assert len([1 for m, _ in h.tg.calls if m == "sendPhoto"]) == 1
        finally:
            await h.stop()
    run(scenario())


def test_sample_photo_not_after_three_days(tmp_path):
    st = Storage(":memory:")
    st.get_or_create_user(1, "alex", 1, "T")
    st.db.execute("UPDATE users SET created_at = ?", (time.time() - 5 * 86400,))
    for i in range(10):
        st.add_message(1, "alex", "user", f"zpráva {i}")
    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                        typing_simulation=False, sample_photo_after=3)
    bot = CompanionBot(settings, ALEX, st, brain=None)
    bot.photos = _library(tmp_path / "t")
    assert not bot._sample_photo_due(st.get_user(1, "alex"), datetime.now(TIMEZONE) - timedelta(minutes=1))
    # a sama od sebe před ukázkovou fotkou nic neposílá
    assert bot._allowed_photos(st.get_user(1, "alex"), datetime.now(TIMEZONE), "auto") == {}


# --- pravidla v instrukcích -------------------------------------------------------------------------

def test_prompt_has_goodbye_and_no_reproach_rules():
    p = static_system_prompt(ALEX)
    assert "Když se loučí" in p and "už jdeš?" in p and "nic nevyčítej" in p


# --- zpráva napsaná, zatímco Tereza ještě odpovídá ------------------------------------------------

def test_order_for_reply_moves_pending_user_messages_last():
    from app.brain import order_for_reply
    from app.storage import Message
    h = [Message(1, "user", "a", "chat", 0), Message(2, "user", "b", "chat", 0), Message(3, "assistant", "R", "chat", 0)]
    assert [m.content for m in order_for_reply(h, last_answered_user_msg_id=1)] == ["a", "R", "b"]
    assert [m.content for m in order_for_reply(h, last_answered_user_msg_id=2)] == ["a", "b", "R"]


def test_message_sent_while_she_is_replying(tmp_path):
    async def scenario():
        h = Harness()
        await h.start(tmp_path, sample_photo_after=0)
        try:
            h.an.delay = 1.5  # model odpovídá pomalu
            n = len(h.an.chat_requests())
            h.tg.text("taky z Brna")
            await wait_until(lambda: len(h.an.chat_requests()) == n + 1)  # odpověď na 1. zprávu se generuje
            h.tg.text("zajdeme na kafe?")  # přijde během generování
            await wait_until(lambda: len(h.an.chat_requests()) == n + 2, timeout=15)
            msgs = h.an.chat_requests()[-1]["messages"]
            assert msgs[-1]["role"] == "user"
            assert [b["text"] for b in msgs[-1]["content"] if b["type"] == "text"] == ["zajdeme na kafe?"]
            assert msgs[-2]["role"] == "assistant"  # její odpověď na „taky z Brna“ je před ní
        finally:
            await h.stop()
    run(scenario())
