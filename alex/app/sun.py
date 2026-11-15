"""Poloha slunce, východ a západ slunce. Počítá se lokálně, bez internetu (přesnost na pár minut)."""

from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

HORIZON = -0.833  # slunce „vyšlo“, když je horní okraj nad obzorem (včetně lomu světla)


def sun_altitude(when: datetime, lat: float, lon: float) -> float:
    """Výška slunce nad obzorem ve stupních (záporná = pod obzorem)."""
    n = when.astimezone(timezone.utc).timestamp() / 86400 + 2440587.5 - 2451545.0
    mean_lon = (280.460 + 0.9856474 * n) % 360
    anomaly = math.radians((357.528 + 0.9856003 * n) % 360)
    ecl_lon = math.radians(mean_lon + 1.915 * math.sin(anomaly) + 0.020 * math.sin(2 * anomaly))
    obliquity = math.radians(23.439 - 0.0000004 * n)
    ra = math.atan2(math.cos(obliquity) * math.sin(ecl_lon), math.cos(ecl_lon))
    dec = math.asin(math.sin(obliquity) * math.sin(ecl_lon))
    sidereal = math.radians(((18.697374558 + 24.06570982441908 * n) % 24) * 15 + lon)
    hour_angle = sidereal - ra
    phi = math.radians(lat)
    alt = math.asin(math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.cos(hour_angle))
    return math.degrees(alt)


@lru_cache(maxsize=64)
def sun_times(day: date, lat: float, lon: float, tz_name: str) -> tuple[datetime | None, datetime | None]:
    """Východ a západ slunce v daný den (místní čas). None = ten den nenastane."""
    tz = ZoneInfo(tz_name)
    start = datetime.combine(day, time(0, 0), tz)
    rise = sett = None
    prev = sun_altitude(start, lat, lon)
    for minute in range(1, 24 * 60 + 1):
        t = start + timedelta(minutes=minute)
        alt = sun_altitude(t, lat, lon)
        if prev < HORIZON <= alt and rise is None:
            rise = t
        elif prev >= HORIZON > alt and sett is None:
            sett = t
        prev = alt
    return rise, sett


def daylight_phrase(altitude: float, now: datetime) -> str:
    """Jak to teď venku vypadá se světlem (navazuje na „teď …“)."""
    if altitude < -6:
        return "je venku tma"
    if altitude < HORIZON:
        return "svítá" if now.hour < 12 else "se stmívá, slunce už zapadlo"
    if altitude < 10:
        return "je slunce jen nízko nad obzorem" + (" (krátce po východu)" if now.hour < 12 else " (brzy zapadne)")
    return "je den"
