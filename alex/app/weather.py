"""Skutečné počasí a světlo venku, aby si postava nevymýšlela sluníčko, když je zataženo.

Počasí je z MET Norway (norský meteorologický ústav, api.met.no): zdarma i pro komerční použití,
bez klíče. Data jsou pod licencí CC BY 4.0, proto je v nápovědě bota uveden zdroj.
Jejich podmínky: v každém dotazu název aplikace a ideálně kontakt (WEATHER_CONTACT v .env)
a nestahovat znovu dřív, než vyprší platnost předpovědi (hlavička Expires).
Stahuje se nejvýš jednou za 20 minut a předpověď se drží v paměti, „teď“ se z ní vybírá při každé zprávě.
Když počasí nemáme, postava dostane pokyn, ať o něm nepíše nic konkrétního.
Východ a západ slunce se počítá lokálně (app/sun.py), takže funguje vždy.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

import httpx

from .persona import Place
from .sun import daylight_phrase, sun_altitude, sun_times

log = logging.getLogger(__name__)

MET_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
APP_NAME = "ai-pritel-alex/1.0"
REFRESH_SECONDS = 20 * 60  # nejvýš jednou za 20 minut (a stejně ne dřív, než vyprší Expires)
CHECK_SECONDS = 5 * 60  # jak často kontrolovat, jestli je čas stáhnout (po chybě se zkusí znovu za 5 minut)
BLOCKED_BACKOFF_SECONDS = 3600  # po 403/429 (odmítnutí, moc dotazů) zkusit až za hodinu
MAX_AGE_SECONDS = 6 * 3600  # starší předpověď už nepoužijeme (raději „počasí neznáš“ než špatné počasí)
TZ = ZoneInfo("Europe/Prague")

SYMBOL_TEXT = {
    "clearsky": "jasno", "fair": "skoro jasno", "partlycloudy": "polojasno", "cloudy": "zataženo", "fog": "mlha",
    "lightrain": "slabě prší", "rain": "prší", "heavyrain": "silně prší",
    "lightrainshowers": "slabé přeháňky", "rainshowers": "přeháňky", "heavyrainshowers": "silné přeháňky",
    "lightsleet": "slabý déšť se sněhem", "sleet": "déšť se sněhem", "heavysleet": "silný déšť se sněhem",
    "lightsleetshowers": "přeháňky deště se sněhem", "sleetshowers": "přeháňky deště se sněhem",
    "heavysleetshowers": "silné přeháňky deště se sněhem",
    "lightsnow": "slabě sněží", "snow": "sněží", "heavysnow": "hustě sněží",
    "lightsnowshowers": "slabé sněhové přeháňky", "snowshowers": "sněhové přeháňky",
    "heavysnowshowers": "silné sněhové přeháňky",
}
CLEAR_SYMBOLS = {"clearsky", "fair", "partlycloudy"}


def base_symbol(code: str | None) -> str:
    """„partlycloudy_day“ -> „partlycloudy“."""
    return (code or "").split("_")[0]


def _is_wet(symbol: str) -> bool:
    return "rain" in symbol or "sleet" in symbol


def symbol_text(symbol: str) -> str:
    if symbol in SYMBOL_TEXT:
        return SYMBOL_TEXT[symbol]
    if "thunder" in symbol:
        return "bouřka se sněžením" if "snow" in symbol and "sleet" not in symbol else "bouřka s deštěm"
    return "proměnlivo"


@dataclass(frozen=True)
class Weather:
    symbol: str  # MET symbol bez _day/_night, např. "partlycloudy"
    temperature: float
    cloud_cover: float
    precipitation: float  # mm v příští hodině
    t_min: float | None  # zbytek dne
    t_max: float | None
    later: str | None  # symbol na příštích 6 hodin
    fetched_at: float

    @property
    def text(self) -> str:
        return symbol_text(self.symbol)

    @property
    def raining(self) -> bool:
        return _is_wet(self.symbol) or (self.precipitation > 0.1 and "snow" not in self.symbol)

    @property
    def snowing(self) -> bool:
        return "snow" in self.symbol

    @property
    def clear(self) -> bool:
        """Jasno až polojasno: slunce (přes den) opravdu svítí."""
        return self.symbol in CLEAR_SYMBOLS and not self.raining

    @property
    def later_text(self) -> str | None:
        """Upozornění na déšť/sníh v příštích hodinách, když teď ještě nepadá."""
        if not self.later or self.raining or self.snowing:
            return None
        if _is_wet(self.later):
            return "v příštích hodinách má pršet"
        if "snow" in self.later:
            return "v příštích hodinách má sněžit"
        return None


@dataclass(frozen=True)
class Point:
    """Jeden hodinový (později šestihodinový) krok předpovědi."""

    ts: float
    temperature: float
    cloud_cover: float
    symbol: str  # na příští hodinu, nebo na příštích 6 hodin, kde hodinová chybí
    precipitation: float
    later: str | None


def _deg(t: float) -> str:
    return f"{round(t)} °C"


def parse_met(data: dict) -> list[Point]:
    points: list[Point] = []
    for item in data.get("properties", {}).get("timeseries", []):
        try:
            d = item["data"]
            details = d["instant"]["details"]
            n1, n6 = d.get("next_1_hours") or {}, d.get("next_6_hours") or {}
            symbol = base_symbol((n1.get("summary") or {}).get("symbol_code") or (n6.get("summary") or {}).get("symbol_code"))
            points.append(Point(
                ts=datetime.fromisoformat(item["time"].replace("Z", "+00:00")).timestamp(),
                temperature=float(details["air_temperature"]),
                cloud_cover=float(details.get("cloud_area_fraction") or 0.0),
                symbol=symbol,
                precipitation=float((n1.get("details") or {}).get("precipitation_amount") or 0.0),
                later=base_symbol((n6.get("summary") or {}).get("symbol_code")) or None,
            ))
        except (KeyError, TypeError, ValueError):
            continue
    return [p for p in points if p.symbol]


def weather_at(points: list[Point], now_ts: float, fetched_at: float) -> Weather | None:
    """Počasí „teď“ z uložené předpovědi."""
    past = [p for p in points if p.ts <= now_ts]
    current = past[-1] if past else (points[0] if points and points[0].ts - now_ts < 3600 else None)
    if current is None or now_ts - current.ts > 3 * 3600:
        return None
    today = datetime.fromtimestamp(now_ts, TZ).date()
    rest = [p.temperature for p in points if p.ts >= current.ts and datetime.fromtimestamp(p.ts, TZ).date() == today]
    return Weather(
        symbol=current.symbol,
        temperature=current.temperature,
        cloud_cover=current.cloud_cover,
        precipitation=current.precipitation,
        t_min=min(rest) if len(rest) > 1 else None,
        t_max=max(rest) if len(rest) > 1 else None,
        later=current.later,
        fetched_at=fetched_at,
    )


def _http_time(value: str | None) -> float:
    try:
        return parsedate_to_datetime(value).timestamp() if value else 0.0
    except (TypeError, ValueError):
        return 0.0


class WeatherService:
    def __init__(self, places: tuple[Place, ...], contact: str = "", url: str = MET_URL, timeout: float = 10.0):
        self.places = places
        self.url = url
        self.timeout = timeout
        self.user_agent = f"{APP_NAME} {contact}".strip()
        self._points: dict[str, list[Point]] = {}
        self._fetched: dict[str, float] = {}
        self._expires: dict[str, float] = {}
        self._last_modified: dict[str, str] = {}
        self._last_ok = 0.0
        self._retry_after = 0.0

    async def maybe_refresh(self, now_ts: float | None = None) -> bool:
        """Stáhne počasí, jen pokud je údaj starší než 20 minut a nečekáme po chybě."""
        now = now_ts or time.time()
        if now - self._last_ok < REFRESH_SECONDS or now < self._retry_after:
            return False
        return await self.refresh()

    async def refresh(self) -> bool:
        if not self.places:
            return False
        ok = False
        async with httpx.AsyncClient(timeout=self.timeout, headers={"User-Agent": self.user_agent}) as client:
            for place in self.places:
                now = time.time()
                if place.name in self._points and now < self._expires.get(place.name, 0):
                    ok = True  # předpověď je pořád platná, MET nechce, abychom se ptali dřív
                    continue
                headers = {}
                if place.name in self._last_modified:
                    headers["If-Modified-Since"] = self._last_modified[place.name]
                try:
                    resp = await client.get(self.url, params={"lat": f"{place.lat:.4f}", "lon": f"{place.lon:.4f}"},
                                            headers=headers)
                except httpx.HTTPError as e:
                    self._retry_after = now + CHECK_SECONDS
                    log.warning("Počasí (%s) se nepodařilo stáhnout: %s", place.name, e)
                    continue
                if resp.status_code in (403, 429):
                    self._retry_after = now + BLOCKED_BACKOFF_SECONDS
                    log.warning("Počasí: MET Norway odmítl dotaz (%s), další pokus za hodinu. "
                                "Pomůže doplnit kontakt do WEATHER_CONTACT v .env.", resp.status_code)
                    break
                if resp.status_code == 304:  # beze změny
                    self._fetched[place.name] = now
                elif resp.status_code == 200:
                    try:
                        points = parse_met(resp.json())
                    except ValueError:
                        points = []
                    if not points:
                        log.warning("Počasí (%s): nečitelná odpověď", place.name)
                        continue
                    self._points[place.name] = points
                    self._fetched[place.name] = now
                    if resp.headers.get("last-modified"):
                        self._last_modified[place.name] = resp.headers["last-modified"]
                else:
                    self._retry_after = now + CHECK_SECONDS
                    log.warning("Počasí (%s): neočekávaná odpověď %s", place.name, resp.status_code)
                    continue
                self._expires[place.name] = _http_time(resp.headers.get("expires"))
                ok = True
        if ok:
            self._last_ok = time.time()
            w = self.get(self.places[0].name)
            if w:
                log.info("Počasí %s: %s, %s", self.places[0].name, w.text, _deg(w.temperature))
        return ok

    def get(self, place_name: str, now_ts: float | None = None) -> Weather | None:
        now = now_ts or time.time()
        points, fetched = self._points.get(place_name), self._fetched.get(place_name, 0.0)
        if not points or now - fetched > MAX_AGE_SECONDS:
            return None
        return weather_at(points, now, fetched)


def _hm(dt: datetime) -> str:
    return f"{dt.hour}:{dt.minute:02d}"


def situation_lines(places: tuple[Place, ...], weather: WeatherService | None, now: datetime) -> list[str]:
    """Řádky do „Aktuální situace“: světlo venku a počasí."""
    if not places:
        return []
    home = places[0]
    tz_name = getattr(now.tzinfo, "key", "Europe/Prague")
    rise, sett = sun_times(now.date(), home.lat, home.lon, tz_name)
    altitude = sun_altitude(now, home.lat, home.lon)
    light = f"Světlo {home.locative}: "
    if rise and sett:
        light += f"slunce dnes vychází v {_hm(rise)} a zapadá v {_hm(sett)}, "
    lines = [light + f"teď {daylight_phrase(altitude, now)}."]

    known = False
    for i, place in enumerate(places):
        w = weather.get(place.name, now.timestamp()) if weather else None
        if w is None:
            continue
        known = True
        line = f"Počasí {place.locative} teď: {w.text}, {_deg(w.temperature)}"
        if w.t_min is not None and w.t_max is not None:
            line += f" (do konce dne od {_deg(w.t_min)} do {_deg(w.t_max)})"
        if i == 0 and altitude > 0:
            line += ". Slunce svítí" if w.clear else ". Slunce teď nesvítí"
        if w.later_text:
            line += f", {w.later_text}"
        lines.append(line + ".")
    if known:
        lines.append(
            "Tohle je jen pro tvou představu, jaké je venku, ne text pro ni. Když o počasí píšeš, musí to s tímhle "
            "souhlasit, ale piš to po svém (viz pravidla o počasí). Když jsi zrovna jinde než ve zmíněných místech, "
            "počasí tam neznáš."
        )
    else:
        lines.append(
            "Aktuální počasí neznáš, tak o něm nepiš nic konkrétního (sluníčko, déšť, sucho, sníh, teplota). "
            "Když se zeptá, přirozeně se vymluv, třeba že jsi ještě nebyl venku."
        )
    return lines


# --- fotky podle počasí -------------------------------------------------------------------

SEASONS = {"jaro": {3, 4, 5}, "leto": {6, 7, 8}, "podzim": {9, 10, 11}, "zima": {12, 1, 2}}
CONDITIONS = ("svetlo", "slunce", "dest", "zapad")


@dataclass(frozen=True)
class Conditions:
    altitude: float  # výška slunce nad obzorem (°)
    afternoon: bool
    month: int
    weather: Weather | None  # None = počasí neznáme

    def fits(self, need: str | None, seasons: tuple[str, ...] = ()) -> bool:
        """Hodí se teď fotka s podmínkou `need` a ročním obdobím `seasons`?"""
        if seasons and not any(self.month in SEASONS.get(s, set()) for s in seasons):
            return False
        w = self.weather
        wet = bool(w and (w.raining or w.snowing))
        if need == "svetlo":  # venku přes den, neprší
            return self.altitude > 2 and not wet
        if need == "slunce":  # svítí slunce (počasí musíme znát)
            return self.altitude > 5 and w is not None and w.clear
        if need == "dest":  # prší (počasí musíme znát)
            return w is not None and w.raining
        if need == "zapad":  # západ slunce na jasné obloze
            return self.afternoon and -4 < self.altitude < 8 and w is not None and w.clear
        return True


def conditions_for(places: tuple[Place, ...], weather: WeatherService | None, now: datetime) -> Conditions | None:
    if not places:
        return None
    home = places[0]
    return Conditions(
        altitude=sun_altitude(now, home.lat, home.lon),
        afternoon=now.hour >= 12,
        month=now.month,
        weather=weather.get(home.name, now.timestamp()) if weather else None,
    )
