from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.rag.rag_service import RAGService, QueryRequest
import os

class GeneratedQuestion(BaseModel):
    question_text: str = Field(description="The text of the question")
    question_type: str = Field(description="The type of question (mcq, short_answer)")
    options: Optional[List[str]] = Field(default=None, description="List of options for MCQ questions")
    correct_answer: str = Field(description="The correct answer text")
    explanation: Optional[str] = Field(default=None, description="Explanation for the correct answer")
    difficulty: str = Field(description="Difficulty level (EASY, MEDIUM, HARD)")

class GeneratedQuiz(BaseModel):
    concept_targeted: str
    questions: List[GeneratedQuestion]

class QuizGeneratorService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)
        self.rag_service = RAGService()
        self.parser = JsonOutputParser(pydantic_object=List[GeneratedQuestion])
        
        system_prompt = (
            "You are an expert educator and assessment designer. Your task is to generate high-quality "
            "quiz questions based on the provided educational context. "
            "\n\n"
            "Guidelines:\n"
            "1. Questions must be factually accurate and based on the provided context.\n"
            "2. For MCQ (Multiple Choice Questions), provide exactly 4 options.\n"
            "3. Ensure the 'correct_answer' exactly matches one of the options for MCQs.\n"
            "4. Provide a clear 'explanation' for why the answer is correct.\n"
            "5. Vary the 'difficulty' among EASY, MEDIUM, and HARD.\n"
            "6. The 'question_type' must be either 'mcq' or 'short_answer'.\n"
            "\n"
            "Format the output as a JSON list of objects matching the schema.\n"
            "{format_instructions}"
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Generate {num_questions} questions for the concept '{concept}' using the following context:\n\n{context}"),
        ])

    async def generate_quiz(
        self, 
        concept: str, 
        num_questions: int = 5,
        user_type: str = "admin",
        grade: Optional[int] = None,
        instructor_id: Optional[str] = None,
        class_id: Optional[str] = None,
        student_id: Optional[str] = None
    ) -> GeneratedQuiz:
        """
        Generates a quiz by first retrieving relevant context via RAG and then using LLM to generate questions.
        """
        # 1. Retrieve context via RAG
        # We query for the concept to get relevant documents
        query_request = QueryRequest(
            user_type=user_type,
            query=f"Comprehensive information about {concept}",
            grade=grade,
            instructor_id=instructor_id,
            class_id=class_id,
            student_id=student_id
        )
        
        # Use RAG to get context. We use the internal query logic but might want raw documents.
        # RAGService.query returns answer + context_sources. 
        # For quiz generation, the retrieved context is more important than the AI's summary.
        
        # Since RAGService.query is synchronous, we call it directly (or wrap it)
        rag_response = self.rag_service.query(query_request)
        
        # Combine retrieved context pieces
        context_text = "\n\n".join([src.get("text", "") for src in rag_response.get("context_sources", [])])
        
        # If no context found, we might want to fallback to LLM general knowledge or error out
        if not context_text:
            context_text = f"Generate questions based on general knowledge about {concept}."

        # 2. Generate questions using LLM
        chain = self.prompt | self.llm | self.parser
        
        questions_data = await chain.ainvoke({
            "num_questions": num_questions,
            "concept": concept,
            "context": context_text,
            "format_instructions": self.parser.get_format_instructions()
        })
        
        # 3. Return structured quiz
        return GeneratedQuiz(
            concept_targeted=concept,
            questions=[GeneratedQuestion(**q) for q in questions_data]
        )
