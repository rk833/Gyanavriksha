from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from slowapi import _rate_limit_exceeded_handler  # type: ignore
from slowapi.errors import RateLimitExceeded  # type: ignore

from app.api.middleware.rate_limiter import limiter
from app.api.routes.auth import router as auth_router
from app.api.routes.students import router as students_router

app = FastAPI(
    title="Gyanavriksha Backend API",
    description="Core API for authentication, submissions, IoT management, and real-time communication",
    version="0.1.0",
)

# CORS — allow frontend dev server
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

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Register routers
app.include_router(auth_router)
app.include_router(students_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "backend-api"}
