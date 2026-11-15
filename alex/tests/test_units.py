from dataclasses import replace
from datetime import datetime, time, timedelta

from app.brain import build_api_messages
from app.config import TIMEZONE
from app.persona import ALEX
from app.prompts import dynamic_context, humanize_delta, static_system_prompt
from app.scheduler import MAX_UNANSWERED, ProactiveState, in_quiet_hours, pick_slot, slot_plan
from app.storage import Message, Storage
from app.texting import reading_delay, split_bubbles, typing_delay


# --- texting --------------------------------------------------------------------------

def test_split_bubbles_basic_and_name_prefix():
    assert split_bubbles("Ahoj!\n\nJak se máš? 😊") == ["Ahoj!", "Jak se máš? 😊"]
    assert split_bubbles("Tereza: Ahoj\n\n  \n\nco děláš", "Tereza") == ["Ahoj", "co děláš"]
    assert split_bubbles("jedna\ndruhá řádka") == ["jedna\ndruhá řádka"]


def test_split_bubbles_caps_count():
    out = split_bubbles("a\n\nb\n\nc\n\nd\n\ne\n\nf")
    assert len(out) == 4 and out[-1] == "d\ne\nf"


def test_typing_delay_bounds():
    # před vynásobením DELAY_MULTIPLIER 1,5: 7,5 znaku/s = asi 5 znaků/s, strop 16 s = 24 s
    assert typing_delay("ok") == 1.0
    assert typing_delay("x" * 75) == 10.0
    assert typing_delay("x" * 1000) == 16.0


def test_reading_delay_bounds():
    assert reading_delay("") == 0.0
    assert reading_delay("x" * 40) == 1.0
    assert reading_delay("x" * 1000) == 4.0


# --- prompts --------------------------------------------------------------------------

def test_static_prompt_is_stable_and_contains_rules():
    a, b = static_system_prompt(ALEX), static_system_prompt(ALEX)
    assert a == b  # musí být byte-identický kvůli cache
    assert "116 123" in a and "AI" in a and "Letn" in a and "ženském rodě" in a


def test_dynamic_context_czech_plurals_and_facts():
    now = datetime(2026, 11, 13, 21, 5, tzinfo=TIMEZONE)
    ctx = dynamic_context(now, "Tomáš", 3, 2, ["Má psa Maxe"], 7200, task="Napiš dobrou noc")
    assert "pátek 13. 11. 2026, 21:05" in ctx
    assert "3 dny" in ctx and "2 zprávy" in ctx and "2 hodiny" in ctx
    assert "- Má psa Maxe" in ctx and "# Úkol" in ctx
    assert humanize_delta(30) == "pár sekund"
    assert humanize_delta(60 * 5) == "5 minut"
    assert humanize_delta(3600 * 50) == "2 dny"


# --- převod historie do API ------------------------------------------------------------

def _m(i, role, text):
    return Message(id=i, role=role, content=text, kind="chat", created_at=0)


def test_build_messages_merges_and_starts_with_user():
    hist = [_m(1, "assistant", "Ahoj, já jsem Tereza"), _m(2, "user", "ahoj"), _m(3, "user", "jak je?")]
    msgs = build_api_messages(hist)
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    assert [b["text"] for b in msgs[2]["content"]] == ["ahoj", "jak je?"]


def test_build_messages_image_and_trailing_note():
    hist = [_m(1, "user", "[Poslala ti fotku]"), _m(2, "assistant", "hezký!")]
    msgs = build_api_messages(hist, images={1: b"\xff\xd8jpeg"}, trailing_user_note="[poznámka]")
    assert msgs[0]["content"][0]["type"] == "image"
    assert msgs[0]["content"][0]["source"]["media_type"] == "image/jpeg"
    assert msgs[-1] == {"role": "user", "content": [{"type": "text", "text": "[poznámka]"}]}


def test_build_messages_empty_history_with_note():
    assert build_api_messages([], trailing_user_note="x") == [{"role": "user", "content": [{"type": "text", "text": "x"}]}]


# --- storage --------------------------------------------------------------------------

def test_storage_roundtrip_and_delete():
    s = Storage(":memory:")
    u = s.get_or_create_user(1, "alex", 100, "Tomáš")
    assert u.age_status == "unknown" and u.facts == [] and u.proactive_enabled
    s.update_user(1, "alex", facts=["Má psa Maxe"], proactive_enabled=False, age_status="adult")
    u = s.get_user(1, "alex")
    assert u.facts == ["Má psa Maxe"] and not u.proactive_enabled and u.age_status == "adult"
    a = s.add_message(1, "alex", "user", "ahoj")
    s.add_message(1, "alex", "assistant", "čau")
    assert s.latest_user_message_id(1, "alex") == a
    assert [m.content for m in s.recent_messages(1, "alex", 1)] == ["čau"]
    s.mark_proactive(1, "alex", "2026-11-13", "morning")
    assert s.proactive_sent(1, "alex", "2026-11-13", "morning")
    s.delete_user(1, "alex")
    assert s.get_user(1, "alex") is None and s.count_messages(1, "alex") == 0


# --- plánování zpráv sama od sebe ----------------------------------------------------------

ALWAYS = replace(ALEX, slots=tuple(replace(s, chance=1.0) for s in ALEX.slots))


def _state(now, **kw):
    base = dict(
        user_id=42, adult=True, enabled=True, unanswered_proactive=0,
        last_user_msg=now - timedelta(hours=10), last_any_msg=now - timedelta(hours=10),
        has_unanswered_user_msg=False,
    )
    base.update(kw)
    return ProactiveState(**base)


def test_quiet_hours():
    assert in_quiet_hours(ALEX, time(23, 30)) and in_quiet_hours(ALEX, time(3, 0))
    assert not in_quiet_hours(ALEX, time(7, 0)) and not in_quiet_hours(ALEX, time(22, 59))


def test_pick_slot_morning_after_target_time():
    day = datetime(2026, 11, 13, tzinfo=TIMEZONE)
    _, target = slot_plan(42, "alex", "2026-11-13", ALWAYS.slots[0])
    now = day.replace(hour=target.hour, minute=target.minute) + timedelta(minutes=1)
    assert pick_slot(ALWAYS, _state(now), now, set()).name == "morning"
    assert pick_slot(ALWAYS, _state(now), now, {"morning"}) is None  # už dnes poslala


def test_pick_slot_blocking_rules():
    now = datetime(2026, 11, 13, 8, 29, tzinfo=TIMEZONE)  # konec ranního okna, po cíli
    ok = _state(now)
    assert pick_slot(ALWAYS, ok, now, set()) is not None
    assert pick_slot(ALWAYS, replace(ok, adult=False), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, enabled=False), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, last_user_msg=None), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, has_unanswered_user_msg=True), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, unanswered_proactive=MAX_UNANSWERED), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, last_user_msg=now - timedelta(minutes=30)), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, last_any_msg=now - timedelta(minutes=60)), now, set()) is None
    assert pick_slot(ALWAYS, replace(ok, last_user_msg=now - timedelta(days=8)), now, set()) is None
    afternoon = now.replace(hour=15)
    assert pick_slot(ALWAYS, _state(afternoon), afternoon, set()) is None  # mimo okna


def test_slot_plan_is_deterministic_and_chance_varies_by_day():
    a = slot_plan(1, "alex", "2026-11-13", ALEX.slots[0])
    assert a == slot_plan(1, "alex", "2026-11-13", ALEX.slots[0])
    days = [slot_plan(1, "alex", f"2026-11-{d:02d}", ALEX.slots[0])[0] for d in range(1, 31)]
    assert 0 < sum(days) < 30  # ne každý den


# --- realistické zpoždění -------------------------------------------------------------------

class _NoJitter:
    def uniform(self, a, b):
        return 1.0


def _typing_bot(monkeypatch, slept, actions):
    import app.telegram_bot as tb
    from app.config import Settings

    async def fake_sleep(s):
        slept.append(s)

    class FakeBot:
        async def send_chat_action(self, chat_id, action):
            actions.append(action)

        async def send_message(self, chat_id, text):
            actions.append(("msg", text))

    monkeypatch.setattr(tb.asyncio, "sleep", fake_sleep)
    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:",
                        reply_debounce_seconds=4, typing_simulation=True, delay_multiplier=1.5)
    st = Storage(":memory:")
    st.get_or_create_user(1, "alex", 1, "U")
    bot = tb.CompanionBot(settings, ALEX, st, brain=None)
    bot._rng = _NoJitter()
    return bot, FakeBot(), st.get_user(1, "alex")


def test_typing_pause_keeps_indicator_alive_and_respects_multiplier(monkeypatch):
    import asyncio

    import app.telegram_bot as tb

    slept, actions = [], []
    bot, fake, user = _typing_bot(monkeypatch, slept, actions)
    long_text = "x" * 200  # typing_delay = 16 s (strop) -> × 1,5 = 24 s
    now = datetime(2026, 11, 18, 12, 0, tzinfo=TIMEZONE)
    asyncio.run(bot._deliver(fake, user, "ahoj\n\n" + long_text, "proactive", now, photo_mode="off"))
    assert abs(sum(slept) - (1.0 * 1.5 + 24.0)) < 1e-9  # sám od sebe: celé psaní, nic se neodečítá
    assert max(slept) <= tb.TYPING_REFRESH_SECONDS  # „píše…“ se obnovuje aspoň každé 4 s
    assert actions.count("typing") == 1 + 6
    assert actions[-1] == ("msg", long_text)


def test_first_reply_bubble_counts_time_already_waited(monkeypatch):
    import asyncio
    import time as clock

    now = datetime(2026, 11, 18, 12, 0, tzinfo=TIMEZONE)
    text = "x" * 75  # 10 s × 1,5 = 15 s psaní
    question = "y" * 40  # 1 s × 1,5 = 1,5 s čtení
    slept, actions = [], []
    bot, fake, user = _typing_bot(monkeypatch, slept, actions)
    asyncio.run(bot._deliver(fake, user, text, "chat", now, photo_mode="off",
                             read_text=question, started=clock.monotonic() - 10))
    assert abs(sum(slept) - (15.0 + 1.5 - 10)) < 0.5  # 10 s už uběhlo (čekání na další zprávy a model)

    slept.clear()
    bot, fake, user = _typing_bot(monkeypatch, slept, actions)
    asyncio.run(bot._deliver(fake, user, text, "chat", now, photo_mode="off",
                             read_text=question, started=clock.monotonic() - 60))
    assert abs(sum(slept) - 1.5) < 1e-9  # i po dlouhém přemýšlení aspoň chvilku „píše…“


# --- platby ---------------------------------------------------------------------------------

def test_payments_premium_until_survives_forget_and_refund():
    import time as _t
    s = Storage(":memory:")
    s.get_or_create_user(1, "alex", 1, "T")
    assert s.premium_until(1, "alex") == 0
    exp = _t.time() + 3600
    s.add_payment("ch1", 1, "alex", 300, "XTR", exp, True)
    assert s.premium_until(1, "alex") == exp
    s.delete_user(1, "alex")  # /zapomen nesmí zrušit předplatné
    assert s.premium_until(1, "alex") == exp
    s.mark_refunded("ch1")
    assert s.premium_until(1, "alex") == 0
    a = s.add_message(1, "alex", "user", "x", created_at=100.0)
    s.add_message(1, "alex", "user", "y", created_at=200.0)
    s.add_message(1, "alex", "assistant", "z", created_at=300.0)
    assert a and s.count_user_messages_since(1, "alex", 150.0) == 1


def test_admin_has_unlimited_messages():
    from app.config import Settings
    from app.telegram_bot import CompanionBot

    st = Storage(":memory:")
    base = dict(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                typing_simulation=False, free_messages_per_day=1, payments_enabled=True)
    for uid in (1, 2):
        st.get_or_create_user(uid, "alex", uid, "U")
        st.add_message(uid, "alex", "user", "ahoj")  # limit 1 vyčerpán
    bot = CompanionBot(Settings(**base, admin_user_ids=(1,)), ALEX, st, brain=None)
    assert bot._has_quota(st.get_user(1, "alex"))  # správce
    assert not bot._has_quota(st.get_user(2, "alex"))  # běžný uživatel
