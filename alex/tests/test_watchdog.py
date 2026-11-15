"""Hlídání, že příjem zpráv z Telegramu nezamrzl."""

import asyncio
from types import SimpleNamespace

from telegram.error import NetworkError

from app.config import Settings
from app.persona import ALEX
from app.storage import Storage
from app.telegram_bot import WATCHDOG_STUCK_CHECKS, CompanionBot


class FakeUpdater:
    def __init__(self):
        self.running = True
        self.stops = 0
        self.starts = 0

    async def stop(self):
        self.stops += 1
        self.running = False

    async def start_polling(self, **kwargs):
        self.starts += 1
        self.running = True


class FakeBot:
    def __init__(self, pending):
        self.pending = list(pending)

    async def get_webhook_info(self):
        value = self.pending.pop(0)
        if isinstance(value, Exception):
            raise value
        return SimpleNamespace(pending_update_count=value)


def _bot() -> CompanionBot:
    settings = Settings(telegram_token="x", model="m", effort="low", db_path=":memory:",
                        reply_debounce_seconds=0, typing_simulation=False)
    return CompanionBot(settings, ALEX, Storage(":memory:"), brain=None)


def _run(bot, pending):
    updater = FakeUpdater()
    app = SimpleNamespace(updater=updater, stop_running=lambda: None)
    context = SimpleNamespace(bot=FakeBot(pending), application=app)
    for _ in pending:
        asyncio.run(bot.polling_watchdog(context))
    return updater


def test_restarts_polling_when_message_waits_too_long():
    updater = _run(_bot(), [1] * WATCHDOG_STUCK_CHECKS)
    assert (updater.stops, updater.starts) == (1, 1)


def test_no_restart_when_messages_get_picked_up():
    # zpráva chvíli čeká, ale mezitím se vyzvedne; výpadek sítě při kontrole nic nezpůsobí
    updater = _run(_bot(), [1, 0, 1, NetworkError("x"), 1, 0, 0])
    assert (updater.stops, updater.starts) == (0, 0)
