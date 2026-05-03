from fastapi import FastAPI # type: ignore
from app.rag.router import router as rag_router
from app.heatmap.router import router as heatmap_router
from app.quiz_generator.router import router as quiz_router

app = FastAPI(
    title="Gyanavriksha AI Microservice",
    description="OCR, RAG, Grading, Quiz Generation, and Concept Heatmap Engine",
    version="0.1.0",
)

app.include_router(rag_router)
app.include_router(heatmap_router)
app.include_router(quiz_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-microservice"}