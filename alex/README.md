# Alex – AI přítel na Telegramu (@AlexPraha_bot)

Mužská obdoba Terezy (@Terezzka_bot). Vychází z jejího kódu (stav 14. 11. 2026), Tereza sama běží dál zvlášť
a tenhle kód se jí netýká. Zadání postavy a fotky: `C:\Users\tomas\Pictures\Projekty\jede.online\AI přitelkyně\ALEX`.

## Co je jinak než u Terezy

| | |
|---|---|
| Postava | Alex, 45, Praha (Letná), manažer v korporátu, romantik. Rozvedený, děti Ema (11) a Vojta (brzy 6) – `app/persona.py` |
| Pro koho | ženy – všechny texty bota i pokyny pro AI ji oslovují v ženském rodě |
| Týden s dětmi | střídavá péče po týdnu (pondělí–neděle, od 9. 11. 2026 s dětmi). Mění, o čem mluví a kdy píše – `has_kids`, `family_lines` |
| Psaní sám od sebe | častěji: ráno, v poledne, podvečer (jen bez dětí), večer (s dětmi až po uložení). Pravidla proti spamu stejná |
| Kalendář | víkendy a státní svátky (i Velikonoce) = volno, žádné porady; blížící se Vánoce, Silvestr, Valentýn a další dny; letní a vánoční prázdniny dětí – `app/calendar_cz.py` |
| Setkání | nikdy nenabízí procházky, rande ani jiné setkání, ani jako představu (pravidlo 2 v `app/prompts.py`) |
| Počasí | Praha (MET Norway) |
| Fotky | `photos/alex/` + `photos.json`. Bot posílá jen ty, jejichž soubor existuje. Zadání: `JAK_NA_FOTKY.md` ve složce ALEX |
| Placení | `PAYMENTS_ENABLED=0` = zkušební provoz zdarma: bez limitu, v menu nic o platbách. `1` zapne limit a předplatné jako u Terezy |
| Mozek | DeepSeek (`LLM_PROVIDER=deepseek`), přepnutí na Claude jednou proměnnou |

## Server (jede.online, Docker)

| Co | Kde |
|---|---|
| Kód | `/opt/jede/alex-src` (compose projekt `alex`, kontejner `alex-bot-1`) |
| Klíče | `/opt/jede/alex.env` (chmod 600), v kódu na něj odkazuje `.env` |
| Databáze | `/opt/jede/alex-data/alex.db` (vlastník uid 10001) |

- **Nasazení:** `sh alex/deploy.sh` – nahraje kód, sestaví obraz, pustí testy v dočasném kontejneru a teprve pak vymění běžící verzi.
- **Logy:** `ssh root@178.104.231.220 "cd /opt/jede/alex-src && docker compose logs -f --tail 50"`
- **Nový token:** `ssh -t root@178.104.231.220 "cd /opt/jede/alex-src && python3 nastaveni.py --telegram"`, pak restart.
- **Návrat k předchozí verzi:**
  ```bash
  cd /opt/jede && rm -rf alex-src.vadna && mv alex-src alex-src.vadna && mv alex-src.stara alex-src
  docker tag alex-bot:stara alex-bot:latest && cd alex-src && docker compose up -d --no-build --force-recreate
  ```

## Testy lokálně

```bash
python -m pip install -r requirements.txt pytest
python -m pytest
```

`python chat_v_terminalu.py` je chat s Alexem v terminálu, bez Telegramu (potřebuje `.env` s klíčem k modelu).
