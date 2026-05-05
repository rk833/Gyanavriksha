"""FastAPI application factory for the Gyanavriksha backend API."""
import app.core.compat  # noqa: F401 — must be first so future shims run before other imports
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin.presentation.router import router as admin_router
from app.api.auth.presentation.router import router as auth_router
from app.api.instructor.presentation.router import router as instructors_router
from app.api.middleware.rate_limiter import rate_limit_middleware
from app.api.routes.iot_devices import router as iot_router
from app.api.student.presentation.router import router as students_router
from app.api.analytics.presentation.router import router as analytics_router
from app.api.rag.presentation.router import router as rag_router
from app.api.grading.presentation.router import router as grading_router
from app.api.quiz.presentation.router import router as quiz_router
from app.api.ws.student_performance import router as student_performance_ws_router
from app.api.ws.iot_session import router as iot_session_ws_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.db.models.system_setting import SystemSetting

app = FastAPI(
    title="Gyanavriksha API",
    description="AI-powered student assessment and learning analytics platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(rate_limit_middleware)


@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next):
    """Block student/instructor APIs when maintenance mode is active."""
    if settings.ENVIRONMENT.lower() == "testing":
        return await call_next(request)

    path = request.url.path
    protected_prefixes = ("/api/students", "/api/instructor")
    if path.startswith(protected_prefixes):
        db = SessionLocal()
        try:
            setting = db.query(SystemSetting).filter(SystemSetting.key == "maintenance_mode").first()
            enabled = setting and str(setting.value).lower() in {"true", "1", "yes"}
            if enabled:
                return JSONResponse(
                    status_code=503,
                    content={"detail": "maintenance_mode_enabled"},
                )
        finally:
            db.close()
    return await call_next(request)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(instructors_router)
app.include_router(students_router)
app.include_router(analytics_router)
app.include_router(iot_router)
app.include_router(rag_router)
app.include_router(grading_router)
app.include_router(quiz_router)
app.include_router(student_performance_ws_router)
app.include_router(iot_session_ws_router)


@app.on_event("startup")
def _startup_mqtt() -> None:
    """Launch the MQTT subscriber daemon thread on server startup."""
    try:
        from app.mqtt.client import start_mqtt_subscriber
        start_mqtt_subscriber()
    except Exception:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).exception(
            "MQTT subscriber failed to start — IoT features will be unavailable"
        )


@app.on_event("shutdown")
def _shutdown_mqtt() -> None:
    try:
        from app.mqtt.client import stop_mqtt_subscriber
        stop_mqtt_subscriber()
    except Exception:
        pass


@app.get("/health")
async def health_check():
    """Return a liveness probe response for container orchestrators."""
    return {"status": "healthy", "service": "backend-api"}
