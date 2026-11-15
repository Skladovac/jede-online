"""Průvodce nastavením: vytvoří soubor .env a zeptá se na chybějící klíče.

Na serveru: python3 nastaveni.py --telegram (zadání nového tokenu).
  python nastaveni.py                -> zeptá se na model (Claude/DeepSeek) a jeho klíč
  python nastaveni.py --telegram     -> potřebuje i token Telegram bota
  python nastaveni.py --zmenit-model -> znovu se zeptá, který model použít
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV = ROOT / ".env"
EXAMPLE = ROOT / ".env.example"

CLAUDE_RE = re.compile(r"^sk-ant-[A-Za-z0-9_\-]{20,}$")
TELEGRAM_RE = re.compile(r"^\d{5,}:[A-Za-z0-9_\-]{20,}$")
DEEPSEEK_RE = re.compile(r"^sk-[A-Za-z0-9]{16,}$")
PLACEHOLDER_RE = re.compile(r"x{8,}", re.IGNORECASE)  # ukázkové hodnoty typu sk-ant-xxxxxxxx


def is_valid(value: str, pattern: re.Pattern) -> bool:
    return bool(pattern.match(value)) and not PLACEHOLDER_RE.search(value)


def read_env() -> tuple[list[str], bool]:
    """Vrátí řádky .env a příznak, jestli soubor potřebuje přepsat (BOM z Poznámkového bloku)."""
    if not ENV.exists():
        stray = ROOT / ".env.txt"  # častá chyba na Windows (Poznámkový blok přidá .txt)
        if stray.exists():
            stray.rename(ENV)
            print("Soubor .env.txt jsem přejmenoval na .env.")
        else:
            shutil.copyfile(EXAMPLE, ENV)
    raw = ENV.read_bytes()
    has_bom = raw.startswith(b"\xef\xbb\xbf")  # knihovna dotenv by pak první klíč nenašla
    return raw.decode("utf-8-sig").splitlines(), has_bom


def get_value(lines: list[str], key: str) -> str:
    for line in lines:
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    return ""


def set_value(lines: list[str], key: str, value: str) -> list[str]:
    out, done = [], False
    for line in lines:
        if line.startswith(f"{key}="):
            out.append(f"{key}={value}")
            done = True
        else:
            out.append(line)
    if not done:
        out.append(f"{key}={value}")
    return out


def ask(prompt: str, pattern: re.Pattern, hint: str) -> str:
    while True:
        try:
            value = input(prompt).strip().strip('"').strip("'")
        except EOFError:
            sys.exit(1)
        if is_valid(value, pattern):
            return value
        print(f"  To nevypadá správně. {hint} Zkus to znovu (vložíš pravým tlačítkem myši nebo Ctrl+V).")


def ask_provider() -> str:
    print("\nKterý AI model má Alexe pohánět?")
    print("  1 = Claude Haiku (doporučeno)")
    print("  2 = DeepSeek (využiješ kredit; zprávy jdou na servery v Číně, takže hlavně na testování)")
    while True:
        try:
            choice = input("Napiš 1 nebo 2 a stiskni Enter: ").strip()
        except EOFError:
            sys.exit(1)
        if choice in ("1", "2"):
            return "claude" if choice == "1" else "deepseek"


def main() -> None:
    need_telegram = "--telegram" in sys.argv
    lines, changed = read_env()

    provider = get_value(lines, "LLM_PROVIDER").lower()
    if not provider:  # starší nastavení na serveru: AI_PROVIDER=deepseek | anthropic
        provider = {"anthropic": "claude"}.get(get_value(lines, "AI_PROVIDER").lower(), get_value(lines, "AI_PROVIDER").lower())
        if provider in ("claude", "deepseek"):
            lines = set_value(lines, "LLM_PROVIDER", provider)
            changed = True
    if "--zmenit-model" in sys.argv or provider not in ("claude", "deepseek"):
        provider = ask_provider()
        lines = set_value(lines, "LLM_PROVIDER", provider)
        changed = True

    if provider == "claude" and not is_valid(get_value(lines, "ANTHROPIC_API_KEY"), CLAUDE_RE):
        print("\nPotřebuju API klíč pro Claude (z platform.claude.com, sekce API Keys).")
        key = ask("Vlož klíč a stiskni Enter: ", CLAUDE_RE, "Klíč začíná na sk-ant-.")
        lines = set_value(lines, "ANTHROPIC_API_KEY", key)
        changed = True

    if provider == "deepseek" and not is_valid(get_value(lines, "DEEPSEEK_API_KEY"), DEEPSEEK_RE):
        print("\nPotřebuju API klíč pro DeepSeek (z platform.deepseek.com, sekce API Keys).")
        key = ask("Vlož klíč a stiskni Enter: ", DEEPSEEK_RE, "Klíč začíná na sk- a pokračuje písmeny a čísly.")
        lines = set_value(lines, "DEEPSEEK_API_KEY", key)
        changed = True

    if need_telegram and not is_valid(get_value(lines, "TELEGRAM_BOT_TOKEN"), TELEGRAM_RE):
        print("\nPotřebuju token Telegram bota (od @BotFather, vypadá jako 123456789:AAH...).")
        token = ask("Vlož token a stiskni Enter: ", TELEGRAM_RE, "Token má tvar číslo:dlouhý_text.")
        lines = set_value(lines, "TELEGRAM_BOT_TOKEN", token)
        changed = True

    if changed:
        ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("Nastavení je uložené v souboru .env. Příště už se ptát nebudu.")
        print("Model změníš příkazem: python nastaveni.py --zmenit-model\n")


if __name__ == "__main__":
    main()
