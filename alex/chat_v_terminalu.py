"""Vyzkoušení Terezy přímo v terminálu, bez Telegramu:  python chat_v_terminalu.py

Potřebuješ jen klíč pro Claude nebo DeepSeek v souboru .env.
Příkazy: /rano a /vecer (napíše sám od sebe), /pamet (aktualizuje a ukáže paměť), /konec
"""

import asyncio
import logging
import os
from dataclasses import replace
from datetime import datetime

from app.config import TIMEZONE, load_settings
from app.persona import ALEX, has_kids
from app.prompts import proactive_task
from app.providers import create_brain
from app.storage import Storage
from app.telegram_bot import CompanionBot
from app.weather import WeatherService

USER_ID = 0  # terminálový uživatel


class TerminalBot:
    """Napodobuje Telegram bota – zprávy jen vypisuje do terminálu."""

    async def send_chat_action(self, chat_id, action):
        print(f"  ({ALEX.name} píše…)", end="\r", flush=True)

    async def send_message(self, chat_id, text):
        print(f"{ALEX.name}: {text}                ")

    async def send_photo(self, chat_id, photo):
        print(f"{ALEX.name}: [📷 poslal fotku]                ")


async def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    settings = load_settings(require_telegram=False)
    settings = replace(settings, db_path=os.getenv("TERMINAL_DB_PATH", "data/terminal.db"), reply_debounce_seconds=0)
    storage = Storage(settings.db_path)
    weather = WeatherService(ALEX.places, settings.weather_contact) if settings.weather_enabled else None
    bot = CompanionBot(settings, ALEX, storage, create_brain(settings), weather)

    async def refresh_weather() -> None:
        if weather:
            await weather.maybe_refresh()

    await refresh_weather()
    tg = TerminalBot()

    name = input("Jak se jmenuješ? ").strip() or "Tomáš"
    user = storage.get_or_create_user(USER_ID, ALEX.key, chat_id=0, first_name=name)
    storage.update_user(USER_ID, ALEX.key, age_status="adult")
    print(f"\nPostava: {ALEX.name} ({bot.brain.label}). Příkazy: /rano /vecer /pamet /konec\n")

    if storage.count_messages(USER_ID, ALEX.key) == 0:
        await bot._send_first_message(tg, storage.get_user(USER_ID, ALEX.key))

    while True:
        try:
            text = (await asyncio.to_thread(input, "Ty: ")).strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not text:
            continue
        await refresh_weather()
        if text == "/konec":
            break
        if text in ("/rano", "/vecer"):
            evening = "evening_kids" if has_kids(ALEX, datetime.now(TIMEZONE).date()) else "evening"
            slot = next(s for s in ALEX.slots if s.name == ("morning" if text == "/rano" else evening))
            user = storage.get_user(USER_ID, ALEX.key)
            history = storage.recent_messages(USER_ID, ALEX.key, 40)
            now = datetime.now(TIMEZONE)
            reply = await bot.brain.proactive(ALEX, bot._dynamic(user, now, proactive_task(slot.hint)), history)
            await bot._deliver(tg, user, reply, "proactive", now)
            continue
        if text == "/pamet":
            await bot._update_memory(USER_ID)
            facts = storage.get_user(USER_ID, ALEX.key).facts
            print("\n".join(f"  • {f}" for f in facts) or "  (zatím nic)")
            continue
        user = storage.get_user(USER_ID, ALEX.key)
        storage.add_message(USER_ID, ALEX.key, "user", text)
        storage.update_user(USER_ID, ALEX.key, msgs_since_memory=user.msgs_since_memory + 1)
        await bot._reply_now(tg, USER_ID)
        await asyncio.gather(*bot._memory_tasks)  # nechat doběhnout případnou aktualizaci paměti


if __name__ == "__main__":
    asyncio.run(main())
