from fastapi import FastAPI  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

from app.api.routes.auth import router as auth_router

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

# Register routers
app.include_router(auth_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "backend-api"}
