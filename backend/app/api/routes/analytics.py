from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
from app.api.middleware.auth import get_current_user
from app.core.database import get_db
from app.services.heatmap_service import process_chat_heatmap
from app.db.models.concept_heatmap_entry import ConceptHeatmapEntry

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.post("/process-chat/{history_id}")
async def trigger_chat_processing(
    history_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # current_user = Depends(get_current_user) # Authentication
):
    """
    Manually trigger processing of a chat history for heatmap generation.
    In production, this would be called automatically when a chat ends.
    """
    background_tasks.add_task(process_chat_heatmap, db, history_id)
    return {"message": "Chat processing started in background"}

@router.get("/heatmap/{student_id}")
async def get_student_heatmap(
    student_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """
    Returns the heatmap data for a student.
    """
    entries = db.query(ConceptHeatmapEntry).filter(
        ConceptHeatmapEntry.student_id == student_id
    ).all()
    
    return [
        {
            "subject_id": e.subject_id,
            "concept_name": e.concept_name,
            "topic_tag": e.topic_tag,
            "occurrence_count": e.occurrence_count,
            "proficiency_score": e.proficiency_score,
            "last_updated_at": e.last_updated_at
        }
        for e in entries
    ]
