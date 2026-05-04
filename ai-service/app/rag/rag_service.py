import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from langchain_google_vertexai import ChatVertexAI  # noqa: deprecated in LC3.2 but still functional
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_chroma import Chroma
from app.rag.chroma_client import chroma_manager
from app.rag.document_preprocessing import get_document_preprocessor
from app.core.google_auth import configure_google_credentials

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
    subject: Optional[str] = None
    instructor_id: Optional[str] = None
    class_id: Optional[str] = None
    student_id: Optional[str] = None

class RAGService:
    def __init__(self):
        configure_google_credentials()
        # Local embeddings — no API quota, runs on CPU, model downloaded once (~430 MB).
        # BAAI/bge-base-en-v1.5 significantly outperforms MiniLM for retrieval on English text.
        self.embeddings = HuggingFaceEmbeddings(
            model_name="BAAI/bge-base-en-v1.5",
            encode_kwargs={"normalize_embeddings": True},
        )
        # Vertex AI is used only for the LLM (chat/generation), not embeddings.
        self.llm = ChatVertexAI(model_name="gemini-2.5-flash", temperature=0.3)
        self.preprocessor = get_document_preprocessor()
        
        system_prompt = (
            "You are a friendly and knowledgeable AI tutor for a school learning platform in Nepal. "
            "Students ask you questions about their curriculum, lessons, and subjects. "
            "Answer directly, clearly, and helpfully — as a good teacher would. "
            "Do NOT say 'Based on the provided text' or 'According to the context'. "
            "Just answer naturally. "
            "If the student asks to list units, chapters, or topics, list them all that appear in the context. "
            "If the information is not in the context, say you don't have that detail yet and suggest "
            "the student check their textbook for the full list. "
            "\n\nContext from the curriculum:\n{context}"
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
        raw_text = self.preprocessor.extract_text(file_path)
        chunks = self.preprocessor.process(file_path)
        if not chunks:
            raise ValueError("No text could be extracted from the document.")

        # Prepend a synthetic TOC chunk so "list all units" queries get full coverage.
        toc = self.preprocessor.extract_toc(raw_text, source_name=os.path.basename(file_path))
        if toc:
            chunks = [toc] + chunks

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

        langchain_chroma = Chroma(
            client=chroma_manager.client,
            collection_name=collection.name,
            embedding_function=self.embeddings
        )

        # Local embeddings have no API quota — process all chunks in one shot.
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
        
        from langchain_core.documents import Document

        # Subject filter — keeps English queries from returning Computer Science chunks.
        base_filter: dict | None = {"subject": request.subject} if request.subject else None

        # For structural queries fetch the pre-built TOC chunk first so the LLM
        # sees the full document outline, then append semantic chunks for detail.
        structural_keywords = ("list", "all units", "all lessons", "all chapters",
                               "how many units", "how many lessons", "curriculum covers",
                               "what chapters", "what units", "what lessons",
                               "table of content", "topics covered")
        is_structural = any(kw in request.query.lower() for kw in structural_keywords)

        context_docs: list[Document] = []

        if is_structural:
            toc_where: dict = {"chunk_type": {"$eq": "toc"}}
            if request.subject:
                toc_where = {"$and": [{"chunk_type": {"$eq": "toc"}},
                                      {"subject": {"$eq": request.subject}}]}
            toc_raw = langchain_chroma._collection.get(where=toc_where, limit=1)
            if toc_raw and toc_raw.get("documents"):
                context_docs.append(
                    Document(page_content=toc_raw["documents"][0],
                             metadata=(toc_raw.get("metadatas") or [{}])[0])
                )

        # Always supplement with semantically matched chunks.
        search_kwargs: dict = {"k": 15, "fetch_k": 80}
        if base_filter:
            search_kwargs["filter"] = base_filter

        semantic_docs = langchain_chroma.as_retriever(
            search_type="mmr",
            search_kwargs=search_kwargs,
        ).invoke(request.query)

        # TOC first, then semantic results (deduplicated by content).
        seen_content: set[str] = {d.page_content for d in context_docs}
        for doc in semantic_docs:
            if doc.page_content not in seen_content:
                context_docs.append(doc)
                seen_content.add(doc.page_content)

        question_answer_chain = create_stuff_documents_chain(self.llm, self.prompt)
        response = question_answer_chain.invoke({"input": request.query, "context": context_docs})
        
        return {
            "answer": response,
            "context_sources": [
                {"text": doc.page_content, **doc.metadata}
                for doc in context_docs
            ],
        }
