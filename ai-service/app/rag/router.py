from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
import os
import tempfile
from app.rag.rag_service import RAGService, DocumentUploadRequest, QueryRequest

router = APIRouter(prefix="/rag", tags=["RAG"])

def get_rag_service():
    return RAGService()

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_type: str = Form(...),
    submitted_by: str = Form(...),
    grade: Optional[int] = Form(None),
    subject: Optional[str] = Form(None),
    instructor_id: Optional[str] = Form(None),
    class_id: Optional[str] = Form(None),
    student_id: Optional[str] = Form(None),
    rag_service: RAGService = Depends(get_rag_service)
):
    try:
        request = DocumentUploadRequest(
            user_type=user_type,
            grade=grade,
            subject=subject,
            instructor_id=instructor_id,
            class_id=class_id,
            student_id=student_id,
            submitted_by=submitted_by
        )
        
        temp_dir = tempfile.mkdtemp()
        # Create a file path with the original name for the preprocessor
        original_named_path = os.path.join(temp_dir, file.filename if file.filename else "uploaded_doc")
        
        content = await file.read()
        with open(original_named_path, "wb") as f:
            f.write(content)
            
        result = rag_service.upload_document(original_named_path, request)
        
        # Cleanup
        os.remove(original_named_path)
        os.rmdir(temp_dir)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query")
async def query_rag(
    request: QueryRequest,
    rag_service: RAGService = Depends(get_rag_service)
):
    try:
        result = rag_service.query(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
