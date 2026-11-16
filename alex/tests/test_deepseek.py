"""Tereza na DeepSeeku: převod zpráv a celý tok proti simulovanému DeepSeek API (bez internetu)."""

import asyncio
import base64
import json
import threading
import time
from dataclasses import replace
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler

from openai import AsyncOpenAI

import app.telegram_bot as tb
from app.brain import build_api_messages
from app.brain_deepseek import PHOTO_UNAVAILABLE, DeepSeekBrain, to_openai_messages
from app.calendar_cz import is_workday
from app.config import TIMEZONE, Settings
from app.llm import REFUSAL_REPLY
from app.persona import ALEX
from app.prompts import static_system_prompt
from app.scheduler import slot_plan
from app.storage import Message, Storage
from app.telegram_bot import ERROR_REPLY, CompanionBot
from tests.test_end_to_end import JPEG, TelegramMock, _serve, wait_until

FACTS = ["Jmenuje se Tomáš", "Pracuje na směny"]


# --- převod zpráv -------------------------------------------------------------------------

def _m(i, role, text):
    return Message(id=i, role=role, content=text, kind="chat", created_at=0)


def test_to_openai_messages_text_and_image():
    hist = [_m(1, "assistant", "Ahoj"), _m(2, "user", "čau"), _m(3, "user", "[Poslala ti fotku] s popiskem: pes")]
    api = build_api_messages(hist, images={3: JPEG})
    out = to_openai_messages("SYSTEM", api)
    assert out[0] == {"role": "system", "content": "SYSTEM"}
    assert [m["role"] for m in out] == ["system", "user", "assistant", "user"]
    parts = out[3]["content"]
    assert parts[0]["type"] == "image_url"
    assert base64.b64decode(parts[0]["image_url"]["url"].split(",", 1)[1]) == JPEG
    assert [p["text"] for p in parts[1:]] == ["čau", "[Poslala ti fotku] s popiskem: pes"]


def test_to_openai_messages_without_images_marks_photo():
    api = build_api_messages([_m(1, "user", "[Poslala ti fotku]")], images={1: JPEG})
    out = to_openai_messages("S", api, with_images=False)
    assert out[1] == {"role": "user", "content": f"[Poslala ti fotku] {PHOTO_UNAVAILABLE}"}


# --- simulované DeepSeek API --------------------------------------------------------------

class DeepSeekMock:
    def __init__(self):
        self.lock = threading.Lock()
        self.requests: list[dict] = []
        self.fail_status = 0  # např. 402 = došel kredit (jen u chatu)
        self.filter_next = 0  # finish_reason=content_filter
        self.reject_images = False
        mock = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                is_memory = body.get("response_format", {}).get("type") == "json_object"
                has_image = any(isinstance(m["content"], list) for m in body["messages"])
                with mock.lock:
                    mock.requests.append(body)
                    fail = mock.fail_status if not is_memory else 0
                    mock.fail_status = 0 if fail else mock.fail_status
                    filt = mock.filter_next > 0 and not is_memory
                    if filt:
                        mock.filter_next -= 1
                    reject = mock.reject_images and has_image
                if fail or reject:
                    status = fail or 400
                    msg = "Insufficient Balance" if status == 402 else "This model does not support image"
                    out = {"error": {"message": msg, "type": "invalid_request_error", "code": None}}
                else:
                    status = 200
                    text = json.dumps({"facts": FACTS}, ensure_ascii=False) if is_memory else "Ahoj Tomáši 😊\n\nJak se máš?"
                    out = {
                        "id": "c1", "object": "chat.completion", "created": int(time.time()), "model": body["model"],
                        "choices": [{"index": 0, "finish_reason": "content_filter" if filt else "stop",
                                     "message": {"role": "assistant", "content": "" if filt else text}}],
                        "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120,
                                  "prompt_cache_hit_tokens": 60, "prompt_cache_miss_tokens": 40},
                    }
                data = json.dumps(out).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self.server, self.url = _serve(H)

    def chat(self):
        with self.lock:
            return [b for b in self.requests if "response_format" not in b]

    def memory(self):
        with self.lock:
            return [b for b in self.requests if "response_format" in b]


def _last_user(req):
    content = [m for m in req["messages"] if m["role"] == "user"][-1]["content"]
    return content if isinstance(content, str) else "\n".join(p["text"] for p in content if p["type"] == "text")


def _images(req):
    return [p for m in req["messages"] if isinstance(m["content"], list) for p in m["content"] if p["type"] == "image_url"]


async def scenario(monkeypatch):
    monkeypatch.setattr(tb, "MEMORY_EVERY", 4)
    tg, ds = TelegramMock(), DeepSeekMock()
    settings = Settings(telegram_token="123:TEST", model="-", effort="-", db_path=":memory:",
                        reply_debounce_seconds=0.6, typing_simulation=False, provider="deepseek")
    storage = Storage(":memory:")
    brain = DeepSeekBrain(AsyncOpenAI(api_key="sk-test", base_url=ds.url, max_retries=0), "deepseek-flash")
    bot = CompanionBot(settings, ALEX, storage, brain)
    bot.telegram_base_url, bot.telegram_base_file_url = f"{tg.url}/bot", f"{tg.url}/file/bot"
    application = bot.build_application()
    await application.initialize()
    await application.post_init(application)
    await application.start()
    await application.updater.start_polling(poll_interval=0.05, timeout=0)
    try:
        # první zpráva po ověření věku
        tg.text("/start")
        await wait_until(lambda: any("18 let" in t for t in tg.sent_texts()))
        tg.button("age:adult")
        await wait_until(lambda: len(ds.chat()) == 1 and tg.sent_texts()[-2:] == ["Ahoj Tomáši 😊", "Jak se máš?"])
        first = ds.chat()[0]
        assert first["model"] == "deepseek-flash" and first["thinking"] == {"type": "disabled"}
        assert first["messages"][0]["role"] == "system"
        assert "Právě jste se v aplikaci seznámili" in first["messages"][0]["content"]

        # dvě rychlé zprávy -> jedna odpověď
        n = len(ds.chat())
        tg.text("ahoj")
        tg.text("mám volno")
        await wait_until(lambda: len(ds.chat()) == n + 1)
        await asyncio.sleep(1.0)
        assert len(ds.chat()) == n + 1
        assert _last_user(ds.chat()[-1]) == "ahoj\nmám volno"

        # fotka jde jako image_url
        n = len(ds.chat())
        photo = {"photo": [{"file_id": "big", "file_unique_id": "b", "width": 800, "height": 800}], "caption": "pes"}
        tg.push(message=photo)
        await wait_until(lambda: len(ds.chat()) == n + 1)
        imgs = _images(ds.chat()[-1])
        assert len(imgs) == 1 and base64.b64decode(imgs[0]["image_url"]["url"].split(",", 1)[1]) == JPEG

        # paměť přes JSON režim
        await wait_until(lambda: storage.get_user(555, "alex").facts == FACTS)
        mem = ds.memory()[0]
        assert mem["response_format"] == {"type": "json_object"} and "JSON" in mem["messages"][0]["content"]

        # model fotku odmítne -> pošle se znovu bez ní a Tereza odpoví
        ds.reject_images = True
        n_sent = len(tg.sent_texts())
        tg.push(message={**photo, "caption": "kočka"})
        await wait_until(lambda: len(tg.sent_texts()) >= n_sent + 2)
        retry = ds.chat()[-1]
        assert not _images(retry) and PHOTO_UNAVAILABLE in _last_user(retry)
        ds.reject_images = False

        # filtr obsahu -> náhradní odpověď v roli
        ds.filter_next = 1
        tg.text("něco")
        await wait_until(lambda: REFUSAL_REPLY.split("\n\n")[0] in tg.sent_texts())

        # došel kredit -> omluva, další zpráva odpoví na obě
        ds.fail_status = 402
        tg.text("haló?")
        await wait_until(lambda: ERROR_REPLY in tg.sent_texts())
        n = len(ds.chat())
        tg.text("už to jde?")
        await wait_until(lambda: len(ds.chat()) == n + 1)
        assert _last_user(ds.chat()[-1]) == "haló?\nuž to jde?"

        await wait_until(lambda: storage.latest_user_message_id(555, "alex")
                         <= storage.get_user(555, "alex").last_answered_user_msg_id)  # odpověď je uložená
        # zpráva sama od sebe
        bot.persona = replace(ALEX, slots=tuple(replace(s, chance=1.0) for s in ALEX.slots))
        tomorrow = (datetime.now(TIMEZONE) + timedelta(days=1)).date()
        morning = "morning" if is_workday(tomorrow) else "morning_off"  # o víkendu a ve svátek jiné okno
        slot = next(x for x in bot.persona.slots if x.name == morning)
        _, target = slot_plan(555, "alex", tomorrow.isoformat(), slot)
        fake_now = datetime.combine(tomorrow, target, TIMEZONE) + timedelta(minutes=1)
        storage.db.execute("UPDATE messages SET created_at = ?", (fake_now.timestamp() - 36000,))
        storage.db.commit()
        n = len(ds.chat())
        await bot._maybe_write_first(application.bot, storage.get_user(555, "alex"), fake_now)
        assert len(ds.chat()) == n + 1 and "Je ráno" in ds.chat()[-1]["messages"][0]["content"]

        # společné vlastnosti: jedna systémová zpráva se stejným začátkem (cache), role se střídají
        static = static_system_prompt(ALEX)
        for r in ds.chat():
            msgs = r["messages"]
            assert msgs[0]["role"] == "system" and msgs[0]["content"].startswith(static)
            roles = [m["role"] for m in msgs[1:]]
            assert "system" not in roles and roles[0] == "user"
            assert all(a != b for a, b in zip(roles, roles[1:]))
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        tg.server.shutdown()
        ds.server.shutdown()


def test_deepseek_end_to_end(monkeypatch):
    asyncio.run(scenario(monkeypatch))


def test_deepseek_turn_note_goes_last():
    from types import SimpleNamespace

    captured = {}

    class FakeCompletions:
        async def create(self, **kw):
            captured.update(kw)
            msg = SimpleNamespace(content="tak jo 😊")
            return SimpleNamespace(model="deepseek-flash", usage=None,
                                   choices=[SimpleNamespace(finish_reason="stop", message=msg)])

    client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    brain = DeepSeekBrain(client, "deepseek-flash")
    out = asyncio.run(brain.reply(ALEX, "DYN", [_m(1, "user", "pošli fotku")], {}, "POKYN"))
    assert out == "tak jo 😊"
    assert captured["messages"][-1] == {"role": "system", "content": "POKYN"}
    assert captured["messages"][-2]["role"] == "user"
