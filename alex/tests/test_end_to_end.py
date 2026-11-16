"""Celý tok bota proti simulovanému Telegramu a simulovanému Claude API (bez internetu).

Ověřuje skutečné knihovny (python-telegram-bot, anthropic SDK) i skutečný formát požadavků.
"""

import asyncio
import base64
import json
import threading
import time
from dataclasses import replace
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

import pytest
from anthropic import AsyncAnthropic

import app.telegram_bot as tb
from app.brain import FALLBACK_MODELS, REFUSAL_REPLY, Brain
from app.calendar_cz import is_workday
from app.config import TIMEZONE, Settings
from app.persona import ALEX
from app.scheduler import slot_plan
from app.storage import Storage
from app.telegram_bot import ERROR_REPLY, CompanionBot

USER = {"id": 555, "is_bot": False, "first_name": "Tomáš"}
CHAT = {"id": 555, "type": "private", "first_name": "Tomáš"}
BOT_USER = {"id": 999, "is_bot": True, "first_name": "Tereza", "username": "tereza_test_bot",
            "can_join_groups": False, "can_read_all_group_messages": False, "supports_inline_queries": False}
JPEG = b"\xff\xd8\xff\xe0fake-jpeg-bytes"
JPEG_MARK = b"fake-jpeg-bytes"
FACTS = ["Jmenuje se Tomáš", "Má psa Maxe"]


def _serve(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


class TelegramMock:
    def __init__(self):
        self.lock = threading.Lock()
        self.updates: list[dict] = []
        self.calls: list[tuple[str, dict]] = []
        self._uid = 1
        self._mid = 1000
        mock = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                if "/file/" in self.path:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(JPEG)

            def do_POST(self):
                method = self.path.rsplit("/", 1)[-1]
                data = self.rfile.read(int(self.headers.get("Content-Length", 0) or 0))
                ctype = self.headers.get("Content-Type") or ""
                params = {}
                if "multipart" in ctype:  # nahrávání souboru (sendPhoto)
                    params = {"_upload_bytes": len(data), "_has_jpeg": JPEG_MARK in data}
                elif "json" in ctype:
                    params = json.loads(data.decode() or "{}")
                else:
                    raw = data.decode()
                    for k, v in parse_qs(raw).items():
                        try:
                            params[k] = json.loads(v[0])
                        except ValueError:
                            params[k] = v[0]
                result = mock.handle(method, params)
                body = json.dumps({"ok": True, "result": result}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.server, self.url = _serve(H)

    def handle(self, method, params):
        with self.lock:
            if method != "getUpdates":
                self.calls.append((method, params))
            if method == "getMe":
                return BOT_USER
            if method == "getUpdates":
                offset = int(params.get("offset", 0) or 0)
                ready = [u for u in self.updates if u["update_id"] >= offset]
                self.updates = ready
            elif method in ("sendMessage", "editMessageText"):
                self._mid += 1
                return {"message_id": self._mid, "date": int(time.time()), "chat": CHAT,
                        "from": BOT_USER, "text": params.get("text", "")}
            elif method == "sendPhoto":
                self._mid += 1
                return {"message_id": self._mid, "date": int(time.time()), "chat": CHAT, "from": BOT_USER,
                        "photo": [{"file_id": f"photo-file-{self._mid}", "file_unique_id": "pu",
                                   "width": 800, "height": 800}]}
            elif method == "createInvoiceLink":
                return "https://t.me/$test_invoice"
            elif method == "getFile":
                return {"file_id": params["file_id"], "file_unique_id": "u", "file_size": len(JPEG),
                        "file_path": "photos/p.jpg"}
            else:
                return True
        time.sleep(0.05)
        return ready

    def push(self, **payload):
        with self.lock:
            self._mid += 1
            u = {"update_id": self._uid, **payload}
            for key in ("message",):
                if key in u:
                    u[key] = {"message_id": self._mid, "date": int(time.time()), "chat": CHAT, "from": USER, **u[key]}
            self._uid += 1
            self.updates.append(u)

    def text(self, text):
        entities = [{"type": "bot_command", "offset": 0, "length": len(text)}] if text.startswith("/") else None
        msg = {"text": text}
        if entities:
            msg["entities"] = entities
        self.push(message=msg)

    def button(self, data):
        self.push(callback_query={"id": f"cb{self._uid}", "from": USER, "chat_instance": "ci", "data": data,
                                  "message": {"message_id": 1, "date": int(time.time()), "chat": CHAT,
                                              "from": BOT_USER, "text": "…"}})

    def sent_texts(self):
        with self.lock:
            return [p.get("text", "") for m, p in self.calls if m == "sendMessage"]

    def count(self, method):
        with self.lock:
            return sum(1 for m, _ in self.calls if m == method)


class AnthropicMock:
    def __init__(self):
        self.lock = threading.Lock()
        self.requests: list[tuple[dict, dict]] = []
        self.fail_next = 0
        self.refuse_next = 0
        self.reply_text = "Ahoj Tomáši 😊\n\nJak se máš?"
        self.delay = 0.0  # simulace pomalého modelu
        mock = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                is_memory = "format" in (body.get("output_config") or {})
                if mock.delay and not is_memory:
                    time.sleep(mock.delay)
                with mock.lock:
                    mock.requests.append((dict(self.headers), body))
                    # simulované chyby jen u chatových požadavků (paměť běží souběžně na pozadí)
                    fail = mock.fail_next > 0 and not is_memory
                    refuse = mock.refuse_next > 0 and not is_memory
                    if fail:
                        mock.fail_next -= 1
                    if refuse:
                        mock.refuse_next -= 1
                if fail:
                    out, status = {"type": "error", "error": {"type": "api_error", "message": "boom"}}, 500
                else:
                    text = json.dumps({"facts": FACTS}, ensure_ascii=False) if is_memory else mock.reply_text
                    out = {
                        "id": "msg_test", "type": "message", "role": "assistant", "model": body["model"],
                        "content": [] if refuse else [{"type": "text", "text": text}],
                        "stop_reason": "refusal" if refuse else "end_turn", "stop_sequence": None,
                        "usage": {"input_tokens": 100, "output_tokens": 20,
                                  "cache_read_input_tokens": 50, "cache_creation_input_tokens": 0},
                    }
                    status = 200
                data = json.dumps(out).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self.server, self.url = _serve(H)

    def chat_requests(self):
        with self.lock:
            return [b for _, b in self.requests if "format" not in (b.get("output_config") or {})]

    def memory_requests(self):
        with self.lock:
            return [b for _, b in self.requests if "format" in (b.get("output_config") or {})]


async def wait_until(cond, timeout=10.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return
        await asyncio.sleep(0.05)
    raise AssertionError("Podmínka nesplněna včas")


def _last_user_text(req):
    msg = [m for m in req["messages"] if m["role"] == "user"][-1]
    return [b.get("text") for b in msg["content"] if b["type"] == "text"]


async def scenario(monkeypatch, model, effort):
    monkeypatch.setattr(tb, "MEMORY_EVERY", 4)
    tg, an = TelegramMock(), AnthropicMock()
    settings = Settings(telegram_token="123:TEST", model=model, effort=effort, db_path=":memory:",
                        reply_debounce_seconds=0.6, typing_simulation=False)
    storage = Storage(":memory:")
    client = AsyncAnthropic(base_url=an.url, api_key="test-key", max_retries=0)
    bot = CompanionBot(settings, ALEX, storage, Brain(client, settings.model, settings.effort))
    bot.telegram_base_url, bot.telegram_base_file_url = f"{tg.url}/bot", f"{tg.url}/file/bot"
    application = bot.build_application()
    await application.initialize()
    await application.post_init(application)  # run_polling() to dělá samo
    await application.start()
    await application.updater.start_polling(poll_interval=0.05, timeout=0)
    try:
        assert tg.count("setMyCommands") == 1

        # 1) /start -> ověření věku, zatím žádné volání Claude
        tg.text("/start")
        await wait_until(lambda: any("18 let" in t for t in tg.sent_texts()))
        assert "AI postava" in tg.sent_texts()[0]
        assert not an.chat_requests()

        # 1b) psaní před potvrzením věku -> znovu ověření, nic se neukládá
        tg.text("ahoj")
        await wait_until(lambda: sum("18 let" in t for t in tg.sent_texts()) == 2)
        assert storage.count_messages(555, "alex") == 0

        # 2) potvrzení 18+ -> Tereza napíše první (2 bubliny)
        tg.button("age:adult")
        await wait_until(lambda: len(an.chat_requests()) == 1 and len(tg.sent_texts()) >= 4)
        first = an.chat_requests()[0]
        assert "Právě jste se v aplikaci seznámili" in first["system"][1]["text"]
        assert tg.sent_texts()[-2:] == ["Ahoj Tomáši 😊", "Jak se máš?"]
        assert storage.get_user(555, "alex").age_status == "adult"

        # 3) dvě rychlé zprávy -> jedna odpověď na obě
        n = len(an.chat_requests())
        tg.text("ahoj")
        tg.text("mám dneska volno")
        await wait_until(lambda: len(an.chat_requests()) == n + 1)
        await asyncio.sleep(1.0)
        assert len(an.chat_requests()) == n + 1, "debounce: má být jen jedno volání"
        assert _last_user_text(an.chat_requests()[-1]) == ["ahoj", "mám dneska volno"]

        # 4) fotka -> obrázek jde do Claude
        n = len(an.chat_requests())
        tg.push(message={"photo": [
            {"file_id": "small", "file_unique_id": "s", "width": 90, "height": 90, "file_size": 10},
            {"file_id": "big", "file_unique_id": "b", "width": 800, "height": 800, "file_size": 99},
        ], "caption": "můj pes"})
        await wait_until(lambda: len(an.chat_requests()) == n + 1)
        req = an.chat_requests()[-1]
        img = [b for m in req["messages"] for b in m["content"] if b["type"] == "image"]
        assert len(img) == 1 and base64.b64decode(img[0]["source"]["data"]) == JPEG
        assert ("getFile", {"file_id": "big"}) in [(m, {"file_id": p.get("file_id")}) for m, p in tg.calls if m == "getFile"]
        assert "[Poslala ti fotku] s popiskem: můj pes" in _last_user_text(req)

        # 5) paměť se aktualizovala na pozadí (MEMORY_EVERY=4 v testu)
        await wait_until(lambda: storage.get_user(555, "alex").facts == FACTS)
        mem = an.memory_requests()[0]
        assert mem["output_config"]["format"]["type"] == "json_schema"
        tg.text("/pamet")
        await wait_until(lambda: any("Má psa Maxe" in t for t in tg.sent_texts()))

        # 6) nálepka a fotka už nejsou v dalším požadavku jako obrázek (jen text)
        n = len(an.chat_requests())
        tg.push(message={"sticker": {"file_id": "st", "file_unique_id": "stu", "type": "regular", "width": 512,
                                     "height": 512, "is_animated": False, "is_video": False, "emoji": "😀"}})
        await wait_until(lambda: len(an.chat_requests()) == n + 1)
        req = an.chat_requests()[-1]
        assert "[Poslala ti nálepku 😀]" in _last_user_text(req)
        assert not [b for m in req["messages"] for b in m["content"] if b["type"] == "image"]
        assert "- Má psa Maxe" in req["system"][1]["text"]  # paměť je v kontextu

        # 7) výpadek API -> omluvná zpráva, další zpráva odpoví na obě
        an.fail_next = 1
        tg.text("haló?")
        await wait_until(lambda: ERROR_REPLY in tg.sent_texts())
        n = len(an.chat_requests())
        tg.text("už to jde?")
        await wait_until(lambda: len(an.chat_requests()) == n + 1)
        assert _last_user_text(an.chat_requests()[-1]) == ["haló?", "už to jde?"]

        # 8) odmítnutí modelem -> náhradní odpověď v roli
        an.refuse_next = 1
        tg.text("něco")
        await wait_until(lambda: REFUSAL_REPLY.split("\n\n")[0] in tg.sent_texts())

        await wait_until(lambda: storage.latest_user_message_id(555, "alex")
                         <= storage.get_user(555, "alex").last_answered_user_msg_id)  # odpověď je uložená
        # 9) zpráva sama od sebe: posuneme čas na zítřejší ráno a historii o 10 h zpět
        bot.persona = replace(ALEX, slots=tuple(replace(s, chance=1.0) for s in ALEX.slots))
        tomorrow = (datetime.now(TIMEZONE) + timedelta(days=1)).date()
        morning = "morning" if is_workday(tomorrow) else "morning_off"  # o víkendu a ve svátek jiné okno
        slot = next(x for x in bot.persona.slots if x.name == morning)
        _, target = slot_plan(555, "alex", tomorrow.isoformat(), slot)
        fake_now = datetime.combine(tomorrow, target, TIMEZONE) + timedelta(minutes=1)
        storage.db.execute("UPDATE messages SET created_at = ?", (fake_now.timestamp() - 36000,))
        storage.db.commit()
        n_sent, n_req = len(tg.sent_texts()), len(an.chat_requests())
        await bot._maybe_write_first(application.bot, storage.get_user(555, "alex"), fake_now)
        assert len(an.chat_requests()) == n_req + 1 and len(tg.sent_texts()) == n_sent + 2
        req = an.chat_requests()[-1]
        assert "Je ráno" in req["system"][1]["text"]
        assert "Automatická poznámka" in _last_user_text(req)[-1]
        u = storage.get_user(555, "alex")
        assert u.unanswered_proactive == 1
        await bot._maybe_write_first(application.bot, u, fake_now + timedelta(minutes=5))
        assert len(an.chat_requests()) == n_req + 1, "stejné okno se nesmí opakovat"

        # 10) společné vlastnosti všech chat požadavků (cache, fallback, effort)
        reqs = an.chat_requests()
        assert len({r["system"][0]["text"] for r in reqs}) == 1, "statická část musí být stejná kvůli cache"
        assert all(r["system"][0]["cache_control"] == {"type": "ephemeral"} for r in reqs)
        assert all("cache_control" not in r["system"][1] for r in reqs)
        assert all(r["output_config"] == {"effort": effort} for r in reqs)
        assert all(r["model"] == model for r in reqs)
        mem = an.memory_requests()[0]
        assert mem["model"] == model and mem["output_config"]["effort"] == effort
        with an.lock:
            all_reqs = list(an.requests)
        if model in FALLBACK_MODELS:
            assert all(b["fallbacks"] == "default" for _, b in all_reqs)
            assert all("server-side-fallback-2026-07-01" in h.get("anthropic-beta", "") for h, _ in all_reqs)
        else:  # Haiku 5.5 nemá serverový fallback – nesmí se posílat
            assert all("fallbacks" not in b for _, b in all_reqs)
            assert all("server-side-fallback" not in h.get("anthropic-beta", "") for h, _ in all_reqs)
        for r in reqs:  # role se musí střídat a začínat uživatelem
            roles = [m["role"] for m in r["messages"]]
            assert roles[0] == "user" and all(a != b for a, b in zip(roles, roles[1:]))

        # 11) /pauza a /zapomen
        tg.text("/pauza")
        await wait_until(lambda: not storage.get_user(555, "alex").proactive_enabled)
        tg.text("/zapomen")
        await wait_until(lambda: any("Opravdu smazat" in t for t in tg.sent_texts()))
        tg.button("forget:yes")
        await wait_until(lambda: storage.get_user(555, "alex") is None)
        assert storage.count_messages(555, "alex") == 0
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        tg.server.shutdown()
        an.server.shutdown()


@pytest.mark.parametrize("model,effort", [("claude-haiku-5-5", "medium"), ("claude-opus-5-5", "low")])
def test_end_to_end(monkeypatch, model, effort):
    asyncio.run(scenario(monkeypatch, model, effort))
