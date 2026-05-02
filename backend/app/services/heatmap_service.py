import uuid
import httpx
import os
from sqlalchemy.orm import Session
from app.db.models.chat_history import ChatHistory
from app.db.models.concept_heatmap_entry import ConceptHeatmapEntry
from app.db.models.user import User
from app.db.models.subject import Subject
from datetime import datetime

AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8000")

async def process_chat_heatmap(db: Session, history_id: uuid.UUID):
    """
    1. Fetch chat history record.
    2. Read chat log from file.
    3. Call AI Service to get concept summary.
    4. Save summary to DB.
    5. Update ConceptHeatmapEntry table.
    """
    # 1. Fetch record
    chat = db.query(ChatHistory).filter(ChatHistory.history_id == history_id).first()
    if not chat:
        raise ValueError(f"Chat history {history_id} not found")

    # 2. Read chat log
    if not os.path.exists(chat.file_path):
        raise FileNotFoundError(f"Chat log file not found: {chat.file_path}")
    
    with open(chat.file_path, "r", encoding="utf-8") as f:
        chat_log = f.read()

    # Get subject name
    subject = db.query(Subject).filter(Subject.subject_id == chat.subject_id).first()
    subject_name = subject.subject_name if subject else "Unknown"

    # 3. Call AI Service
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AI_SERVICE_URL}/heatmap/process",
            json={
                "student_id": str(chat.student_id),
                "chat_id": str(chat.history_id),
                "subject": subject_name,
                "chat_log": chat_log
            },
            timeout=60.0
        )
        
        if response.status_code != 200:
            raise Exception(f"AI Service failed: {response.text}")
        
        summary_data = response.json()

    # 4. Save summary to DB
    chat.summary = summary_data
    db.commit()

    # 5. Update ConceptHeatmapEntry
    student = db.query(User).filter(User.user_id == chat.student_id).first()
    grade_id = student.grade_id if student else 1 # Default to 1 if not found

    for concept in summary_data.get("concepts", []):
        concept_name = concept["concept_name"]
        topic_tag = concept["topic_tag"]
        proficiency = concept["proficiency"]

        # Upsert logic for ConceptHeatmapEntry
        entry = db.query(ConceptHeatmapEntry).filter(
            ConceptHeatmapEntry.student_id == chat.student_id,
            ConceptHeatmapEntry.subject_id == chat.subject_id,
            ConceptHeatmapEntry.topic_tag == topic_tag
        ).first()

        if entry:
            # Update existing: Average the proficiency or update it?
            # Usually we update it to the latest or keep a running average.
            # Let's update it and increment occurrence count.
            entry.occurrence_count += 1
            # Simple running average: (old * count + new) / (count + 1)
            # Actually, if we just want the latest mastery, we update it.
            # But the vision says "average of each heat map".
            if entry.proficiency_score is not None:
                entry.proficiency_score = (entry.proficiency_score * (entry.occurrence_count - 1) + proficiency) / entry.occurrence_count
            else:
                entry.proficiency_score = proficiency
            entry.last_updated_at = datetime.utcnow()
        else:
            new_entry = ConceptHeatmapEntry(
                student_id=chat.student_id,
                subject_id=chat.subject_id,
                grade_id=grade_id,
                concept_name=concept_name,
                topic_tag=topic_tag,
                occurrence_count=1,
                proficiency_score=proficiency
            )
            db.add(new_entry)

    db.commit()
    return summary_data
