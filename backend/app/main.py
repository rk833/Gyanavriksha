"""FastAPI application factory for the Gyanavriksha backend API."""
import app.core.compat  # noqa: F401 — must be first to patch bcrypt before passlib loads
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin.presentation.router import router as admin_router
from app.api.auth.presentation.router import router as auth_router
from app.api.instructor.presentation.router import router as instructors_router
from app.api.middleware.rate_limiter import rate_limit_middleware
from app.api.student.presentation.router import router as students_router

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

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(instructors_router)
app.include_router(students_router)


@app.get("/health")
async def health_check():
    """Return a liveness probe response for container orchestrators."""
    return {"status": "healthy", "service": "backend-api"}
