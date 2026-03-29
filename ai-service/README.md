## AI Microservice (FastAPI)

This service handles OCR, RAG, grading/feedback generation, adaptive micro-quiz generation, and concept heatmap aggregation.

## Run via Docker Compose (recommended)

This repository provides a full-stack `docker-compose.yml` in the project root.

### 1. Start all services

From the **project root**:

```bash
docker-compose up --build
```

AI microservice will be available at:

- `http://localhost:8001`
- Swagger docs: `http://localhost:8001/docs`
- Health: `http://localhost:8001/health`

### 2. View AI microservice logs

```bash
docker-compose logs -f ai-service
```

## Run locally (with `uv`)

### 1. Install `uv` (once per machine)

```bash
pip install uv
```

### 2. Install dependencies and start the service

```bash
cd ai-service
uv venv .venv
uv sync

uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:

- `http://localhost:8000/docs`
- `http://localhost:8000/health`

