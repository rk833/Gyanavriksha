import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_chroma import Chroma
from app.rag.chroma_client import chroma_manager
from app.rag.document_preprocessing import get_document_preprocessor

class DocumentUploadRequest(BaseModel):
    user_type: str  # admin, instructor, student
    grade: Optional[int] = None
    subject: Optional[str] = None
    instructor_id: Optional[str] = None
    class_id: Optional[str] = None
    student_id: Optional[str] = None
    submitted_by: str

class QueryRequest(BaseModel):
    user_type: str  # admin, instructor, student
    query: str
    grade: Optional[int] = None
    instructor_id: Optional[str] = None
    class_id: Optional[str] = None
    student_id: Optional[str] = None

class RAGService:
    def __init__(self):
        # Using Gemini models via LangChain
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.3)
        self.preprocessor = get_document_preprocessor()
        
        system_prompt = (
            "You are an AI assistant for a learning platform. "
            "Use the following pieces of retrieved context to answer the user's question. "
            "If you don't know the answer, just say that you don't know. "
            "Context: {context}"
        )
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])

    def get_collection(self, user_type: str, grade: Optional[int] = None, instructor_id: Optional[str] = None, class_id: Optional[str] = None, student_id: Optional[str] = None):
        if user_type == "admin":
            if not grade:
                raise ValueError("Grade is required for admin collection.")
            return chroma_manager.get_admin_collection(grade)
        elif user_type == "instructor":
            if not instructor_id or not class_id:
                raise ValueError("instructor_id and class_id are required for instructor collection.")
            return chroma_manager.get_or_create_instructor_collection(instructor_id, class_id)
        elif user_type == "student":
            if not student_id:
                raise ValueError("student_id is required for student collection.")
            return chroma_manager.get_or_create_student_collection(student_id)
        else:
            raise ValueError(f"Unknown user type: {user_type}")

    def upload_document(self, file_path: str, request: DocumentUploadRequest):
        chunks = self.preprocessor.process(file_path)
        if not chunks:
            raise ValueError("No text could be extracted from the document.")

        collection = self.get_collection(
            user_type=request.user_type,
            grade=request.grade,
            instructor_id=request.instructor_id,
            class_id=request.class_id,
            student_id=request.student_id
        )

        texts = [chunk["text"] for chunk in chunks]
        
        # Build metadata for each chunk
        from datetime import datetime
        base_metadata = {
            "submitted_by": request.submitted_by,
            "file_name": os.path.basename(file_path),
            "submission_date": datetime.now().isoformat()
        }
        if request.grade:
            base_metadata["grade"] = request.grade
        if request.subject:
            base_metadata["subject"] = request.subject
        if request.instructor_id and request.subject:
            # According to ChromaDB.md, instructor metadata needs instructor_subject_id
            base_metadata["instructor_subject_id"] = f"{request.instructor_id}_{request.subject}"

        metadatas = []
        for chunk in chunks:
            meta = base_metadata.copy()
            meta.update(chunk["metadata"])
            # ChromaDB doesn't like None values or complex types in metadata, so clean it
            meta = {k: v for k, v in meta.items() if v is not None}
            metadatas.append(meta)
            
        ids = [f"{os.path.basename(file_path)}_{i}" for i in range(len(chunks))]

        # Wrap the collection with Langchain's Chroma wrapper
        langchain_chroma = Chroma(
            client=chroma_manager.client,
            collection_name=collection.name,
            embedding_function=self.embeddings
        )
        
        langchain_chroma.add_texts(texts=texts, metadatas=metadatas, ids=ids)
        return {"status": "success", "chunks_added": len(chunks), "collection": collection.name}

    def query(self, request: QueryRequest):
        collection = self.get_collection(
            user_type=request.user_type,
            grade=request.grade,
            instructor_id=request.instructor_id,
            class_id=request.class_id,
            student_id=request.student_id
        )
        
        langchain_chroma = Chroma(
            client=chroma_manager.client,
            collection_name=collection.name,
            embedding_function=self.embeddings
        )
        
        retriever = langchain_chroma.as_retriever(search_kwargs={"k": 4})
        
        question_answer_chain = create_stuff_documents_chain(self.llm, self.prompt)
        rag_chain = create_retrieval_chain(retriever, question_answer_chain)
        
        response = rag_chain.invoke({"input": request.query})
        
        return {
            "answer": response["answer"],
            "context_sources": [
                {"text": doc.page_content, **doc.metadata} 
                for doc in response["context"]
            ]
        }
