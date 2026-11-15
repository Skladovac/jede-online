"""Fotky od Terezy: knihovna, zpracování značky [FOTKA: id] a celý tok v simulovaném Telegramu."""

import asyncio
import json
from datetime import time as dtime
from pathlib import Path

from anthropic import AsyncAnthropic

from app.brain import Brain
from app.config import Settings
from app.persona import ALEX
from app.photos import ASKED_TURN_NOTE, TEASE_TURN_NOTE, PhotoLibrary, asks_for_photo, plan_reply, time_of_day
from app.storage import Storage
from app.telegram_bot import CompanionBot
from tests.test_end_to_end import JPEG, AnthropicMock, TelegramMock, wait_until

ROOT = Path(__file__).resolve().parent.parent


def _make_library(folder: Path, entries: list[dict], existing: set[str]) -> PhotoLibrary:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "photos.json").write_text(json.dumps(entries, ensure_ascii=False), encoding="utf-8")
    for e in entries:
        if e["id"] in existing:
            (folder / e["soubor"]).write_bytes(JPEG)
    return PhotoLibrary(folder)


ENTRIES = [
    {"id": "selfie", "soubor": "selfie.jpg", "kdy": ["kdykoliv"], "popis": "selfie u okna"},
    {"id": "oskar", "soubor": "oskar.jpg", "kdy": ["kdykoliv"], "popis": "Oskar spí na dece"},
    {"id": "rano", "soubor": "rano.jpg", "kdy": ["rano"], "popis": "ranní kafe"},
    {"id": "chybi", "soubor": "chybi.jpg", "kdy": ["kdykoliv"], "popis": "soubor neexistuje"},
]


# --- knihovna a značka ------------------------------------------------------------------

def test_library_loads_only_existing_files_and_filters_by_time(tmp_path):
    lib = _make_library(tmp_path / "alex", ENTRIES, {"selfie", "oskar", "rano"})
    assert set(lib.photos) == {"selfie", "oskar", "rano"}
    assert time_of_day(dtime(7, 30)) == "rano" and time_of_day(dtime(23, 0)) == "noc"
    assert {p.id for p in lib.available(dtime(7, 30), exclude=set())} == {"selfie", "oskar", "rano"}
    assert {p.id for p in lib.available(dtime(20, 0), exclude={"selfie"})} == {"oskar"}
    assert PhotoLibrary(tmp_path / "neexistuje").photos == {}


def test_real_alex_library_has_portrait():
    lib = PhotoLibrary.for_persona("alex", ROOT / "photos")
    assert "portret_sako" in lib.photos


def test_plan_reply_places_photo_and_cleans_markers(tmp_path):
    lib = _make_library(tmp_path / "t", ENTRIES, {"selfie", "oskar"})
    allowed = {"selfie": lib.get("selfie")}
    plan = plan_reply("Tady máš 😊\n\n[FOTKA: selfie]\n\nco ty?", "Tereza", allowed)
    assert [(t, v if t == "text" else v.id) for t, v in plan.parts] == [
        ("text", "Tady máš 😊"), ("photo", "selfie"), ("text", "co ty?")]
    assert plan.history_text == "Tady máš 😊\n\n[FOTKA: selfie]\n\nco ty?"

    # neplatné/nepovolené id -> žádná fotka, značka zmizí
    plan = plan_reply("koukej [FOTKA: oskar] hezký, ne?", "Tereza", allowed)
    assert plan.photo is None and plan.history_text == "koukej  hezký, ne?"
    # dvě značky -> jen první platná, druhá zmizí
    plan = plan_reply("[fotka:selfie]\n\nještě [FOTKA: selfie]", "Tereza", allowed)
    assert [t for t, _ in plan.parts] == ["photo", "text"] and plan.history_text == "[FOTKA: selfie]\n\nještě"


# --- celý tok v simulovaném Telegramu ----------------------------------------------------

def _seq(tg):
    with tg.lock:
        return [(m, p) for m, p in tg.calls if m in ("sendMessage", "sendPhoto")]


async def scenario(tmp_path):
    tg, an = TelegramMock(), AnthropicMock()
    settings = Settings(telegram_token="123:TEST", model="claude-haiku-5-5", effort="medium", db_path=":memory:",
                        reply_debounce_seconds=0.3, typing_simulation=False, photos_per_day=2,
                        photo_tease_refusals=0)
    storage = Storage(":memory:")
    bot = CompanionBot(settings, ALEX, storage,
                       Brain(AsyncAnthropic(base_url=an.url, api_key="k", max_retries=0), settings.model, settings.effort))
    bot.photos = _make_library(tmp_path / "alex", ENTRIES, {"selfie", "oskar"})
    bot.telegram_base_url, bot.telegram_base_file_url = f"{tg.url}/bot", f"{tg.url}/file/bot"
    application = bot.build_application()
    await application.initialize()
    await application.post_init(application)
    await application.start()
    await application.updater.start_polling(poll_interval=0.05, timeout=0)

    async def say(text, expect_ai_calls):
        tg.text(text)
        await wait_until(lambda: len(an.chat_requests()) == expect_ai_calls)
        await wait_until(lambda: storage.latest_user_message_id(555, "alex")
                         <= storage.get_user(555, "alex").last_answered_user_msg_id)

    try:
        tg.text("/start")
        await wait_until(lambda: any("18 let" in t for t in tg.sent_texts()))
        tg.button("age:adult")
        await wait_until(lambda: len(an.chat_requests()) == 1 and "Jak se máš?" in tg.sent_texts())
        dyn = an.chat_requests()[0]["system"][1]["text"]
        assert "Teď žádnou fotku poslat nemůžeš" in dyn  # v prvním pozdravu nikdy fotka
        assert "[FOTKA: id]" in an.chat_requests()[0]["system"][0]["text"]  # pravidla ve statické části

        # 1) pošle fotku mezi dvěma bublinami
        an.reply_text = "Tady máš 😊\n\n[FOTKA: selfie]\n\nco ty?"
        n_before = len(_seq(tg))
        await say("pošli fotku", 2)
        dyn = an.chat_requests()[-1]["system"][1]["text"]
        assert "- selfie: selfie u okna" in dyn and "chybi" not in dyn
        assert an.chat_requests()[-1]["messages"][-1] == {"role": "system", "content": ASKED_TURN_NOTE}
        seq = _seq(tg)[n_before:]
        assert [m for m, _ in seq] == ["sendMessage", "sendPhoto", "sendMessage"]
        assert seq[0][1]["text"] == "Tady máš 😊" and seq[2][1]["text"] == "co ty?"
        assert seq[1][1]["_has_jpeg"] is True
        assert storage.sent_photo_ids(555, "alex") == {"selfie"}
        last = storage.recent_messages(555, "alex", 1)[0]
        assert last.content == "Tady máš 😊\n\n[FOTKA: selfie]\n\nco ty?"

        # 2) stejná fotka podruhé neodejde, značka se neukáže
        an.reply_text = "[FOTKA: selfie]\n\nzase já"
        n_before = len(_seq(tg))
        await say("pošli ještě jednu fotku", 3)
        dyn = an.chat_requests()[-1]["system"][1]["text"]
        sent_part, offer_part = dyn.split("# Fotky, které můžeš poslat")
        assert "Fotky, které jsi jí už poslal" in sent_part and "- selfie: selfie u okna" in sent_part
        assert "- selfie:" not in offer_part and "- oskar: Oskar spí na dece" in offer_part
        seq = _seq(tg)[n_before:]
        assert [m for m, _ in seq] == ["sendMessage"] and seq[0][1]["text"] == "zase já"

        # 3) druhá fotka dne
        an.reply_text = "[FOTKA: oskar] tenhle lenoch 😅"
        n_before = len(_seq(tg))
        await say("co dělá Oskar? ukaž mi ho", 4)
        assert [m for m, _ in _seq(tg)[n_before:]] == ["sendPhoto", "sendMessage"]

        # 4) denní limit (2) vyčerpán -> nabídka říká, že teď nemůže, a nic se nepošle
        an.reply_text = "[FOTKA: oskar]\n\nteď ne 🙈"
        n_before = len(_seq(tg))
        await say("a další fotku?", 5)
        assert "Teď žádnou fotku poslat nemůžeš" in an.chat_requests()[-1]["system"][1]["text"]
        assert [m for m, _ in _seq(tg)[n_before:]] == ["sendMessage"]

        # 5) bez požádání (a po nedávné fotce) se fotka nenabízí
        an.reply_text = "mám se fajn"
        await say("jak se máš?", 6)
        assert "Teď žádnou fotku poslat nemůžeš" in an.chat_requests()[-1]["system"][1]["text"]

        assert not any("FOTKA" in t.upper() for t in tg.sent_texts())
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        tg.server.shutdown()
        an.server.shutdown()


def test_photos_end_to_end(tmp_path):
    asyncio.run(scenario(tmp_path))


def test_asks_for_photo():
    for t in ("pošli fotku", "Máš nějakou fotečku?", "pošli selfie", "jak vypadáš?", "ukaž se mi", "vyfoť Oskara",
              "foto?", "ukaž mi ho"):
        assert asks_for_photo(t), t
    for t in ("ahoj, jak se máš", "dneska hraje fotbal", "jsem unavený", ""):
        assert not asks_for_photo(t), t


def test_unsolicited_photos_wait_days_but_asked_ones_do_not(tmp_path):
    from datetime import datetime, timedelta

    from app.config import TIMEZONE

    st = Storage(":memory:")
    user = st.get_or_create_user(1, "alex", 1, "T")
    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                        typing_simulation=False, photos_per_day=1, photo_unsolicited_days=3, sample_photo_after=0)
    bot = CompanionBot(settings, ALEX, st, brain=None)
    bot.photos = _make_library(tmp_path / "t", ENTRIES, {"selfie", "oskar"})
    now = datetime.now(TIMEZONE).replace(hour=12)
    assert bot._allowed_photos(user, now, "auto") == {}  # bez předplatného sama od sebe nic
    assert set(bot._allowed_photos(user, now, "asked")) == {"selfie", "oskar"}  # na požádání ano
    st.add_payment("ch", 1, "alex", 400, "XTR", now.timestamp() + 86400 * 30, True)  # předplatitel
    assert set(bot._allowed_photos(user, now, "auto")) == {"selfie", "oskar"}  # ještě žádná fotka
    assert bot._allowed_photos(user, now, "off") == {}
    st.mark_photo_sent(1, "alex", "selfie")
    st.db.execute("UPDATE sent_photos SET sent_at = ?", ((now - timedelta(days=1)).timestamp(),))
    assert bot._allowed_photos(user, now, "auto") == {}  # sama od sebe až za 3 dny
    assert set(bot._allowed_photos(user, now, "asked")) == {"oskar"}  # na požádání ano (dnes ještě nic)
    st.db.execute("UPDATE sent_photos SET sent_at = ?", ((now - timedelta(days=4)).timestamp(),))
    assert set(bot._allowed_photos(user, now, "auto")) == {"oskar"}
    st.mark_photo_sent(1, "alex", "oskar")  # dnešní fotka -> denní limit 1 vyčerpán
    assert bot._allowed_photos(user, now, "asked") == {}


# --- drahoty: nejdřív hravě odmítne, pak pošle; dřív, když docházejí zprávy zdarma --------------

async def _tease_scenario(tmp_path, free_per_day, expected_modes):
    tg, an = TelegramMock(), AnthropicMock()
    an.reply_text = "[FOTKA: selfie]\n\nhmm 😏"  # model by fotku i chtěl poslat – rozhoduje bot
    settings = Settings(telegram_token="123:TEST", model="claude-haiku-5-5", effort="medium", db_path=":memory:",
                        reply_debounce_seconds=0.3, typing_simulation=False, photos_per_day=1,
                        photo_tease_refusals=2, free_messages_per_day=free_per_day, payments_enabled=True, sample_photo_after=0)
    storage = Storage(":memory:")
    bot = CompanionBot(settings, ALEX, storage,
                       Brain(AsyncAnthropic(base_url=an.url, api_key="k", max_retries=0), settings.model, settings.effort))
    bot.photos = _make_library(tmp_path / "alex", ENTRIES, {"selfie", "oskar"})
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
        await wait_until(lambda: len(an.chat_requests()) == 1 and "hmm 😏" in tg.sent_texts())
        assert not [1 for m, _ in _seq(tg) if m == "sendPhoto"]  # v uvítání nikdy fotka
        modes = []
        for i, _ in enumerate(expected_modes):
            n_photos = len([1 for m, _ in _seq(tg) if m == "sendPhoto"])
            tg.text("pošli mi fotku")
            await wait_until(lambda i=i: len(an.chat_requests()) == 2 + i)
            await wait_until(lambda: storage.latest_user_message_id(555, "alex")
                             <= storage.get_user(555, "alex").last_answered_user_msg_id)
            last = an.chat_requests()[-1]["messages"][-1]
            sent = len([1 for m, _ in _seq(tg) if m == "sendPhoto"]) > n_photos
            if last == {"role": "system", "content": TEASE_TURN_NOTE}:
                modes.append("drahoty" + (" + FOTKA?!" if sent else ""))
            elif last == {"role": "system", "content": ASKED_TURN_NOTE}:
                modes.append("pošle" if sent else "pošle?!")
            else:
                modes.append("bez pokynu" + (" + FOTKA" if sent else ""))
        return modes
    finally:
        await application.updater.stop()
        await application.stop()
        await application.shutdown()
        tg.server.shutdown()
        an.server.shutdown()


def test_tease_twice_then_send(tmp_path):
    # dost zpráv zdarma: 2× drahoty, 3. žádost -> fotka, 4. (denní limit 1) -> bez pokynu, nic
    modes = asyncio.run(_tease_scenario(tmp_path, free_per_day=100, expected_modes=range(4)))
    assert modes == ["drahoty", "drahoty", "pošle", "bez pokynu"]


def test_photo_behaviour_does_not_depend_on_remaining_free_messages(tmp_path):
    # i když uživateli docházejí zprávy zdarma, chová se Tereza stejně (drahoty), nic se neuspěchá
    modes = asyncio.run(_tease_scenario(tmp_path, free_per_day=5, expected_modes=range(2)))
    assert modes == ["drahoty", "drahoty"]


def test_fake_photo_brackets_never_reach_user(tmp_path):
    lib = _make_library(tmp_path / "t", ENTRIES, {"selfie"})
    plan = plan_reply("no tak dobře 😄\n\n[Poslala jsi mu fotku: selfie z balkonu]\n\nstačí? [foto] 🙈", "Tereza", {})
    assert plan.photo is None
    assert [v for _, v in plan.parts] == ["no tak dobře 😄", "stačí?  🙈"]
    assert lib.get("selfie") is not None
