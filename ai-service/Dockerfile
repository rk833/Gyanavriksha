FROM python:3.12-slim

ARG APP_PORT=8000
ENV APP_PORT=${APP_PORT}

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy lockfile and project metadata first (better Docker layer caching)
COPY pyproject.toml uv.lock* ./

# Install into the system Python so there is no secondary venv at runtime
RUN uv sync --no-dev --frozen --python /usr/local/bin/python3

COPY . .

EXPOSE ${APP_PORT}

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT}"]
