# Alex – Telegram bot v kontejneru (server jede.online, /opt/jede/alex-src)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
# tzdata: časové pásmo Europe/Prague i v minimálním obrazu
RUN pip install --no-cache-dir -r requirements.txt tzdata

COPY app ./app
COPY photos ./photos
COPY run_bot.py .

# uid 10001 musí sedět s vlastníkem /opt/jede/alex-data, jinak se do databáze nezapíše
RUN useradd --system --uid 10001 bot
USER bot

CMD ["python", "run_bot.py"]
