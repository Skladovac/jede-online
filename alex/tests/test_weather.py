"""Skutečné počasí a světlo: výpočet slunce, stažení počasí z MET Norway, kontext pro model a výběr fotek."""

import asyncio
import json
import time
from datetime import date, datetime, timezone
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from app.config import TIMEZONE, Settings
from app.persona import ALEX, Place
from app.storage import Storage
from app.sun import sun_altitude, sun_times
from app.telegram_bot import CompanionBot
from app.weather import Conditions, Weather, WeatherService, parse_met, situation_lines, weather_at
from tests.test_end_to_end import _serve
from tests.test_photos import _make_library

# Obecné testy počasí běží na dvou místech (domov + kam jezdí), Alex sám má jen Prahu.
PLACES = (Place("Brno", "v Brně", 49.1951, 16.6068), Place("Žilina", "v Žilině", 49.2231, 18.7394))


def _w(symbol: str, temp: float = 5.0, precipitation: float = 0.0, later: str | None = None) -> Weather:
    return Weather(symbol=symbol, temperature=temp, cloud_cover=0, precipitation=precipitation,
                   t_min=-1.0, t_max=7.0, later=later, fetched_at=time.time())


class FixedWeather(WeatherService):
    """Počasí bez internetu: stejné pro všechna místa."""

    def __init__(self, weather: Weather | None):
        super().__init__(PLACES)
        self.weather = weather

    def get(self, place_name, now_ts=None):
        return self.weather


def _met(symbol: str, temps: list[float], start_ts: float, later: str = "partlycloudy_day") -> dict:
    """Odpověď ve tvaru MET Norway locationforecast/2.0/compact (hodinové kroky)."""
    series = []
    for i, t in enumerate(temps):
        ts = datetime.fromtimestamp(start_ts + i * 3600, timezone.utc).strftime("%Y-%m-%dT%H:00:00Z")
        series.append({"time": ts, "data": {
            "instant": {"details": {"air_temperature": t, "cloud_area_fraction": 5.0}},
            "next_1_hours": {"summary": {"symbol_code": symbol}, "details": {"precipitation_amount": 0.0}},
            "next_6_hours": {"summary": {"symbol_code": later}, "details": {"precipitation_amount": 0.0}},
        }})
    series.append({"time": "2099-01-01T00:00:00Z", "data": {"instant": {"details": {"air_temperature": 1.0}}}})
    return {"type": "Feature", "properties": {"meta": {}, "timeseries": series}}


def _hour_start(ts: float) -> float:
    return ts - ts % 3600


# --- slunce -----------------------------------------------------------------------------

def test_sun_times_brno_match_reality():
    rise, sett = sun_times(date(2026, 11, 14), 49.1951, 16.6068, "Europe/Prague")
    # meteorologické služby pro ten den uvádí 7:01 a 16:13
    assert (rise.hour, abs(rise.minute - 1) <= 3) == (7, True)
    assert (sett.hour, abs(sett.minute - 13) <= 3) == (16, True)
    assert sun_altitude(datetime(2026, 11, 14, 3, 0, tzinfo=TIMEZONE), 49.1951, 16.6068) < -30
    assert 5 < sun_altitude(datetime(2026, 11, 14, 7, 59, tzinfo=TIMEZONE), 49.1951, 16.6068) < 9


# --- převod předpovědi ------------------------------------------------------------------

def test_parse_met_and_weather_now():
    # sobota 14. 11. 2026 8:00 našeho času = 7:00 UTC
    start = datetime(2026, 11, 14, 7, 0, tzinfo=timezone.utc).timestamp()
    points = parse_met(_met("clearsky_day", [0.8, 2.9, 4.5, 6.2, 5.0], start, later="lightrain"))
    assert len(points) == 5  # poslední krok bez symbolu se vynechá
    w = weather_at(points, start + 1800, fetched_at=start)  # 8:30
    assert w.symbol == "clearsky" and w.text == "jasno" and w.clear and not w.raining
    assert w.temperature == 0.8 and (w.t_min, w.t_max) == (0.8, 6.2)
    assert w.later_text == "v příštích hodinách má pršet"
    assert weather_at(points, start + 3 * 3600 + 60, start).temperature == 6.2  # o 3 hodiny později
    assert weather_at(points, start + 10 * 3600, start) is None  # předpověď už nepokrývá
    rain = weather_at(parse_met(_met("rainshowers_day", [3.0, 3.0], start)), start, start)
    assert rain.raining and not rain.clear and rain.text == "přeháňky" and rain.later_text is None
    snow = weather_at(parse_met(_met("heavysnow", [-3.0, -3.0], start)), start, start)
    assert snow.snowing and not snow.raining and snow.text == "hustě sněží"
    storm = weather_at(parse_met(_met("rainandthunder", [15.0, 15.0], start)), start, start)
    assert storm.raining and storm.text == "bouřka s deštěm"
    assert parse_met({"nesmysl": 1}) == []


def test_weather_service_respects_met_rules():
    state = {"status": 200, "expires_in": 1800, "requests": []}

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            q = parse_qs(urlparse(self.path).query)
            state["requests"].append((q, dict(self.headers)))
            symbol = "clearsky_day" if q["lat"] == ["49.1951"] else "cloudy"
            body = json.dumps(_met(symbol, [0.5, 2.0, 4.0], _hour_start(time.time()))).encode()
            status = state["status"]
            self.send_response(status)
            self.send_header("Expires", formatdate(time.time() + state["expires_in"], usegmt=True))
            self.send_header("Last-Modified", "Sat, 14 Nov 2026 06:49:16 GMT")
            if status == 200:
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_header("Content-Length", "0")
                self.end_headers()

    server, url = _serve(H)
    try:
        svc = WeatherService(PLACES, contact="test@example.com", url=url)
        assert svc.get("Brno") is None
        assert asyncio.run(svc.refresh()) is True
        q, headers = state["requests"][0]
        assert q == {"lat": ["49.1951"], "lon": ["16.6068"]}
        assert headers["User-Agent"] == "ai-pritel-alex/1.0 test@example.com"
        assert svc.get("Brno").text == "jasno" and svc.get("Žilina").text == "zataženo"
        assert svc.get("Brno", time.time() + 7 * 3600) is None  # stará předpověď se nepoužije

        # předpověď je ještě platná (Expires) -> MET se znovu neptáme
        n = len(state["requests"])
        assert asyncio.run(svc.refresh()) is True and len(state["requests"]) == n
        assert asyncio.run(svc.maybe_refresh()) is False  # a za 20 minut to ani nezkouší

        # platnost vypršela -> ptáme se s If-Modified-Since, 304 = beze změny, data zůstávají
        svc._expires = {k: 0 for k in svc._expires}
        state["status"] = 304
        assert asyncio.run(svc.refresh()) is True
        assert state["requests"][-1][1]["If-Modified-Since"] == "Sat, 14 Nov 2026 06:49:16 GMT"
        assert svc.get("Brno").text == "jasno"

        # chyba serveru -> zkusí znovu za 5 minut, poslední data zůstávají
        svc._expires = {k: 0 for k in svc._expires}
        state["status"] = 500
        assert asyncio.run(svc.refresh()) is False
        assert svc.get("Brno").text == "jasno"

        # odmítnutí (403/429): další pokus až za hodinu a bez kontaktu jen název aplikace
        svc2 = WeatherService(PLACES, url=url)
        state["status"] = 403
        assert asyncio.run(svc2.maybe_refresh()) is False
        assert state["requests"][-1][1]["User-Agent"] == "ai-pritel-alex/1.0"
        state["status"] = 200
        assert asyncio.run(svc2.maybe_refresh()) is False  # ještě čeká
        assert asyncio.run(svc2.maybe_refresh(time.time() + 3601)) is True
    finally:
        server.shutdown()


# --- kontext pro model ------------------------------------------------------------------

def test_situation_lines_sunny_morning():
    now = datetime(2026, 11, 14, 7, 59, tzinfo=TIMEZONE)
    text = "\n".join(situation_lines(PLACES, FixedWeather(_w("clearsky", -0.4)), now))
    assert "slunce dnes vychází v 7:0" in text and "zapadá v 16:1" in text
    assert "teď je slunce jen nízko nad obzorem" in text
    assert "Počasí v Brně teď: jasno, 0 °C (do konce dne od -1 °C do 7 °C). Slunce svítí." in text
    assert "Počasí v Žilině teď" in text
    assert "jen pro tvou představu" in text


def test_situation_lines_cloudy_night_rain_later_and_unknown():
    noon = datetime(2026, 11, 14, 12, 0, tzinfo=TIMEZONE)
    cloudy_day = "\n".join(situation_lines(PLACES, FixedWeather(_w("cloudy", later="rain")), noon))
    assert "zataženo" in cloudy_day and "Slunce teď nesvítí, v příštích hodinách má pršet." in cloudy_day
    night = "\n".join(situation_lines(PLACES, FixedWeather(_w("clearsky")), datetime(2026, 11, 14, 22, 0, tzinfo=TIMEZONE)))
    assert "teď je venku tma" in night and "Slunce" not in night
    unknown = "\n".join(situation_lines(PLACES, None, noon))
    assert "Aktuální počasí neznáš" in unknown and "Počasí v Brně" not in unknown
    assert situation_lines((), None, datetime.now(TIMEZONE)) == []


# --- fotky podle počasí -----------------------------------------------------------------

def test_conditions_fit():
    day, night = 20.0, -30.0
    sunny = Conditions(day, False, 11, _w("clearsky"))
    rainy = Conditions(day, False, 11, _w("rain"))
    unknown = Conditions(day, False, 11, None)
    assert sunny.fits(None) and sunny.fits("svetlo") and sunny.fits("slunce") and not sunny.fits("dest")
    assert rainy.fits("dest") and not rainy.fits("svetlo") and not rainy.fits("slunce")
    assert unknown.fits("svetlo") and not unknown.fits("slunce") and not unknown.fits("dest")
    assert not Conditions(night, False, 11, _w("clearsky")).fits("svetlo")
    assert Conditions(1.0, True, 11, _w("fair")).fits("zapad") and not Conditions(1.0, False, 11, _w("fair")).fits("zapad")
    assert sunny.fits(None, ("podzim",)) and not sunny.fits(None, ("leto",))


ENTRIES = [
    {"id": "doma", "soubor": "doma.jpg", "kdy": ["kdykoliv"], "popis": "selfie doma"},
    {"id": "dest", "soubor": "dest.jpg", "kdy": ["kdykoliv"], "podminka": "dest", "popis": "v dešti"},
    {"id": "venku", "soubor": "venku.jpg", "kdy": ["kdykoliv"], "podminka": "svetlo", "popis": "na kopci"},
    {"id": "prygl", "soubor": "prygl.jpg", "kdy": ["kdykoliv"], "podminka": "slunce", "obdobi": ["leto"],
     "popis": "u přehrady"},
]


def test_bot_offers_photos_and_context_by_real_weather(tmp_path):
    st = Storage(":memory:")
    user = st.get_or_create_user(1, "alex", 1, "T")
    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:", reply_debounce_seconds=0,
                        typing_simulation=False, photos_per_day=5, sample_photo_after=0)
    bot = CompanionBot(settings, ALEX, st, brain=None, weather=FixedWeather(_w("clearsky", -0.4)))
    bot.photos = _make_library(tmp_path / "t", ENTRIES, {e["id"] for e in ENTRIES})
    noon = datetime(2026, 11, 14, 12, 0, tzinfo=TIMEZONE)
    evening = datetime(2026, 11, 14, 19, 0, tzinfo=TIMEZONE)
    july = datetime(2026, 7, 14, 12, 0, tzinfo=TIMEZONE)

    assert set(bot._allowed_photos(user, noon, "asked")) == {"doma", "venku"}  # jasno, listopad
    assert set(bot._allowed_photos(user, evening, "asked")) == {"doma"}  # po setmění nic zvenku
    assert set(bot._allowed_photos(user, july, "asked")) == {"doma", "venku", "prygl"}
    bot.weather = FixedWeather(_w("rain"))
    assert set(bot._allowed_photos(user, noon, "asked")) == {"doma", "dest"}  # prší
    bot.weather = None
    assert set(bot._allowed_photos(user, noon, "asked")) == {"doma", "venku"}  # počasí neznáme

    bot.weather = FixedWeather(_w("clearsky", -0.4))
    dyn = bot._dynamic(user, datetime(2026, 11, 14, 7, 59, tzinfo=TIMEZONE))
    situation = dyn.split("# Co si o ní pamatuješ")[0]
    assert "Počasí v Praze teď: jasno" in situation and "slunce dnes vychází" in situation


def test_real_alex_photos_respect_weather():
    from app.photos import PhotoLibrary

    lib = PhotoLibrary.for_persona("alex")
    noon = datetime(2026, 11, 14, 12, 0, tzinfo=TIMEZONE)
    sunny = [p for p in lib.available(noon.time(), set(), Conditions(20.0, False, 11, _w("clearsky")))]
    rainy = [p for p in lib.available(noon.time(), set(), Conditions(20.0, False, 11, _w("rain")))]
    assert "portret_sako" in {p.id for p in sunny} and "portret_sako" in {p.id for p in rainy}
    assert all(p.need not in ("svetlo", "slunce") for p in rainy)  # v dešti nic ze slunečného venku
