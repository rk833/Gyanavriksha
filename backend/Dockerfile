FROM python:3.12-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy lockfile and project metadata first (better Docker layer caching)
COPY pyproject.toml uv.lock* ./

# Install into the system Python so there is no secondary venv at runtime
RUN uv sync --no-dev --frozen --python /usr/local/bin/python3

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
