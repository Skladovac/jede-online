"""Co je u Alexe jinak než u Terezy: týdny s dětmi, častější psaní, ženský rod a zkušební provoz zdarma."""

from dataclasses import replace
from datetime import date, datetime, timedelta

from app.config import TIMEZONE, Settings
from app.persona import ALEX, family_lines, has_kids
from app.prompts import dynamic_context, static_system_prompt
from app.scheduler import ProactiveState, pick_slot, slot_plan
from app.storage import Storage
from app.telegram_bot import CompanionBot

ALWAYS = replace(ALEX, slots=tuple(replace(s, chance=1.0) for s in ALEX.slots))


def _state(now):
    return ProactiveState(
        user_id=7, adult=True, enabled=True, unanswered_proactive=0,
        last_user_msg=now - timedelta(hours=10), last_any_msg=now - timedelta(hours=10),
        has_unanswered_user_msg=False,
    )


def _at_slot(day: date, slot_name: str) -> datetime:
    slot = next(s for s in ALWAYS.slots if s.name == slot_name)
    _, target = slot_plan(7, "alex", day.isoformat(), slot)
    return datetime.combine(day, target, TIMEZONE) + timedelta(minutes=1)


# --- týdny s dětmi -----------------------------------------------------------------------

def test_kids_weeks_alternate_monday_to_sunday():
    assert has_kids(ALEX, date(2026, 11, 9)) and has_kids(ALEX, date(2026, 11, 15))  # po–ne s dětmi
    assert not has_kids(ALEX, date(2026, 11, 16)) and not has_kids(ALEX, date(2026, 11, 22))
    assert has_kids(ALEX, date(2026, 11, 23))
    weeks = [has_kids(ALEX, date(2026, 11, 9) + timedelta(weeks=i)) for i in range(60)]
    assert all(a != b for a, b in zip(weeks, weeks[1:])), "týdny se musí vždy střídat"


def test_kids_weeks_alternate_across_53_week_year():
    # rok 2026 má 53 týdnů: podle čísla týdne by byly 53. a 1. týden oba „liché“
    assert has_kids(ALEX, date(2026, 12, 28)) != has_kids(ALEX, date(2027, 1, 4))


def test_family_lines_and_handover_days():
    kids_mon = datetime(2026, 11, 23, 9, 0, tzinfo=TIMEZONE)
    free_mon = datetime(2026, 11, 16, 9, 0, tzinfo=TIMEZONE)
    kids_sun = datetime(2026, 11, 29, 9, 0, tzinfo=TIMEZONE)
    free_wed = datetime(2026, 11, 18, 9, 0, tzinfo=TIMEZONE)
    assert "máš děti u sebe" in family_lines(ALEX, kids_mon)[0]
    assert "vyzvedáváš" in family_lines(ALEX, kids_mon)[1]
    assert "děti u mámy" in family_lines(ALEX, free_mon)[0]
    assert "bere máma" in family_lines(ALEX, free_mon)[1]
    assert "Zítra děti předáváš mámě" in family_lines(ALEX, kids_sun)[1]
    assert len(family_lines(ALEX, free_wed)) == 1
    assert family_lines(replace(ALEX, kids_epoch=None), free_wed) == []


def test_week_with_kids_has_late_evening_slot_only():
    kids_tue, free_tue = date(2026, 11, 24), date(2026, 11, 17)
    now = _at_slot(kids_tue, "evening_kids")
    assert pick_slot(ALWAYS, _state(now), now, set()).name == "evening_kids"
    now = _at_slot(free_tue, "evening")
    assert pick_slot(ALWAYS, _state(now), now, set()).name == "evening"
    now = _at_slot(kids_tue, "afternoon")
    assert pick_slot(ALWAYS, _state(now), now, set()) is None  # podvečer po běhu jen bez dětí
    now = _at_slot(free_tue, "afternoon")
    assert pick_slot(ALWAYS, _state(now), now, set()).name == "afternoon"


def test_writes_more_often_than_tereza():
    for day in (date(2026, 11, 17), date(2026, 11, 24)):  # bez dětí i s dětmi
        names = {s.name for s in ALEX.slots if s.kids is None or s.kids == has_kids(ALEX, day)}
        assert len(names) >= 3 and "midday" in names


def test_midday_slot():
    now = _at_slot(date(2026, 11, 24), "midday")
    assert pick_slot(ALWAYS, _state(now), now, set()).name == "midday"


# --- postava a ženský rod ----------------------------------------------------------------------

def test_prompt_is_male_persona_talking_to_woman():
    a = static_system_prompt(ALEX)
    assert "Jsi Alex, je ti 45 let" in a and "Ema" in a and "Vojt" in a and "186 cm" in a
    assert "uživatelkou" in a and "Explicitní sexuální obsah nepíšeš" in a
    assert "Nejsi přikyvovač" in a
    d = dynamic_context(datetime(2026, 11, 17, 9, 0, tzinfo=TIMEZONE), "Jana", 0, 0, [], None)
    assert "Jméno z jejího profilu: Jana" in d and "Co si o ní pamatuješ" in d


def test_dynamic_context_contains_week_info():
    st = Storage(":memory:")
    user = st.get_or_create_user(1, "alex", 1, "Jana")
    bot = CompanionBot(_settings(), ALEX, st, brain=None)
    assert "máš děti u sebe" in bot._dynamic(user, datetime(2026, 11, 24, 9, 0, tzinfo=TIMEZONE))
    assert "děti u mámy" in bot._dynamic(user, datetime(2026, 11, 17, 9, 0, tzinfo=TIMEZONE))


# --- zkušební provoz zdarma ------------------------------------------------------------------

def _settings(**kw):
    base = dict(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                typing_simulation=False, free_messages_per_day=1)
    base.update(kw)
    return Settings(**base)


def test_free_trial_has_no_message_limit():
    st = Storage(":memory:")
    st.get_or_create_user(2, "alex", 2, "U")
    for _ in range(5):
        st.add_message(2, "alex", "user", "ahoj")  # limit 1 by byl dávno vyčerpaný
    assert CompanionBot(_settings(), ALEX, st, brain=None)._has_quota(st.get_user(2, "alex"))
    assert not CompanionBot(_settings(payments_enabled=True), ALEX, st, brain=None)._has_quota(st.get_user(2, "alex"))


def test_payments_disabled_by_default(monkeypatch):
    from app.config import load_settings

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "1:x")
    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "k")
    monkeypatch.delenv("PAYMENTS_ENABLED", raising=False)
    assert load_settings().payments_enabled is False
    monkeypatch.setenv("PAYMENTS_ENABLED", "1")
    assert load_settings().payments_enabled is True
