"""Český kalendář: víkendy, státní svátky a blížící se významné dny (Vánoce, Silvestr, Valentýn…)."""

from datetime import date, datetime, timedelta

from app.calendar_cz import calendar_lines, easter_sunday, is_workday, public_holiday, school_holidays
from app.config import TIMEZONE


def _at(y, m, d, h=12):
    return datetime(y, m, d, h, 0, tzinfo=TIMEZONE)


def test_easter_sunday():
    assert easter_sunday(2025) == date(2025, 4, 20)
    assert easter_sunday(2026) == date(2026, 4, 5)
    assert easter_sunday(2027) == date(2027, 3, 28)
    assert easter_sunday(2028) == date(2028, 4, 16)


def test_public_holidays():
    assert "svobodu a demokracii" in public_holiday(date(2026, 11, 17))
    assert public_holiday(date(2026, 4, 3)) == "Velký pátek"
    assert public_holiday(date(2026, 4, 6)) == "Velikonoční pondělí"
    assert public_holiday(date(2026, 12, 24)) == "Štědrý den"
    assert public_holiday(date(2026, 11, 18)) is None
    assert public_holiday(date(2026, 4, 5)) is None  # Velikonoční neděle sama svátkem není


def test_workdays():
    assert not is_workday(date(2026, 11, 14))  # sobota
    assert not is_workday(date(2026, 11, 15))  # neděle
    assert is_workday(date(2026, 11, 16))
    assert not is_workday(date(2026, 11, 17))  # státní svátek v úterý
    assert is_workday(date(2026, 11, 18))


def test_day_off_is_said_out_loud():
    sunday = " ".join(calendar_lines(_at(2026, 11, 15)))
    assert "neděle" in sunday and "máš volno" in sunday and "do práce nejdeš" in sunday
    holiday = " ".join(calendar_lines(_at(2026, 11, 17)))
    assert "státní svátek" in holiday and "svobodu a demokracii" in holiday and "máš volno" in holiday
    workday = " ".join(calendar_lines(_at(2026, 11, 18)))
    assert "pracovní den" in workday and "volno" not in workday


def test_tomorrow_off():
    assert "Zítra máš volno" in " ".join(calendar_lines(_at(2026, 11, 20)))  # pátek
    before_holiday = " ".join(calendar_lines(_at(2026, 11, 16)))  # pondělí před svátkem
    assert "Zítra máš volno" in before_holiday and "svobodu a demokracii" in before_holiday
    assert "Zítra" not in " ".join(calendar_lines(_at(2026, 11, 18)))


def test_upcoming_christmas_and_new_year():
    dec15 = " ".join(calendar_lines(_at(2026, 12, 15)))
    assert "Blíží se" in dec15 and "Štědrý den za 9 dní (čtvrtek 24. 12.)" in dec15
    dec28 = " ".join(calendar_lines(_at(2026, 12, 28)))
    assert "Silvestr za 3 dny" in dec28 and "mezi svátky" in dec28
    assert "Dnes je Štědrý den" in " ".join(calendar_lines(_at(2026, 12, 24)))
    assert "Dnes je Silvestr" in " ".join(calendar_lines(_at(2026, 12, 31)))
    assert "Nový rok zítra" in " ".join(calendar_lines(_at(2026, 12, 31)))  # přes přelom roku


def test_upcoming_valentine_and_easter():
    assert "Valentýn za 13 dní" in " ".join(calendar_lines(_at(2027, 2, 1)))
    assert "Dnes je Valentýn" in " ".join(calendar_lines(_at(2027, 2, 14)))
    assert "Velikonoce" in " ".join(calendar_lines(_at(2027, 3, 20)))  # Velikonoční neděle 28. 3. 2027


def test_quiet_days_have_no_upcoming_line():
    assert not any("Blíží se" in x for x in calendar_lines(_at(2026, 8, 12)))


def test_school_holidays():
    assert school_holidays(date(2027, 7, 15)) == "letní prázdniny"
    assert school_holidays(date(2026, 12, 28)) == "vánoční prázdniny"
    assert school_holidays(date(2027, 1, 1)) == "vánoční prázdniny"
    assert school_holidays(date(2026, 11, 18)) is None
    assert school_holidays(date(2027, 9, 1)) is None  # 1. 9. 2027 je středa, začíná škola
    # 1. 9. 2029 je sobota: škola začíná až v pondělí 3. 9.
    assert school_holidays(date(2029, 8, 31)) == "letní prázdniny"
    assert school_holidays(date(2029, 9, 3)) is None
    days = [date(2027, 6, 1) + timedelta(days=i) for i in range(120)]
    assert any(school_holidays(d) for d in days) and not all(school_holidays(d) for d in days)
