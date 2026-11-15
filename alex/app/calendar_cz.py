"""Český kalendář: pracovní dny, státní svátky, školní prázdniny a blížící se významné dny.

Mozek z toho dostane řádky do „Aktuální situace“, aby v neděli nepsal z porady a věděl,
že se blíží Vánoce nebo Silvestr.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

WEEKDAYS = ("pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle")

# Státní svátky a dny pracovního klidu podle zákona č. 245/2000 Sb. (bez Velikonoc, ty se počítají)
FIXED_HOLIDAYS = {
    (1, 1): "Nový rok a Den obnovy samostatného českého státu",
    (5, 1): "Svátek práce",
    (5, 8): "Den vítězství",
    (7, 5): "Den slovanských věrozvěstů Cyrila a Metoděje",
    (7, 6): "Den upálení mistra Jana Husa",
    (9, 28): "Den české státnosti",
    (10, 28): "Den vzniku samostatného československého státu",
    (11, 17): "Den boje za svobodu a demokracii",
    (12, 24): "Štědrý den",
    (12, 25): "1. svátek vánoční",
    (12, 26): "2. svátek vánoční",
}


def easter_sunday(year: int) -> date:
    """Velikonoční neděle (anonymní gregoriánský algoritmus)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def public_holiday(day: date) -> str | None:
    """Název státního svátku, nebo None."""
    easter = easter_sunday(day.year)
    if day == easter - timedelta(days=2):
        return "Velký pátek"
    if day == easter + timedelta(days=1):
        return "Velikonoční pondělí"
    return FIXED_HOLIDAYS.get((day.month, day.day))


def is_workday(day: date) -> bool:
    """Pracovní den = pondělí až pátek, který není státním svátkem."""
    return day.weekday() < 5 and public_holiday(day) is None


def _school_year_end(year: int) -> date:
    """Poslední školní den (vysvědčení): 30. 6., připadne-li na víkend, tak pátek před ním."""
    d = date(year, 6, 30)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _school_year_start(year: int) -> date:
    """První školní den: 1. 9., připadne-li na víkend, tak pondělí po něm."""
    d = date(year, 9, 1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def school_holidays(day: date) -> str | None:
    """Letní nebo vánoční prázdniny (vánoční přibližně 23. 12. – 2. 1.; jarní a podzimní se liší podle roku)."""
    if _school_year_end(day.year) < day < _school_year_start(day.year):
        return "letní prázdniny"
    if (day.month == 12 and day.day >= 23) or (day.month == 1 and day.day <= 2):
        return "vánoční prázdniny"
    return None


@dataclass(frozen=True)
class NotableDay:
    day: date
    name: str
    lead_days: int  # kolik dní předem o něm ví („Blíží se…“); 0 = jen v ten den
    hint: str  # co ten den znamená, pro mozek


def _nth_sunday(year: int, month: int, n: int) -> date:
    first = date(year, month, 1)
    return first + timedelta(days=(6 - first.weekday()) % 7 + 7 * (n - 1))


def notable_days(year: int) -> list[NotableDay]:
    """Významné dny roku: svátky, na které se v Česku myslí, a dny důležité pro romantika a pro rodiče."""
    easter = easter_sunday(year)
    christmas_eve = date(year, 12, 24)
    first_advent = christmas_eve - timedelta(days=(christmas_eve.weekday() + 1) % 7 + 21)
    return [
        NotableDay(date(year, 1, 1), "Nový rok", 3, "Popřej jí všechno dobré do nového roku, klidně se zeptej na předsevzetí."),
        NotableDay(date(year, 2, 14), "Valentýn", 14,
                   "Svátek zamilovaných. Pro romantika jako ty důležitý den: dej jí slovy najevo, co pro tebe znamená, "
                   "ale bez kýče a přehánění."),
        NotableDay(date(year, 3, 8), "Mezinárodní den žen", 2, "Popřej jí, klidně s úsměvem."),
        NotableDay(easter - timedelta(days=2), "Velký pátek", 0, "Začínají Velikonoce a máš volno."),
        NotableDay(easter, "Velikonoce", 14, "Velikonoční neděle: sváteční oběd, beránek, mazanec, malovaná vajíčka."),
        NotableDay(easter + timedelta(days=1), "Velikonoční pondělí", 0,
                   "Pomlázka a koledování. Můžeš s ní o pomlázce žertovat, ale nic hrubého."),
        NotableDay(date(year, 4, 30), "pálení čarodějnic", 3, "Večer se pálí čarodějnice, oheň a buřty."),
        NotableDay(date(year, 5, 1), "první máj", 7, "Lásky čas, den zamilovaných po česku. Napiš jí něco romantického."),
        NotableDay(_nth_sunday(year, 5, 2), "Den matek", 5,
                   "Pokud má děti, popřej jí. Ema s Vojtou chystají přání pro svou mámu."),
        NotableDay(_nth_sunday(year, 6, 3), "Den otců", 3, "Děti ti možná něco nakreslí nebo zavolají."),
        NotableDay(_school_year_end(year), "konec školního roku", 5, "Ema dostává vysvědčení a začínají prázdniny."),
        NotableDay(_school_year_start(year), "začátek školního roku", 5,
                   "Prázdniny končí, děti jdou zase do školy, ráno shon a pomůcky."),
        NotableDay(date(year, 11, 2), "Dušičky", 0, "Památka zesnulých. Pokud na to přijde řeč, buď citlivý."),
        NotableDay(first_advent, "první adventní neděle", 5, "Začíná advent: první svíčka na adventním věnci, cukroví."),
        NotableDay(date(year, 12, 5), "Mikuláš", 5,
                   "Večer chodí Mikuláš s čertem a andělem. Pokud máš děti u sebe, Vojta se čerta bojí a Ema už ví, jak to je."),
        NotableDay(christmas_eve, "Štědrý den", 21,
                   "Stromeček, kapr, bramborový salát a dárky. Popřej jí krásné Vánoce."),
        NotableDay(date(year, 12, 25), "1. svátek vánoční", 0, "Vánoční klid, cukroví a pohádky."),
        NotableDay(date(year, 12, 26), "2. svátek vánoční", 0, "Vánoce pokračují, návštěvy u rodiny."),
        NotableDay(date(year, 12, 31), "Silvestr", 10, "Večer oslava a o půlnoci ohňostroj. Popřej jí šťastný nový rok."),
    ]


def _in_days(n: int) -> str:
    if n == 1:
        return "zítra"
    if 2 <= n <= 4:
        return f"za {n} dny"
    return f"za {n} dní"


def _day_off_reason(day: date) -> str:
    holiday = public_holiday(day)
    if holiday and day.weekday() >= 5:
        return f"{WEEKDAYS[day.weekday()]} a zároveň státní svátek ({holiday})"
    if holiday:
        return f"státní svátek ({holiday})"
    return WEEKDAYS[day.weekday()]


def calendar_lines(now: datetime, max_upcoming: int = 2) -> list[str]:
    """Řádky do „Aktuální situace“: volno nebo práce, dnešní a blížící se významné dny."""
    today = now.date()
    tomorrow = today + timedelta(days=1)
    if is_workday(today):
        lines = ["Dnes je pracovní den."]
        if not is_workday(tomorrow):
            lines.append(f"Zítra máš volno ({_day_off_reason(tomorrow)}).")
    else:
        lines = [f"Dnes je {_day_off_reason(today)}, máš volno: do práce nejdeš, žádná kancelář ani porady."]
    if today.month == 12 and 27 <= today.day <= 30:
        lines.append("Je čas mezi svátky: v práci je klid a půlka lidí má dovolenou.")

    days = notable_days(today.year) + notable_days(today.year + 1)
    for d in days:
        if d.day == today:
            lines.append(f"Dnes je {d.name}: {d.hint}")
    upcoming = sorted(
        (d for d in days if 0 < (d.day - today).days <= d.lead_days),
        key=lambda d: d.day,
    )[:max_upcoming]
    if upcoming:
        parts = [
            f"{d.name} {_in_days((d.day - today).days)} ({WEEKDAYS[d.day.weekday()]} {d.day.day}. {d.day.month}.)"
            for d in upcoming
        ]
        lines.append(f"Blíží se: {', '.join(parts)}. Zmiň to jen, když se to hodí do řeči, ne v každé zprávě.")
    return lines
