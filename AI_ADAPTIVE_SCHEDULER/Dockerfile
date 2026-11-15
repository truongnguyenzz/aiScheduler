FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY ingest_service ./ingest_service

CMD ["sh", "-c", "gunicorn --bind :${PORT:-8080} --workers 1 --threads 8 --timeout 120 main:app"]
