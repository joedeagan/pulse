FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create data directory and seed with existing JSON files
RUN mkdir -p /data && \
    for f in api/subscribers.json api/market_snapshots.json api/alerts_history.json api/clicks.json; do \
      [ -f "$f" ] && cp "$f" /data/ || true; \
    done

EXPOSE 8080

CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080"]
