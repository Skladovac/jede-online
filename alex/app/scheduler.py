"""Rozhodování, kdy má postava napsat sám od sebe.

Pravidla jsou schválně opatrná, aby to nebyl spam:
- nikdy v noci (klidové hodiny postavy),
- maximálně jednou v každém časovém okně za den a ne každý den (náhoda),
- některá okna jen v týdnu s dětmi nebo jen bez nich,
- ne když spolu zrovna píšou nebo si nedávno psali,
- když nechá dvě jeho zprávy bez odpovědi, přestane psát, dokud se neozve ona,
- po týdnu ticha jí přestane psát úplně.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, time, timedelta

from .calendar_cz import is_workday
from .persona import MessageSlot, Persona, has_kids

MAX_UNANSWERED = 2
MIN_SILENCE_AFTER_USER = timedelta(minutes=90)
MIN_SILENCE_AFTER_ANY = timedelta(hours=2)
GIVE_UP_AFTER = timedelta(days=7)


@dataclass(frozen=True)
class ProactiveState:
    user_id: int
    adult: bool
    enabled: bool
    unanswered_proactive: int
    last_user_msg: datetime | None  # lokální čas (Europe/Prague)
    last_any_msg: datetime | None
    has_unanswered_user_msg: bool


def in_quiet_hours(p: Persona, t: time) -> bool:
    if p.quiet_start <= p.quiet_end:
        return p.quiet_start <= t < p.quiet_end
    return t >= p.quiet_start or t < p.quiet_end


def slot_plan(user_id: int, persona_key: str, day: str, slot: MessageSlot) -> tuple[bool, time]:
    """Deterministicky (pro daný den) určí, jestli v okně napíše a v kolik."""
    rng = random.Random(f"{user_id}:{persona_key}:{day}:{slot.name}")
    will_send = rng.random() < slot.chance
    start = datetime.combine(datetime(2000, 1, 1), slot.start)
    end = datetime.combine(datetime(2000, 1, 1), slot.end)
    span = max((end - start).total_seconds() - 15 * 60, 0)  # nechat rezervu na konci okna
    target = (start + timedelta(seconds=rng.random() * span)).time()
    return will_send, target


def pick_slot(
    p: Persona,
    state: ProactiveState,
    now: datetime,
    already_sent: set[str],
) -> MessageSlot | None:
    """Vrátí okno, ve kterém má teď napsat, nebo None."""
    if not (state.adult and state.enabled):
        return None
    if state.last_user_msg is None:  # nikdy nic nenapsal -> nevnucovat se
        return None
    if state.has_unanswered_user_msg:  # na jeho zprávu se teprve odpovídá
        return None
    if state.unanswered_proactive >= MAX_UNANSWERED:
        return None
    if now - state.last_user_msg > GIVE_UP_AFTER:
        return None
    if now - state.last_user_msg < MIN_SILENCE_AFTER_USER:
        return None
    if state.last_any_msg and now - state.last_any_msg < MIN_SILENCE_AFTER_ANY:
        return None
    if in_quiet_hours(p, now.time()):
        return None

    day = now.date().isoformat()
    kids = has_kids(p, now.date())
    workday = is_workday(now.date())
    for slot in p.slots:
        if slot.name in already_sent:
            continue
        if slot.kids is not None and slot.kids != kids:  # okno jen pro týden s dětmi / bez dětí
            continue
        if slot.workday is not None and slot.workday != workday:  # okno jen pro pracovní den / volno
            continue
        if not (slot.start <= now.time() < slot.end):
            continue
        will_send, target = slot_plan(state.user_id, p.key, day, slot)
        if will_send and now.time() >= target:
            return slot
    return None
