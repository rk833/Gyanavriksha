from fastapi import APIRouter, HTTPException, Depends
from app.heatmap.service import HeatmapService, ChatHeatmapSummary
from pydantic import BaseModel

router = APIRouter(prefix="/heatmap", tags=["Heatmap"])

class HeatmapProcessRequest(BaseModel):
    student_id: str
    chat_id: str
    subject: str
    chat_log: str

def get_heatmap_service():
    return HeatmapService()

@router.post("/process", response_model=ChatHeatmapSummary)
async def process_chat_for_heatmap(
    request: HeatmapProcessRequest,
    service: HeatmapService = Depends(get_heatmap_service)
):
    """
    Process a chat log to extract concept-level proficiency scores.
    """
    try:
        summary = await service.generate_summary(
            student_id=request.student_id,
            chat_id=request.chat_id,
            subject=request.subject,
            chat_log=request.chat_log
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")
