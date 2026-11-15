"""Ukládání uživatelů, historie zpráv a paměti do SQLite."""

from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

PROMO_CURRENCY = "PROMO"  # předplatné zdarma pro první uživatele (v tabulce payments, částka 0)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER NOT NULL,
    persona TEXT NOT NULL,
    chat_id INTEGER NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL,
    age_status TEXT NOT NULL DEFAULT 'unknown',      -- unknown | adult | minor
    proactive_enabled INTEGER NOT NULL DEFAULT 1,
    facts TEXT NOT NULL DEFAULT '[]',                -- JSON seznam faktů (dlouhodobá paměť)
    msgs_since_memory INTEGER NOT NULL DEFAULT 0,
    last_answered_user_msg_id INTEGER NOT NULL DEFAULT 0,
    unanswered_proactive INTEGER NOT NULL DEFAULT 0, -- kolik jeho zpráv "sám od sebe" zůstalo bez odpovědi
    crisis_at REAL NOT NULL DEFAULT 0,               -- kdy naposledy psal o krizi (sebevražda, sebepoškozování)
    PRIMARY KEY (user_id, persona)
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    persona TEXT NOT NULL,
    role TEXT NOT NULL,                              -- user | assistant
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'chat',               -- chat | proactive
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages (user_id, persona, id);
CREATE TABLE IF NOT EXISTS payments (
    charge_id TEXT PRIMARY KEY,                      -- telegram_payment_charge_id
    user_id INTEGER NOT NULL,
    persona TEXT NOT NULL,
    amount INTEGER NOT NULL,                         -- počet Stars
    currency TEXT NOT NULL,
    expires_at REAL NOT NULL,                        -- do kdy platí předplatné
    recurring INTEGER NOT NULL DEFAULT 0,
    refunded INTEGER NOT NULL DEFAULT 0,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sent_photos (
    user_id INTEGER NOT NULL,
    persona TEXT NOT NULL,
    photo_id TEXT NOT NULL,
    sent_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS proactive_log (
    user_id INTEGER NOT NULL,
    persona TEXT NOT NULL,
    day TEXT NOT NULL,
    slot TEXT NOT NULL,
    sent_at REAL NOT NULL,
    PRIMARY KEY (user_id, persona, day, slot)
);
"""


@dataclass
class User:
    user_id: int
    persona: str
    chat_id: int
    first_name: str
    created_at: float
    age_status: str
    proactive_enabled: bool
    facts: list[str]
    msgs_since_memory: int
    last_answered_user_msg_id: int
    unanswered_proactive: int
    crisis_at: float = 0.0


@dataclass
class Message:
    id: int
    role: str
    content: str
    kind: str
    created_at: float


class Storage:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        # starší databáze: doplnit nové sloupce
        cols = {r[1] for r in self.db.execute("PRAGMA table_info(users)").fetchall()}
        if "crisis_at" not in cols:
            self.db.execute("ALTER TABLE users ADD COLUMN crisis_at REAL NOT NULL DEFAULT 0")
        self.db.commit()

    # --- uživatelé -----------------------------------------------------------------

    @staticmethod
    def _user(row: sqlite3.Row) -> User:
        return User(
            user_id=row["user_id"],
            persona=row["persona"],
            chat_id=row["chat_id"],
            first_name=row["first_name"],
            created_at=row["created_at"],
            age_status=row["age_status"],
            proactive_enabled=bool(row["proactive_enabled"]),
            facts=json.loads(row["facts"]),
            msgs_since_memory=row["msgs_since_memory"],
            last_answered_user_msg_id=row["last_answered_user_msg_id"],
            unanswered_proactive=row["unanswered_proactive"],
            crisis_at=row["crisis_at"],
        )

    def get_user(self, user_id: int, persona: str) -> User | None:
        row = self.db.execute(
            "SELECT * FROM users WHERE user_id = ? AND persona = ?", (user_id, persona)
        ).fetchone()
        return self._user(row) if row else None

    def get_or_create_user(self, user_id: int, persona: str, chat_id: int, first_name: str) -> User:
        self.db.execute(
            "INSERT OR IGNORE INTO users (user_id, persona, chat_id, first_name, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, persona, chat_id, first_name, time.time()),
        )
        self.db.execute(
            "UPDATE users SET chat_id = ?, first_name = ? WHERE user_id = ? AND persona = ?",
            (chat_id, first_name, user_id, persona),
        )
        self.db.commit()
        user = self.get_user(user_id, persona)
        assert user is not None
        return user

    def update_user(self, user_id: int, persona: str, **fields) -> None:
        if "facts" in fields:
            fields["facts"] = json.dumps(fields["facts"], ensure_ascii=False)
        if "proactive_enabled" in fields:
            fields["proactive_enabled"] = int(fields["proactive_enabled"])
        cols = ", ".join(f"{k} = ?" for k in fields)
        self.db.execute(
            f"UPDATE users SET {cols} WHERE user_id = ? AND persona = ?",
            (*fields.values(), user_id, persona),
        )
        self.db.commit()

    def all_users(self, persona: str) -> list[User]:
        rows = self.db.execute("SELECT * FROM users WHERE persona = ?", (persona,)).fetchall()
        return [self._user(r) for r in rows]

    def delete_user(self, user_id: int, persona: str) -> None:
        """Smaže úplně všechno o uživateli (GDPR – právo na výmaz)."""
        for table in ("messages", "proactive_log", "sent_photos", "users"):
            self.db.execute(
                f"DELETE FROM {table} WHERE user_id = ? AND persona = ?", (user_id, persona)
            )
        self.db.commit()

    # --- zprávy --------------------------------------------------------------------

    def add_message(
        self, user_id: int, persona: str, role: str, content: str, kind: str = "chat",
        created_at: float | None = None,
    ) -> int:
        cur = self.db.execute(
            "INSERT INTO messages (user_id, persona, role, content, kind, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, persona, role, content, kind, created_at or time.time()),
        )
        self.db.commit()
        return int(cur.lastrowid)

    def recent_messages(self, user_id: int, persona: str, limit: int) -> list[Message]:
        rows = self.db.execute(
            "SELECT id, role, content, kind, created_at FROM messages "
            "WHERE user_id = ? AND persona = ? ORDER BY id DESC LIMIT ?",
            (user_id, persona, limit),
        ).fetchall()
        return [Message(**dict(r)) for r in reversed(rows)]

    def count_messages(self, user_id: int, persona: str) -> int:
        return self.db.execute(
            "SELECT COUNT(*) FROM messages WHERE user_id = ? AND persona = ?", (user_id, persona)
        ).fetchone()[0]

    def last_message_at(self, user_id: int, persona: str, role: str | None = None) -> float | None:
        sql = "SELECT MAX(created_at) FROM messages WHERE user_id = ? AND persona = ?"
        args: tuple = (user_id, persona)
        if role:
            sql += " AND role = ?"
            args += (role,)
        return self.db.execute(sql, args).fetchone()[0]

    def count_user_messages_since(self, user_id: int, persona: str, since: float) -> int:
        return self.db.execute(
            "SELECT COUNT(*) FROM messages WHERE user_id = ? AND persona = ? AND role = 'user' "
            "AND kind != 'free' AND created_at >= ?",
            (user_id, persona, since),
        ).fetchone()[0]

    def user_messages_after_last_proactive(self, user_id: int, persona: str) -> int | None:
        """Kolik zpráv napsala od jeho poslední zprávy „sám od sebe“ (None = žádná taková není)."""
        row = self.db.execute(
            "SELECT MAX(id) FROM messages WHERE user_id = ? AND persona = ? AND role = 'assistant' AND kind = 'proactive'",
            (user_id, persona),
        ).fetchone()
        if not row or row[0] is None:
            return None
        return self.db.execute(
            "SELECT COUNT(*) FROM messages WHERE user_id = ? AND persona = ? AND role = 'user' AND id > ?",
            (user_id, persona, row[0]),
        ).fetchone()[0]

    def latest_user_message_id(self, user_id: int, persona: str) -> int:
        return self.db.execute(
            "SELECT COALESCE(MAX(id), 0) FROM messages WHERE user_id = ? AND persona = ? AND role = 'user'",
            (user_id, persona),
        ).fetchone()[0]

    # --- odeslané fotky ------------------------------------------------------------

    def mark_photo_sent(self, user_id: int, persona: str, photo_id: str) -> None:
        self.db.execute(
            "INSERT INTO sent_photos (user_id, persona, photo_id, sent_at) VALUES (?, ?, ?, ?)",
            (user_id, persona, photo_id, time.time()),
        )
        self.db.commit()

    def sent_photo_ids(self, user_id: int, persona: str) -> set[str]:
        rows = self.db.execute(
            "SELECT photo_id FROM sent_photos WHERE user_id = ? AND persona = ?", (user_id, persona)
        ).fetchall()
        return {r[0] for r in rows}

    def last_photo_sent_at(self, user_id: int, persona: str) -> float | None:
        return self.db.execute(
            "SELECT MAX(sent_at) FROM sent_photos WHERE user_id = ? AND persona = ?", (user_id, persona)
        ).fetchone()[0]

    def photos_sent_since(self, user_id: int, persona: str, since: float) -> int:
        return self.db.execute(
            "SELECT COUNT(*) FROM sent_photos WHERE user_id = ? AND persona = ? AND sent_at >= ?",
            (user_id, persona, since),
        ).fetchone()[0]

    # --- platby (předplatné za Telegram Stars) --------------------------------------
    # Platby se při /zapomen nemažou: jsou to účetní záznamy a předplatné má platit dál.

    def add_payment(
        self, charge_id: str, user_id: int, persona: str, amount: int, currency: str,
        expires_at: float, recurring: bool,
    ) -> None:
        self.db.execute(
            "INSERT OR REPLACE INTO payments (charge_id, user_id, persona, amount, currency, expires_at, "
            "recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (charge_id, user_id, persona, amount, currency, expires_at, int(recurring), time.time()),
        )
        self.db.commit()

    def premium_until(self, user_id: int, persona: str) -> float:
        return self.db.execute(
            "SELECT COALESCE(MAX(expires_at), 0) FROM payments WHERE user_id = ? AND persona = ? AND refunded = 0",
            (user_id, persona),
        ).fetchone()[0]

    def last_payment(self, user_id: int, persona: str) -> sqlite3.Row | None:
        return self.db.execute(
            "SELECT * FROM payments WHERE user_id = ? AND persona = ? ORDER BY created_at DESC LIMIT 1",
            (user_id, persona),
        ).fetchone()

    def grant_promo(self, user_id: int, persona: str, expires_at: float, limit: int) -> bool:
        """Předplatné zdarma pro prvních `limit` uživatelů. Uloží se jako platba za 0 v měně PROMO.

        Každý ho dostane nejvýš jednou; záznam zůstává i po /zapomen, takže se místo neuvolní.
        Kontrola počtu i zápis jsou v jednom příkazu, dva souběžní uživatelé limit nepřekročí.
        """
        charge_id = f"promo:{persona}:{user_id}"
        cur = self.db.execute(
            "INSERT INTO payments (charge_id, user_id, persona, amount, currency, expires_at, recurring, created_at) "
            "SELECT ?, ?, ?, 0, ?, ?, 0, ? "
            "WHERE (SELECT COUNT(*) FROM payments WHERE persona = ? AND currency = ?) < ? "
            "AND NOT EXISTS (SELECT 1 FROM payments WHERE charge_id = ?)",
            (charge_id, user_id, persona, PROMO_CURRENCY, expires_at, time.time(),
             persona, PROMO_CURRENCY, limit, charge_id),
        )
        self.db.commit()
        return cur.rowcount == 1

    def promo_until(self, user_id: int, persona: str) -> float:
        return self.db.execute(
            "SELECT COALESCE(MAX(expires_at), 0) FROM payments "
            "WHERE user_id = ? AND persona = ? AND currency = ? AND refunded = 0",
            (user_id, persona, PROMO_CURRENCY),
        ).fetchone()[0]

    def mark_refunded(self, charge_id: str) -> None:
        self.db.execute("UPDATE payments SET refunded = 1 WHERE charge_id = ?", (charge_id,))
        self.db.commit()

    # --- zprávy "sám od sebe" ----------------------------------------------------

    def proactive_sent(self, user_id: int, persona: str, day: str, slot: str) -> bool:
        return (
            self.db.execute(
                "SELECT 1 FROM proactive_log WHERE user_id = ? AND persona = ? AND day = ? AND slot = ?",
                (user_id, persona, day, slot),
            ).fetchone()
            is not None
        )

    def mark_proactive(self, user_id: int, persona: str, day: str, slot: str) -> None:
        self.db.execute(
            "INSERT OR REPLACE INTO proactive_log (user_id, persona, day, slot, sent_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, persona, day, slot, time.time()),
        )
        self.db.commit()
