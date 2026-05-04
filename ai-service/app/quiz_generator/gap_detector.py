from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from langchain_google_vertexai import ChatVertexAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from app.core.google_auth import configure_google_credentials

class IdentifiedGap(BaseModel):
    concept_name: str
    topic_tag: str
    description: str
    suggested_difficulty: str  # EASY, MEDIUM, HARD
    evidence_snippet: str  # Short snippet from chat log proving the gap

class GapAnalysisResult(BaseModel):
    student_id: str
    subject: str
    gaps: List[IdentifiedGap]

class QuizGapDetector:
    def __init__(self):
        configure_google_credentials()
        self.llm = ChatVertexAI(model_name="gemini-2.5-flash", temperature=0.2)
        self.parser = JsonOutputParser(pydantic_object=GapAnalysisResult)
        
        system_prompt = (
            "You are an educational diagnostic expert. Your task is to analyze a student's chat history "
            "and identify specific concepts where they lack expertise or show significant confusion. "
            "\n\n"
            "For each identified gap:\n"
            "1. Provide the 'concept_name' and a slug-like 'topic_tag'.\n"
            "2. Provide a 'description' of what exactly the student is missing or confused about.\n"
            "3. Suggest a 'suggested_difficulty' (EASY, MEDIUM, or HARD) for a quiz targeting this gap.\n"
            "4. Include an 'evidence_snippet' from the chat log that demonstrates the gap.\n"
            "\n"
            "Format the output as a JSON object matching this schema:\n"
            "{format_instructions}"
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Analyze the chat history for student {student_id} in {subject}:\n\n{chat_log}"),
        ])

    async def detect_gaps(self, student_id: str, subject: str, chat_log: str) -> GapAnalysisResult:
        """
        Analyzes raw chat logs to identify knowledge gaps for quiz targeting.
        """
        chain = self.prompt | self.llm | self.parser
        
        # Limit chat log to avoid token overflow
        truncated_chat = chat_log[-8000:] 
        
        result = await chain.ainvoke({
            "student_id": student_id,
            "subject": subject,
            "chat_log": truncated_chat,
            "format_instructions": self.parser.get_format_instructions()
        })
        
        # Ensure student_id and subject are correct if LLM hallucinated
        result["student_id"] = student_id
        result["subject"] = subject
        
        return GapAnalysisResult(**result)
