from fastapi import FastAPI # type: ignore

app = FastAPI(
    title="Gyanavriksha Backend API",
    description="Core API for authentication, submissions, IoT management, and real-time communication",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "backend-api"}