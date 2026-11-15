"""Načtení nastavení z proměnných prostředí (.env)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

TIMEZONE = ZoneInfo("Europe/Prague")
PROVIDERS = ("claude", "deepseek")
PROVIDER_ALIASES = {"anthropic": "claude"}  # starší verze serveru používala AI_PROVIDER=anthropic


@dataclass(frozen=True)
class Settings:
    telegram_token: str
    model: str  # model Claude
    effort: str
    db_path: str
    reply_debounce_seconds: float
    typing_simulation: bool
    provider: str = "claude"  # claude | deepseek
    deepseek_model: str = "deepseek-flash"
    deepseek_api_key: str = ""
    delay_multiplier: float = 1.0  # 1.5 = všechna umělá zpoždění o 50 % delší
    free_messages_per_day: int = 30
    subscription_stars: int = 400  # cena předplatného na 30 dní v Telegram Stars
    admin_user_ids: tuple[int, ...] = ()  # majitel/správci: zprávy bez omezení, nic neplatí
    photos_per_day: int = 1  # kolik fotek může postava jednomu uživateli denně poslat
    photo_unsolicited_days: float = 3  # sám od sebe (bez požádání) nanejvýš 1 fotka za tolik dní
    photo_tease_refusals: int = 2  # kolikrát nejdřív hravě odmítne, než fotku na požádání pošle
    sample_photo_after: int = 8  # ukázková fotka pro každého nového uživatele po tolika jeho zprávách (0 = vypnuto)
    free_replies_after_proactive: int = 3  # odpovědi na jeho zprávu „sám od sebe“ se do limitu nepočítají
    weather_enabled: bool = True  # stahovat skutečné počasí (MET Norway)
    weather_contact: str = ""  # e-mail nebo web provozovatele, posílá se jen MET Norway v hlavičce dotazu
    operator_name: str = ""  # PROVOZOVATEL: jméno nebo firma a IČO (do /terms)
    support_contact: str = ""  # KONTAKT_PODPORA: e-mail nebo @uživatel (do /terms a /paysupport)
    promo_premium_users: int = 0  # prvních tolik nových uživatelů dostane předplatné zdarma (0 = vypnuto)
    promo_premium_days: float = 7  # na kolik dní platí předplatné zdarma
    payments_enabled: bool = False  # PAYMENTS_ENABLED: False = zkušební provoz zdarma, bez limitu a předplatného


def load_settings(require_telegram: bool = True) -> Settings:
    load_dotenv()
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if require_telegram and not token:
        raise SystemExit(
            "Chybí TELEGRAM_BOT_TOKEN. Na Windows spusť start_bot.bat (zeptá se na něj), jinak ho doplň do souboru .env."
        )
    provider = (os.getenv("LLM_PROVIDER", "").strip() or os.getenv("AI_PROVIDER", "").strip() or "claude").lower()
    provider = PROVIDER_ALIASES.get(provider, provider)
    if provider not in PROVIDERS:
        raise SystemExit(f"Neznámé LLM_PROVIDER='{provider}'. Povolené hodnoty: claude, deepseek.")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if provider == "claude" and not os.getenv("ANTHROPIC_API_KEY") and not os.getenv("ANTHROPIC_AUTH_TOKEN"):
        raise SystemExit(
            "Chybí ANTHROPIC_API_KEY. Na Windows spusť start_test.bat (zeptá se na něj), jinak doplň do .env klíč z https://platform.claude.com."
        )
    if provider == "deepseek" and not deepseek_key:
        raise SystemExit(
            "Chybí DEEPSEEK_API_KEY. Na Windows spusť start_test.bat (zeptá se na něj), jinak doplň do .env klíč z https://platform.deepseek.com."
        )
    return Settings(
        telegram_token=token,
        model=os.getenv("CLAUDE_MODEL", "claude-haiku-5-5").strip(),
        effort=os.getenv("CLAUDE_EFFORT", "medium").strip(),
        db_path=os.getenv("DB_PATH", "data/alex.db").strip(),
        reply_debounce_seconds=float(os.getenv("REPLY_DEBOUNCE_SECONDS", "4")),
        typing_simulation=os.getenv("TYPING_SIMULATION", "1").strip() not in ("0", "false", "no"),
        provider=provider,
        deepseek_model=os.getenv("DEEPSEEK_MODEL", "").strip() or "deepseek-flash",
        deepseek_api_key=deepseek_key,
        delay_multiplier=max(0.0, float(os.getenv("DELAY_MULTIPLIER", "1.5"))),
        free_messages_per_day=int(os.getenv("FREE_MESSAGES_PER_DAY", "30")),
        subscription_stars=int(os.getenv("SUBSCRIPTION_STARS", "400")),
        photos_per_day=int(os.getenv("PHOTOS_PER_DAY", "1")),
        photo_unsolicited_days=float(os.getenv("PHOTO_UNSOLICITED_DAYS", "3")),
        photo_tease_refusals=int(os.getenv("PHOTO_TEASE_REFUSALS", "2")),
        sample_photo_after=int(os.getenv("SAMPLE_PHOTO_AFTER", "8")),
        free_replies_after_proactive=int(os.getenv("FREE_REPLIES_AFTER_PROACTIVE", "3")),
        weather_enabled=os.getenv("WEATHER_ENABLED", "1").strip() not in ("0", "false", "ne", ""),
        weather_contact=os.getenv("WEATHER_CONTACT", "").strip(),
        operator_name=os.getenv("PROVOZOVATEL", "").strip(),
        support_contact=os.getenv("KONTAKT_PODPORA", "").strip(),
        promo_premium_users=int(os.getenv("PROMO_PREMIUM_USERS", "0")),
        promo_premium_days=float(os.getenv("PROMO_PREMIUM_DAYS", "7")),
        payments_enabled=os.getenv("PAYMENTS_ENABLED", "0").strip() not in ("0", "false", "ne", ""),
        admin_user_ids=tuple(
            int(x) for x in os.getenv("ADMIN_USER_IDS", "").replace(" ", "").split(",") if x.isdigit()
        ),
    )
