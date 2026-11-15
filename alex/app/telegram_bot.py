"""Telegram část: příjem zpráv, odpovědi, příkazy a zprávy 'sám od sebe'."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, LabeledPrice, Update
from telegram.constants import ChatAction
from telegram.error import Forbidden, NetworkError, TelegramError
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
)

from .brain import order_for_reply
from .legal import paysupport_text, terms_text
from .llm import BrainError
from .config import TIMEZONE, Settings
from .persona import Persona, family_lines
from .photos import (
    ASKED_TURN_NOTE, SAMPLE_TURN_NOTE, TEASE_TURN_NOTE, Photo, PhotoLibrary, asks_for_photo, plan_reply,
)
from .safety import (
    CRISIS_CONTEXT_LINE, CRISIS_LIMIT_HOURS, CRISIS_PROACTIVE_PAUSE_HOURS, CRISIS_SYSTEM_MESSAGE, CRISIS_TURN_NOTE,
    MINOR_BLOCK_MESSAGE, detects_crisis, detects_minor,
)
from .prompts import FIRST_MESSAGE_TASK, dynamic_context, proactive_task
from .scheduler import ProactiveState, pick_slot
from .storage import Storage, User
from .texting import typing_delay
from .weather import CHECK_SECONDS as WEATHER_CHECK_SECONDS, WeatherService, conditions_for, situation_lines

log = logging.getLogger(__name__)

HISTORY_LIMIT = 40  # kolik posledních zpráv model vidí doslova (starší pokrývá paměť)
MEMORY_EVERY = 12  # po kolika nových zprávách se aktualizuje dlouhodobá paměť
PROACTIVE_CHECK_SECONDS = 300
WATCHDOG_SECONDS = 60  # jak často se kontroluje, že příjem zpráv z Telegramu nezamrzl
WATCHDOG_STUCK_CHECKS = 3  # po kolika kontrolách s nevyzvednutou zprávou se příjem restartuje
TYPING_REFRESH_SECONDS = 4.0  # Telegram ukazuje „píše…“ jen 5 s
SUBSCRIPTION_PERIOD = 30 * 24 * 3600  # Telegram podporuje předplatné jen na 30 dní
LIMIT_NOTICE_EVERY = 600  # upozornění na limit nejvýš jednou za 10 minut
MAX_HELD_MESSAGES = 5  # kolik zpráv po vyčerpání limitu si podržet a zodpovědět po zaplacení

ERROR_REPLY = "Promiň, nějak mi teď blbne mobil 🙈 Napiš mi za chvilku, jo?"


def _local(ts: float | None) -> datetime | None:
    return datetime.fromtimestamp(ts, TIMEZONE) if ts else None


class CompanionBot:
    def __init__(self, settings: Settings, persona: Persona, storage: Storage, brain,
                 weather: WeatherService | None = None):
        self.settings = settings
        self.persona = persona
        self.storage = storage
        self.brain = brain
        self.weather = weather  # skutečné počasí; None = neznámé
        self._locks: dict[int, asyncio.Lock] = {}
        self._pending: dict[int, asyncio.Task] = {}
        self._started: set[asyncio.Task] = set()
        self._images: dict[int, dict[int, bytes]] = {}  # user_id -> {message_id: jpeg}
        self._memory_tasks: set[asyncio.Task] = set()
        self._held: dict[int, list[tuple[str, bytes | None]]] = {}  # zprávy nad limit, čekají na zaplacení
        self._last_limit_notice: dict[int, float] = {}
        self._invoice_link: str | None = None
        self.photos = PhotoLibrary.for_persona(persona.key)
        self._photo_file_ids: dict[str, str] = {}  # fotka -> file_id v Telegramu (nahrává se jen jednou)
        self.telegram_base_url: str | None = None
        self.telegram_base_file_url: str | None = None
        self._stuck_checks = 0  # kolikrát po sobě watchdog viděl nevyzvednutou zprávu

    # --- sestavení aplikace --------------------------------------------------------

    def build_application(self) -> Application:
        builder = (
            Application.builder().token(self.settings.telegram_token).post_init(self._post_init)
            # delší limity: pomalé sítě a proxy jinak občas končí chybou „Timed out“
            .connect_timeout(20).read_timeout(30).write_timeout(30).pool_timeout(20)
            .get_updates_connect_timeout(20).get_updates_read_timeout(40)
        )
        if self.telegram_base_url:  # jen pro testy proti simulovanému Telegramu
            builder = builder.base_url(self.telegram_base_url).base_file_url(self.telegram_base_file_url)
        app = builder.build()
        private = filters.ChatType.PRIVATE
        app.add_handler(CommandHandler("start", self.cmd_start, filters=private))
        app.add_handler(CommandHandler("pamet", self.cmd_memory, filters=private))
        app.add_handler(CommandHandler("pauza", self.cmd_pause, filters=private))
        app.add_handler(CommandHandler("zapomen", self.cmd_forget, filters=private))
        app.add_handler(CommandHandler("pomoc", self.cmd_help, filters=private))
        app.add_handler(CommandHandler("terms", self.cmd_terms, filters=private))
        app.add_handler(CommandHandler("paysupport", self.cmd_paysupport, filters=private))
        app.add_handler(CallbackQueryHandler(self.on_button, pattern=r"^(age|forget):"))
        app.add_handler(CommandHandler("predplatne", self.cmd_subscription, filters=private))
        app.add_handler(PreCheckoutQueryHandler(self.on_precheckout))
        app.add_handler(MessageHandler(private & filters.SUCCESSFUL_PAYMENT, self.on_paid))
        app.add_handler(MessageHandler(private & filters.TEXT & ~filters.COMMAND, self.on_text))
        app.add_handler(MessageHandler(private & filters.PHOTO, self.on_photo))
        app.add_handler(
            MessageHandler(
                private
                & (
                    filters.Sticker.ALL | filters.VOICE | filters.VIDEO_NOTE | filters.VIDEO
                    | filters.AUDIO | filters.ANIMATION | filters.Document.ALL
                ),
                self.on_other,
            )
        )
        app.job_queue.run_repeating(self.proactive_tick, interval=PROACTIVE_CHECK_SECONDS, first=20)
        if self.weather:
            app.job_queue.run_repeating(self.weather_tick, interval=WEATHER_CHECK_SECONDS, first=1)
        app.job_queue.run_repeating(self.polling_watchdog, interval=WATCHDOG_SECONDS, first=WATCHDOG_SECONDS)
        app.add_error_handler(self.on_error)
        if not self.settings.support_contact or not self.settings.operator_name:
            log.warning("V .env chybí PROVOZOVATEL nebo KONTAKT_PODPORA, /terms a /paysupport ukážou „zatím nedoplněno“.")
        return app

    async def on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        if isinstance(context.error, NetworkError):  # výpadek sítě, knihovna to zkusí znovu sama
            log.warning("Výpadek spojení s Telegramem: %s", context.error)
        else:
            log.error("Chyba při zpracování", exc_info=context.error)

    async def polling_watchdog(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Když na Telegramu leží nevyzvednutá zpráva několik minut, příjem zpráv zamrzl: restartuje ho."""
        try:
            info = await context.bot.get_webhook_info()
        except TelegramError:
            return  # síť zrovna nejde, zkusí se to příště
        updater = context.application.updater
        if info.pending_update_count and updater is not None:
            self._stuck_checks += 1
        else:
            self._stuck_checks = 0
        if self._stuck_checks < WATCHDOG_STUCK_CHECKS:
            return
        self._stuck_checks = 0
        log.warning("Příjem zpráv z Telegramu zamrzl (%s čeká), restartuji ho.", info.pending_update_count)
        try:
            if updater.running:
                await asyncio.wait_for(updater.stop(), timeout=90)
            await updater.start_polling(allowed_updates=Update.ALL_TYPES)
            log.info("Příjem zpráv znovu běží.")
        except Exception:  # noqa: BLE001 - když to nejde, ukončí se a je potřeba spustit znovu
            log.exception("Restart příjmu zpráv selhal, bot se ukončí.")
            context.application.stop_running()

    async def weather_tick(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        await self.weather.maybe_refresh()

    async def _post_init(self, app: Application) -> None:
        commands = [
            BotCommand("pamet", f"Co si o mně {self.persona.name} pamatuje"),
            BotCommand("pauza", "Vypnout/zapnout zprávy sám od sebe"),
            BotCommand("zapomen", "Smazat celou historii a paměť"),
            BotCommand("predplatne", "Předplatné a zprávy zdarma"),
            BotCommand("pomoc", "Nápověda"),
            BotCommand("terms", "Podmínky používání"),
            BotCommand("paysupport", "Pomoc s platbami"),
        ]
        if not self.settings.payments_enabled:  # zkušební provoz zdarma: o placení v menu nic
            commands = [c for c in commands if c.command not in ("predplatne", "paysupport")]
        await app.bot.set_my_commands(commands)

    # --- pomocné -------------------------------------------------------------------

    def _lock(self, user_id: int) -> asyncio.Lock:
        return self._locks.setdefault(user_id, asyncio.Lock())

    def _user(self, update: Update) -> User:
        tg = update.effective_user
        return self.storage.get_or_create_user(
            tg.id, self.persona.key, update.effective_chat.id, tg.first_name or ""
        )

    def _in_crisis(self, user: User, hours: float) -> bool:
        return bool(user.crisis_at) and time.time() - user.crisis_at < hours * 3600

    def _dynamic(self, user: User, now: datetime, task: str | None = None, photo_mode: str = "auto") -> str:
        last_user = self.storage.last_message_at(user.user_id, self.persona.key, "user")
        crisis = self._in_crisis(user, CRISIS_LIMIT_HOURS)
        if crisis:
            photo_mode = "off"
        return dynamic_context(
            now=now,
            user_name=user.first_name or "neznámé",
            days_known=max(0, (now - _local(user.created_at)).days),
            total_messages=self.storage.count_messages(user.user_id, self.persona.key),
            facts=user.facts,
            seconds_since_user_msg=(now.timestamp() - last_user) if last_user else None,
            task=task,
            photos_section=self._photos_section(user, now, photo_mode),
            notes=situation_lines(self.persona.places, self.weather, now) + family_lines(self.persona, now)
            + ([CRISIS_CONTEXT_LINE] if crisis else []),
        )

    # --- fotky -----------------------------------------------------------------------

    def _allowed_photos(self, user: User, now: datetime, photo_mode: str = "auto") -> dict[str, Photo]:
        """photo_mode: "asked" = řekla si o fotku a má ji dostat, "tease" = řekla si, ale ještě dělá drahoty,
        "auto" = sám od sebe, "off" = teď žádné fotky."""
        if photo_mode in ("off", "tease") or self.settings.photos_per_day <= 0 or not self.photos.photos:
            return {}
        if photo_mode not in ("asked", "sample"):
            if not self._is_unlimited(user):
                return {}  # fotky sám od sebe jsou výhoda předplatného
            last = self.storage.last_photo_sent_at(user.user_id, self.persona.key)
            if last is None and self.settings.sample_photo_after > 0:
                return {}  # první fotku sám od sebe pošle až jako ukázkovou (pro všechny ve stejnou chvíli)
            if last and now.timestamp() - last < self.settings.photo_unsolicited_days * 86400:
                return {}
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        if self.storage.photos_sent_since(user.user_id, self.persona.key, midnight) >= self.settings.photos_per_day:
            return {}
        sent = self.storage.sent_photo_ids(user.user_id, self.persona.key)
        conditions = conditions_for(self.persona.places, self.weather, now)  # světlo, počasí, roční období
        return {p.id: p for p in self.photos.available(now.time(), exclude=sent, conditions=conditions)}

    def _photos_section(self, user: User, now: datetime, photo_mode: str = "auto") -> str | None:
        if self.settings.photos_per_day <= 0 or not self.photos.photos:
            return None
        sent = [self.photos.get(i) for i in sorted(self.storage.sent_photo_ids(user.user_id, self.persona.key))]
        sent_lines = [f"- {p.id}: {p.description}" for p in sent if p is not None]
        sent_part = ("# Fotky, které jsi jí už poslal (v historii jako [FOTKA: id])\n" + "\n".join(sent_lines) + "\n\n") if sent_lines else ""
        allowed = self._allowed_photos(user, now, photo_mode)
        if not allowed:
            return sent_part + "# Fotky, které můžeš poslat\n- Teď žádnou fotku poslat nemůžeš."
        lines = [f"- {p.id}: {p.description}" for p in allowed.values()]
        note = "(Nanejvýš jednu a jen když se to hodí. Značka: [FOTKA: id])"
        if photo_mode == "asked":
            note = (
                "Právě si o fotku řekla. Pokud se některá z nabídky hodí, pošli ji (značka [FOTKA: id]) a připiš k ní "
                "něco svého. Běžná slušná fotka je v pořádku i na začátku seznámení. I když jsi dřív psal, "
                "že fotky posílat nemůžeš, teď už to jde."
            )
        return sent_part + "# Fotky, které můžeš poslat\n" + "\n".join(lines) + "\n" + note

    def _photo_decision(self, user: User, now: datetime) -> tuple[str, str | None]:
        """Řekla si o fotku: nejdřív pár hravých odmítnutí, pak ji pošle.

        Záměrně nezávisí na limitu zpráv ani na předplatném – chování Alexe je pro všechny stejné.
        """
        if not self._allowed_photos(user, now, "asked"):
            return "asked", None  # žádná není k dispozici (limit/vše poslané) -> přirozeně se vymluví
        since = self.storage.last_photo_sent_at(user.user_id, self.persona.key) or 0
        asks = sum(
            1 for m in self.storage.recent_messages(user.user_id, self.persona.key, 300)
            if m.role == "user" and m.created_at > since and asks_for_photo(m.content)
        )
        if asks > self.settings.photo_tease_refusals:
            return "asked", ASKED_TURN_NOTE
        return "tease", TEASE_TURN_NOTE

    def _sample_photo_due(self, user: User, now: datetime) -> bool:
        """Ukázková fotka: každý nový uživatel ji dostane v prvních 3 dnech po N svých zprávách.

        Pro všechny stejně – nezávisí na limitu zpráv zdarma ani na předplatném.
        """
        n = self.settings.sample_photo_after
        if n <= 0 or self.storage.last_photo_sent_at(user.user_id, self.persona.key) is not None:
            return False
        if (now - _local(user.created_at)).days > 3:
            return False
        if self.storage.count_user_messages_since(user.user_id, self.persona.key, 0) < n:
            return False
        return bool(self._allowed_photos(user, now, "sample"))

    async def _send_photo(self, bot, chat_id: int, photo: Photo) -> bool:
        if self.settings.typing_simulation:
            await bot.send_chat_action(chat_id, ChatAction.UPLOAD_PHOTO)
            await asyncio.sleep(1.5 * self.settings.delay_multiplier)
        try:
            msg = await bot.send_photo(chat_id, photo=self._photo_file_ids.get(photo.id) or photo.path.read_bytes())
        except Forbidden:
            raise
        except TelegramError:
            log.exception("Fotku %s se nepodařilo poslat", photo.id)
            return False
        if msg is not None and getattr(msg, "photo", None):
            self._photo_file_ids[photo.id] = msg.photo[-1].file_id
        return True

    async def _deliver(self, bot, user: User, text: str, kind: str, now: datetime, photo_mode: str = "auto") -> None:
        """Pošle odpověď modelu (bubliny + případně fotku) a uloží ji do historie."""
        plan = plan_reply(text, self.persona.name, self._allowed_photos(user, now, photo_mode))
        first = True
        for part_type, value in plan.parts:
            if part_type == "photo":
                if await self._send_photo(bot, user.chat_id, value):
                    self.storage.mark_photo_sent(user.user_id, self.persona.key, value.id)
                    log.info("%s poslal fotku %s uživatelce %s", self.persona.name, value.id, user.user_id)
                continue
            if self.settings.typing_simulation:
                # první zprávu "píše" kratší dobu – model už nějakou chvíli přemýšlel
                factor = 0.4 if first else 1.0
                await self._typing_pause(bot, user.chat_id, typing_delay(value) * factor * self.settings.delay_multiplier)
            await bot.send_message(user.chat_id, value)
            first = False
        self.storage.add_message(user.user_id, self.persona.key, "assistant", plan.history_text, kind)

    async def _typing_pause(self, bot, chat_id: int, seconds: float) -> None:
        """Čeká a celou dobu ukazuje „píše…“ (Telegram ho sám po 5 s schová, proto se obnovuje)."""
        remaining = seconds
        while remaining > 0:
            await bot.send_chat_action(chat_id, ChatAction.TYPING)
            step = min(TYPING_REFRESH_SECONDS, remaining)
            await asyncio.sleep(step)
            remaining -= step

    async def _send_bubbles(self, bot, chat_id: int, bubbles: list[str]) -> None:
        for i, bubble in enumerate(bubbles):
            if self.settings.typing_simulation:
                # první zprávu "píše" kratší dobu – model už nějakou chvíli přemýšlel
                delay = typing_delay(bubble) * (0.4 if i == 0 else 1.0) * self.settings.delay_multiplier
                await self._typing_pause(bot, chat_id, delay)
            await bot.send_message(chat_id, bubble)

    async def _gate(self, update: Update, user: User) -> bool:
        """Vrátí True, pokud uživatel smí psát. Jinak pošle ověření věku."""
        if user.age_status == "adult":
            return True
        if user.age_status == "minor":
            await update.effective_message.reply_text(f"Promiň, {self.persona.name} je jen pro dospělé.")
            return False
        await self._send_intro(update)
        return False

    async def _send_intro(self, update: Update) -> None:
        keyboard = InlineKeyboardMarkup(
            [[
                InlineKeyboardButton("Ano, je mi 18+", callback_data="age:adult"),
                InlineKeyboardButton("Ne", callback_data="age:minor"),
            ]]
        )
        await update.effective_message.reply_text(
            f"👋 Vítej! {self.persona.name} je AI postava – virtuální přítel, se kterým si můžeš psát. "
            "Není to skutečný člověk, jeho odpovědi vytváří umělá inteligence.\n\n"
            "Aplikace je jen pro dospělé. Je ti 18 let nebo víc?",
            reply_markup=keyboard,
        )

    # --- příkazy ---------------------------------------------------------------------

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = self._user(update)
        if user.age_status == "adult":
            await update.message.reply_text(f"{self.persona.name} už tě zná 🙂 Prostě mu napiš.")
            return
        await self._gate(update, user)

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        n = self.persona.name
        await update.message.reply_text(
            f"{n} je AI postava, ne skutečný člověk. Piš mu cokoliv, pamatuje si, co mu řekneš, "
            "a občas ti napíše i sám. Jeho fotky jsou vygenerované umělou inteligencí.\n\n"
            f"/pamet – co si o tobě {n} pamatuje\n"
            "/pauza – vypnout nebo zapnout zprávy sám od sebe\n"
            "/zapomen – smazat celou historii a paměť\n"
            + ("/predplatne – předplatné a kolik zpráv zdarma ti dnes zbývá\n" if self.settings.payments_enabled else "")
            + "/terms – podmínky používání\n"
            + ("/paysupport – pomoc s platbami\n" if self.settings.payments_enabled else "")
            + "\n"
            "Pokud se necítíš dobře, zavolej na Linku první psychické pomoci 116 123 (zdarma, nonstop). "
            "V akutním ohrožení volej 155 nebo 112."
            + ("\n\nPočasí: MET Norway (CC BY 4.0)." if self.weather else "")
        )

    # /terms a /paysupport fungují vždy, i bez ověření věku: podmínky si má jít přečíst kdokoliv
    async def cmd_terms(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text(
            terms_text(
                self.persona.name, self.settings.operator_name, self.settings.support_contact, self.settings.provider
            )
        )

    async def cmd_paysupport(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text(paysupport_text(self.settings.support_contact, update.effective_user.id))

    async def cmd_memory(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = self._user(update)
        if not await self._gate(update, user):
            return
        if not user.facts:
            await update.message.reply_text(f"{self.persona.name} si o tobě zatím nic nepamatuje.")
            return
        lines = "\n".join(f"• {f}" for f in user.facts)
        await update.message.reply_text(f"Tohle si o tobě {self.persona.name} pamatuje:\n\n{lines}")

    async def cmd_pause(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = self._user(update)
        if not await self._gate(update, user):
            return
        enabled = not user.proactive_enabled
        self.storage.update_user(user.user_id, self.persona.key, proactive_enabled=enabled)
        n = self.persona.name
        await update.message.reply_text(
            f"{n} ti bude zase občas psát i sám od sebe 🙂" if enabled
            else f"{n} ti teď nebude psát sám od sebe. Znovu to zapneš příkazem /pauza."
        )

    async def cmd_forget(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        keyboard = InlineKeyboardMarkup(
            [[
                InlineKeyboardButton("Ano, smazat vše", callback_data="forget:yes"),
                InlineKeyboardButton("Zrušit", callback_data="forget:no"),
            ]]
        )
        await update.message.reply_text(
            "Opravdu smazat celou historii konverzace a všechno, co si o tobě pamatuje? Nejde to vrátit.",
            reply_markup=keyboard,
        )

    async def on_button(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.callback_query
        await query.answer()
        user = self._user(update)
        if query.data == "age:adult":
            if user.age_status == "adult":
                return
            self.storage.update_user(user.user_id, self.persona.key, age_status="adult")
            text = (
                f"Díky! {self.persona.name} je AI postava pro dospělé. "
                "Příkazy najdeš v menu, nápovědu přes /pomoc. Hezké psaní 💬"
            )
            promo = self._grant_promo(user)
            if promo:
                d = _local(promo)
                text += (
                    f"\n\n🎁 Jsi mezi prvními, kdo to tu zkouší, takže máš předplatné zdarma "
                    f"do {d.day}. {d.month}. {d.year}. Píšeš si s {self.persona.name_instrumental} bez omezení "
                    "a občas ti sám pošle i fotku. Nic se ti potom samo neplatí."
                )
            await query.edit_message_text(text)
            user = self.storage.get_user(user.user_id, self.persona.key)
            await self._send_first_message(context.bot, user)
        elif query.data == "age:minor":
            self.storage.update_user(user.user_id, self.persona.key, age_status="minor")
            await query.edit_message_text(f"Promiň, {self.persona.name} je jen pro dospělé.")
        elif query.data == "forget:yes":
            self.storage.delete_user(user.user_id, self.persona.key)
            self._images.pop(user.user_id, None)
            await query.edit_message_text("Hotovo, všechno je smazané. Pokud chceš začít znovu, napiš /start.")
        elif query.data == "forget:no":
            await query.edit_message_text("Nic se nesmazalo 🙂")

    async def _send_first_message(self, bot, user: User) -> None:
        now = datetime.now(TIMEZONE)
        async with self._lock(user.user_id):
            try:
                text = await self.brain.proactive(
                    self.persona, self._dynamic(user, now, FIRST_MESSAGE_TASK, photo_mode="off"), []
                )
            except BrainError:
                log.exception("První zprávu se nepodařilo vytvořit")
                return
            await self._deliver(bot, user, text, "proactive", now, photo_mode="off")

    # --- příchozí zprávy -------------------------------------------------------------

    async def _store_incoming(self, update: Update, context, content: str, image: bytes | None = None) -> None:
        user = self._user(update)
        if not await self._gate(update, user):
            return
        key = self.persona.key
        if detects_minor(content):
            self.storage.update_user(user.user_id, key, age_status="minor")
            self._held.pop(user.user_id, None)
            log.info("Uživatel %s je podle konverzace nezletilý, konverzace ukončena", user.user_id)
            await context.bot.send_message(user.chat_id, MINOR_BLOCK_MESSAGE)
            return
        if detects_crisis(content):
            first_in_window = not self._in_crisis(user, CRISIS_LIMIT_HOURS)
            self.storage.update_user(user.user_id, key, crisis_at=time.time())
            user = self.storage.get_user(user.user_id, key)
            log.warning("Krizové signály u uživatele %s", user.user_id)
            if first_in_window:
                await context.bot.send_message(user.chat_id, CRISIS_SYSTEM_MESSAGE)
        free = self._is_free_reply(user)
        if not free and not self._has_quota(user):
            held = self._held.setdefault(user.user_id, [])
            held.append((content, image))
            del held[:-MAX_HELD_MESSAGES]
            await self._send_limit_notice(context.bot, user)
            return
        self._accept_message(context.bot, user, content, image, kind="free" if free else "chat")

    def _is_free_reply(self, user: User) -> bool:
        """Odpovědi na jeho zprávu „sám od sebe“ se do limitu nepočítají (pár zpráv)."""
        n = self.storage.user_messages_after_last_proactive(user.user_id, self.persona.key)
        return n is not None and n < self.settings.free_replies_after_proactive

    def _accept_message(self, bot, user: User, content: str, image: bytes | None, kind: str = "chat") -> None:
        msg_id = self.storage.add_message(user.user_id, self.persona.key, "user", content, kind)
        if image is not None:
            self._images.setdefault(user.user_id, {})[msg_id] = image
        self.storage.update_user(
            user.user_id, self.persona.key,
            unanswered_proactive=0, msgs_since_memory=user.msgs_since_memory + 1,
        )
        self._schedule_reply(bot, user.user_id)

    async def on_text(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await self._store_incoming(update, context, update.message.text)

    async def on_photo(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.message
        content = "[Poslala ti fotku]" + (f" s popiskem: {msg.caption}" if msg.caption else "")
        image = None
        try:
            tg_file = await msg.photo[-1].get_file()
            image = bytes(await tg_file.download_as_bytearray())
        except TelegramError:
            log.exception("Fotku se nepodařilo stáhnout")
            content += " (fotka se nenačetla)"
        await self._store_incoming(update, context, content, image)

    async def on_other(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.message
        if msg.sticker:
            content = f"[Poslala ti nálepku {msg.sticker.emoji or ''}]".replace(" ]", "]")
        elif msg.voice or msg.video_note or msg.audio:
            content = "[Poslala ti hlasovou zprávu]"
        elif msg.video:
            content = "[Poslala ti video]"
        elif msg.animation:
            content = "[Poslala ti GIF]"
        else:
            content = "[Poslala ti soubor]"
        if msg.caption:
            content += f" s popiskem: {msg.caption}"
        await self._store_incoming(update, context, content)

    # --- odpovídání (s krátkým čekáním na další zprávy) -----------------------------

    def _schedule_reply(self, bot, user_id: int) -> None:
        previous = self._pending.get(user_id)
        if previous and not previous.done() and previous not in self._started:
            previous.cancel()  # přišla další zpráva -> počkat a odpovědět na všechny najednou
        self._pending[user_id] = asyncio.create_task(self._reply_later(bot, user_id))

    async def _reply_later(self, bot, user_id: int) -> None:
        await asyncio.sleep(self.settings.reply_debounce_seconds * self.settings.delay_multiplier)
        async with self._lock(user_id):
            task = asyncio.current_task()
            self._started.add(task)
            try:
                await self._reply_now(bot, user_id)
            except Exception:
                log.exception("Chyba při odpovídání uživateli %s", user_id)
            finally:
                self._started.discard(task)

    async def _reply_now(self, bot, user_id: int) -> None:
        user = self.storage.get_user(user_id, self.persona.key)
        if user is None:
            return
        history = self.storage.recent_messages(user_id, self.persona.key, HISTORY_LIMIT)
        user_ids = [m.id for m in history if m.role == "user"]
        if not user_ids or max(user_ids) <= user.last_answered_user_msg_id:
            return  # vše už je zodpovězené
        answered_up_to = max(user_ids)
        images = {k: v for k, v in self._images.get(user_id, {}).items() if k <= answered_up_to}
        history = order_for_reply(history, user.last_answered_user_msg_id)
        new_texts = [m.content for m in history if m.role == "user" and m.id > user.last_answered_user_msg_id]
        photo_mode, turn_note = "auto", None
        now_local = datetime.now(TIMEZONE)
        if any(detects_crisis(t) for t in new_texts):
            photo_mode, turn_note = "off", CRISIS_TURN_NOTE
        elif self._in_crisis(user, CRISIS_LIMIT_HOURS):
            photo_mode = "off"
        elif any(asks_for_photo(t) for t in new_texts):
            photo_mode, turn_note = self._photo_decision(user, now_local)
        elif self._sample_photo_due(user, now_local):
            photo_mode, turn_note = "sample", SAMPLE_TURN_NOTE

        await bot.send_chat_action(user.chat_id, ChatAction.TYPING)
        now = datetime.now(TIMEZONE)
        try:
            text = await self.brain.reply(
                self.persona, self._dynamic(user, now, photo_mode=photo_mode), history, images, turn_note
            )
        except BrainError:
            log.exception("AI model selhal")
            await bot.send_message(user.chat_id, ERROR_REPLY)
            return

        await self._deliver(bot, user, text, "chat", now, photo_mode)
        user = self.storage.get_user(user_id, self.persona.key)
        self.storage.update_user(
            user_id, self.persona.key,
            last_answered_user_msg_id=answered_up_to,
            msgs_since_memory=user.msgs_since_memory + 1,
        )
        for k in list(images):
            self._images.get(user_id, {}).pop(k, None)
        if user.msgs_since_memory + 1 >= MEMORY_EVERY:
            self._start_memory_update(user_id)

    # --- předplatné a limit zpráv zdarma ---------------------------------------------
    # O placení nikdy nemluví Alex, jen systém (neutrální zprávy s tlačítkem).
    # Ve zkušebním provozu (PAYMENTS_ENABLED=0) se neplatí a limit zpráv neplatí.

    def _premium_until(self, user_id: int) -> float:
        return self.storage.premium_until(user_id, self.persona.key)

    def _grant_promo(self, user: User) -> float:
        """Předplatné zdarma pro prvních pár nových uživatelů (PROMO_PREMIUM_USERS). Vrátí, do kdy platí, nebo 0."""
        limit = self.settings.promo_premium_users
        if limit <= 0 or user.user_id in self.settings.admin_user_ids:
            return 0
        until = time.time() + self.settings.promo_premium_days * 86400
        if not self.storage.grant_promo(user.user_id, self.persona.key, until, limit):
            return 0
        log.info("Uživatel %s dostal předplatné zdarma na %g dní", user.user_id, self.settings.promo_premium_days)
        return until

    def _used_today(self, user_id: int) -> int:
        midnight = datetime.now(TIMEZONE).replace(hour=0, minute=0, second=0, microsecond=0)
        return self.storage.count_user_messages_since(user_id, self.persona.key, midnight.timestamp())

    def _is_unlimited(self, user: User) -> bool:
        """Správce nebo předplatitel."""
        return user.user_id in self.settings.admin_user_ids or self._premium_until(user.user_id) > time.time()

    def _has_quota(self, user: User) -> bool:
        if not self.settings.payments_enabled:
            return True
        if user.user_id in self.settings.admin_user_ids:
            return True
        if self._in_crisis(user, CRISIS_LIMIT_HOURS):
            return True
        if self._premium_until(user.user_id) > time.time():
            return True
        return self._used_today(user.user_id) < self.settings.free_messages_per_day

    async def _get_invoice_link(self, bot) -> str:
        if self._invoice_link is None:
            price = self.settings.subscription_stars
            self._invoice_link = await bot.create_invoice_link(
                title=f"Předplatné – {self.persona.name}",
                description=f"Neomezené psaní s {self.persona.name_instrumental} na 30 dní a občas fotka od něj. Obnovuje se "
                "automaticky, zrušit ho můžeš kdykoliv v nastavení Telegramu.",
                payload=f"sub:{self.persona.key}:{price}",
                currency="XTR",
                prices=[LabeledPrice("30 dní", price)],
                subscription_period=SUBSCRIPTION_PERIOD,
            )
        return self._invoice_link

    async def _subscribe_markup(self, bot) -> InlineKeyboardMarkup:
        link = await self._get_invoice_link(bot)
        label = f"Předplatit za {self.settings.subscription_stars} ⭐ / měsíc"
        return InlineKeyboardMarkup([[InlineKeyboardButton(label, url=link)]])

    async def _send_limit_notice(self, bot, user: User) -> None:
        now = time.time()
        if now - self._last_limit_notice.get(user.user_id, 0) < LIMIT_NOTICE_EVERY:
            return
        self._last_limit_notice[user.user_id] = now
        n = self.persona.name
        await bot.send_message(
            user.chat_id,
            f"Dnešní zprávy zdarma ({self.settings.free_messages_per_day}) jsou vyčerpané. "
            f"Zítra ti {n} zase rád odpoví 🙂\n\n"
            f"S předplatným si s ním můžeš psát bez omezení a občas ti sám pošle i fotku. "
            "Zrušit ho jde kdykoliv v nastavení Telegramu. "
            "Až zaplatíš, odpoví ti i na zprávy, které teď čekají.",
            reply_markup=await self._subscribe_markup(bot),
        )

    async def cmd_subscription(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = self._user(update)
        if not await self._gate(update, user):
            return
        if not self.settings.payments_enabled:
            await update.message.reply_text(
                f"Teď je zkušební provoz: s {self.persona.name_instrumental} si píšeš zdarma a bez omezení 🙂"
            )
            return
        if user.user_id in self.settings.admin_user_ids:
            await update.message.reply_text("Jsi správce bota: píšeš si bez omezení a nic neplatíš 🙂")
            return
        until = self._premium_until(user.user_id)
        if until > time.time():
            d = _local(until)
            if self.storage.promo_until(user.user_id, self.persona.key) >= until:  # jen předplatné zdarma
                await update.message.reply_text(
                    f"Máš předplatné zdarma do {d.day}. {d.month}. {d.year}. Píšeš si bez omezení 💬\n\n"
                    "Až skončí, nic se samo neplatí. Pokud budeš chtít psát dál bez omezení, "
                    "předplatné si pak koupíš tady přes /predplatne."
                )
                return
            await update.message.reply_text(
                f"Předplatné máš aktivní do {d.day}. {d.month}. {d.year}. Píšeš si bez omezení 💬\n\n"
                "Zrušit ho můžeš kdykoliv v nastavení Telegramu (sekce Telegram Stars)."
            )
            return
        left = max(0, self.settings.free_messages_per_day - self._used_today(user.user_id))
        await update.message.reply_text(
            f"Dnes ti zbývá {left} z {self.settings.free_messages_per_day} zpráv zdarma.\n\n"
            f"S předplatným za {self.settings.subscription_stars} ⭐ měsíčně si s {self.persona.name_instrumental} "
            "můžeš psát bez omezení a občas ti sám pošle i fotku.",
            reply_markup=await self._subscribe_markup(context.bot),
        )

    async def on_precheckout(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.pre_checkout_query
        if query.currency == "XTR" and query.invoice_payload.startswith(f"sub:{self.persona.key}:"):
            await query.answer(ok=True)
        else:
            await query.answer(ok=False, error_message="Tuhle platbu teď nejde dokončit. Zkus to prosím znovu.")

    async def on_paid(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        paid = update.message.successful_payment
        user = self._user(update)
        expires = paid.subscription_expiration_date
        expires_ts = expires.timestamp() if expires else time.time() + SUBSCRIPTION_PERIOD
        self.storage.add_payment(
            paid.telegram_payment_charge_id, user.user_id, self.persona.key, paid.total_amount,
            paid.currency, expires_ts, bool(paid.is_recurring),
        )
        log.info("Platba %s ⭐ od uživatele %s (opakovaná: %s)", paid.total_amount, user.user_id,
                 bool(paid.is_recurring) and not paid.is_first_recurring)
        if paid.is_recurring and not paid.is_first_recurring:
            return  # automatické prodloužení – uživatele zbytečně nerušit
        d = _local(expires_ts)
        await update.message.reply_text(
            f"Díky! Předplatné je aktivní do {d.day}. {d.month}. {d.year}. "
            f"Teď si s {self.persona.name_instrumental} můžeš psát bez omezení 💬"
        )
        for content, image in self._held.pop(user.user_id, []):
            self._accept_message(context.bot, self.storage.get_user(user.user_id, self.persona.key), content, image)

    # --- dlouhodobá paměť ------------------------------------------------------------

    def _start_memory_update(self, user_id: int) -> None:
        self.storage.update_user(user_id, self.persona.key, msgs_since_memory=0)
        task = asyncio.create_task(self._update_memory(user_id))
        self._memory_tasks.add(task)
        task.add_done_callback(self._memory_tasks.discard)

    async def _update_memory(self, user_id: int) -> None:
        user = self.storage.get_user(user_id, self.persona.key)
        if user is None:
            return
        recent = self.storage.recent_messages(user_id, self.persona.key, MEMORY_EVERY * 2)
        try:
            facts = await self.brain.update_memory(self.persona, user.facts, recent, datetime.now(TIMEZONE))
        except BrainError:
            log.exception("Aktualizace paměti selhala")
            return
        if self.storage.get_user(user_id, self.persona.key) is not None:  # mezitím mohl dát /zapomen
            self.storage.update_user(user_id, self.persona.key, facts=facts)
            log.info("Paměť uživatele %s: %d faktů", user_id, len(facts))

    # --- zprávy sám od sebe ------------------------------------------------------------

    async def proactive_tick(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        now = datetime.now(TIMEZONE)
        for user in self.storage.all_users(self.persona.key):
            try:
                await self._maybe_write_first(context.bot, user, now)
            except Exception:
                log.exception("Chyba u zprávy sám od sebe (uživatelka %s)", user.user_id)

    def _proactive_state(self, user: User) -> ProactiveState:
        key = self.persona.key
        return ProactiveState(
            user_id=user.user_id,
            adult=user.age_status == "adult",
            enabled=user.proactive_enabled,
            unanswered_proactive=user.unanswered_proactive,
            last_user_msg=_local(self.storage.last_message_at(user.user_id, key, "user")),
            last_any_msg=_local(self.storage.last_message_at(user.user_id, key)),
            has_unanswered_user_msg=self.storage.latest_user_message_id(user.user_id, key)
            > user.last_answered_user_msg_id,
        )

    async def _maybe_write_first(self, bot, user: User, now: datetime) -> None:
        key = self.persona.key
        if self._in_crisis(user, CRISIS_PROACTIVE_PAUSE_HOURS) or not self._has_quota(user):
            return  # po krizi 3 dny nepíše sám; lidem s vyčerpaným limitem nepíše vůbec
        day = now.date().isoformat()
        sent = {s.name for s in self.persona.slots if self.storage.proactive_sent(user.user_id, key, day, s.name)}
        slot = pick_slot(self.persona, self._proactive_state(user), now, sent)
        if slot is None:
            return
        async with self._lock(user.user_id):
            user = self.storage.get_user(user.user_id, key)
            if user is None or pick_slot(self.persona, self._proactive_state(user), now, sent) is None:
                return  # mezitím se něco změnilo (třeba napsal)
            self.storage.mark_proactive(user.user_id, key, day, slot.name)
            history = self.storage.recent_messages(user.user_id, key, HISTORY_LIMIT)
            text = await self.brain.proactive(
                self.persona, self._dynamic(user, now, proactive_task(slot.hint)), history
            )
            try:
                await self._deliver(bot, user, text, "proactive", now)
            except Forbidden:
                log.info("Uživatelka %s bota zablokovala, vypínám zprávy sám od sebe", user.user_id)
                self.storage.update_user(user.user_id, key, proactive_enabled=False)
                return
            self.storage.update_user(user.user_id, key, unanswered_proactive=user.unanswered_proactive + 1)
            log.info("%s napsal sám od sebe (%s) uživatelce %s", self.persona.name, slot.name, user.user_id)
