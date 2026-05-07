# Gyanavriksha (ज्ञानवृक्ष)

**Gyanavriksha** is a learning ecosystem for Nepal’s secondary education that combines:

- **FastAPI Backend**: Authentication (JWT + RBAC + QR login + email verification), REST APIs, WebSockets, MQTT ingestion, and IoT device management.
- **AI Microservice (FastAPI)**: Image preprocessing, OCR, RAG (curriculum-locked), grading + step-level feedback, knowledge gap detection, micro-quiz generation, and concept heatmap aggregation.
- **PostgreSQL**: Structured relational data (users, submissions, quizzes, IoT telemetry, audit logs).
- **Redis**: Cache / queue / rate limiting store.
- **MQTT Broker (Mosquitto)**: Real-time sensor telemetry streaming for the IoT Smart Desk.
- **Frontend Web (Vite/React)** and **Frontend Mobile (Expo/React Native)**.

This project targets **Students**, **Instructors**, and **Administrators** with role-specific experiences and real-time feedback loops.

## Repository structure

- `backend/`: FastAPI backend API + Alembic migrations + SQLAlchemy models
- `ai-service/`: FastAPI AI microservice (OCR/RAG/grading/quiz/heatmap engines)
- `frontend-web/`: Web dashboard (Vite + React)
- `frontend-mobile/`: Mobile app (Expo + React Native)
- `docker/`: Infrastructure images/config (e.g. Mosquitto)

## Run everything (Docker Compose)

### Prerequisites

- Docker Desktop installed and running

### Start all services

From the repository root (where `docker-compose.yml` lives):

```bash
docker-compose up --build
```

### Stop services

```bash
docker-compose down
```

### Reset everything (including DB volume)

```bash
docker-compose down -v
```

## Service endpoints (default)

- **Frontend Web**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000` (Swagger docs: `http://localhost:8000/docs`)
- **AI Microservice**: `http://localhost:8001` (Swagger docs: `http://localhost:8001/docs`)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **MQTT**: `localhost:1883` (WebSocket: `localhost:9001`)

## Local development (without Docker)

### Prerequisites

- Python **3.12+**
- Node.js **20+**
- PostgreSQL running locally (or run only DB via Docker)
- `uv` installed:

```bash
pip install uv
```

### Backend (FastAPI) + Alembic (local)

```bash
cd backend
uv venv .venv
uv sync

# Run DB migrations
uv run alembic upgrade head

# Start backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### AI microservice (local)

```bash
cd ai-service
uv venv .venv
uv sync

# Start AI service
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend Web (local)

```bash
cd frontend-web
npm install
npm run dev
```

### Frontend Mobile (local)

```bash
cd frontend-mobile
npm install
npm start
```

### Notes

- **Alembic migrations** live in `backend/alembic/versions/`. To create a new migration:

```bash
cd backend
uv run alembic revision --autogenerate -m "describe your change"
uv run alembic upgrade head
```

Each service can also be run directly. See:

- `backend/README.md`
- `ai-service/README.md`
- `frontend-web/README.md`
- `frontend-mobile/README.md`
