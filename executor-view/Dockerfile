FROM python:3.12.14-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir psycopg==3.2.3

COPY server.py ./

ENV EXECUTOR_VIEW_HOST=0.0.0.0 \
    EXECUTOR_VIEW_PORT=8090

CMD ["python", "server.py"]
