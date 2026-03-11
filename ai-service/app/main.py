from fastapi import FastAPI # type: ignore

app = FastAPI(
    title="Gyanavriksha AI Microservice",
    description="OCR, RAG, Grading, Quiz Generation, and Concept Heatmap Engine",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-microservice"}