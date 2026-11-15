"""Spuštění Telegram bota:  python run_bot.py"""

import logging

from telegram import Update

from app.config import load_settings
from app.persona import ALEX
from app.providers import create_brain
from app.storage import Storage
from app.telegram_bot import CompanionBot
from app.weather import WeatherService


def main() -> None:
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s: %(message)s", level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpx2").setLevel(logging.WARNING)

    settings = load_settings()
    storage = Storage(settings.db_path)
    brain = create_brain(settings)
    weather = WeatherService(ALEX.places, settings.weather_contact) if settings.weather_enabled else None
    bot = CompanionBot(settings, ALEX, storage, brain, weather)
    app = bot.build_application()
    logging.info("%s běží (%s). Ukončíš Ctrl+C.", ALEX.name, brain.label)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
