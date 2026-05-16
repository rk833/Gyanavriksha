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

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Step 1 — Start all containers

From the repository root (where `docker-compose.yml` lives):

```bash
docker compose up --build -d
```

Wait until Postgres and Redis are healthy and the backend container has started (often ~20 seconds on first run).

### Step 2 — Database setup (run once, or after a fresh DB)

Apply migrations and seed demo users/data:

```bash
docker compose exec backend uv run alembic upgrade head
docker compose exec backend uv run python -m app.scripts.seed_demo_data
```

Optional — index curriculum PDFs into ChromaDB for AI/RAG features:

```bash
docker compose exec backend uv run python -m app.scripts.index_curriculum_docs
```

Without **migrations** and **seed**, the web app may fail on login or show empty data.

### Step 3 — Open the app and sign in

Open the web dashboard in your browser:

**http://localhost:5173**

Demo accounts (created by `seed_demo_data`):

| Role | Email | Password |
|------|--------|----------|
| Student | `student@gyanavriksha.edu.np` | `Student@1234` |
| Instructor | `instructor@gyanavriksha.edu.np` | `Instructor@1234` |
| Admin | `admin@gyanavriksha.edu.np` | `Admin@1234` |

Additional cohort users (e.g. `g9student01@gyanavriksha.edu.np`) use the same password as the main demo student unless you changed the seed script.

### Verify containers

```bash
docker compose ps
```

All services should show **running**. If the backend fails, inspect logs:

```bash
docker compose logs backend -f
```

### Service endpoints (default)

| Service | URL |
|---------|-----|
| **Frontend Web** (main UI) | http://localhost:5173 |
| **Backend API** | http://localhost:8000 |
| **Backend Swagger** | http://localhost:8000/docs |
| **Backend health** | http://localhost:8000/health |
| **AI microservice** | http://localhost:8001 |
| **AI Swagger** | http://localhost:8001/docs |
| **PostgreSQL** | `localhost:5432` (db: `gyanavriksha`, user/pass: `postgres` / `postgres`) |
| **Redis** | `localhost:6379` |
| **MQTT** | `localhost:1883` (WebSocket: `localhost:9001`) |

### Mobile app (optional)

The `frontend-mobile` container runs Expo with a tunnel. **`docker compose logs` usually does not show the QR** (non-interactive output). Use one of these instead:

**Option A — Expo Dev Tools in the browser (easiest)**

Open **http://localhost:8081** on your PC. The page shows a QR code and the `exp://…` URL. Scan with **Expo Go** on your phone.

**Option B — Interactive shell inside the container**

From the repository root (Git Bash or similar):

If port 8081 is already in use by the background container, restart it first:

```bash
docker compose restart frontend-mobile
```

Wait a few seconds, then start Expo with a TTY so the QR can render:

```bash
docker compose exec -it frontend-mobile npx expo start --tunnel
```

The `-it` flags attach a real terminal; the QR often appears there. Press `Ctrl+C` when finished.

**Logs only (QR may be missing)**

```bash
docker compose logs frontend-mobile -f
```

You should see `Tunnel connected` / `Tunnel ready` even when no QR is printed. Use Option A or B to connect.

Set `EXPO_PUBLIC_API_BASE_URL` in `frontend-mobile/.env` to your PC’s LAN IP (e.g. `http://192.168.1.100:8000`) so the phone can reach the backend. See `frontend-mobile/README.md`.

For day-to-day development on a PC, the web UI at **http://localhost:5173** is usually simpler than mobile.

### Stop services

```bash
docker compose down
```

### Reset everything (including DB volume)

```bash
docker compose down -v
```

After a reset, run **Step 2** again before logging in.

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

#### Physical Android device (recommended for microphone / speech features)

Use a development build instead of Expo Go:

```bash
cd frontend-mobile
npx expo run:android --device
```

If Metro is not reachable from your phone, set your machine LAN IP before running:

```bash
# Git Bash
export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.110.123
npx expo run:android --device
```

```powershell
# PowerShell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.110.123"
npx expo run:android --device
```

Also set mobile API base URL in `frontend-mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.110.123:8000
```

> Replace `192.168.110.123` with your computer's current LAN IP.
> For this project, microphone speech input works in dev build and not in Expo Go.

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
