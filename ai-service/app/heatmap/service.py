from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import os

class ConceptProficiency(BaseModel):
    concept_name: str
    topic_tag: str
    proficiency: float  # -10 to 10

class ChatHeatmapSummary(BaseModel):
    student_id: str
    chat_id: str
    subject: str
    concepts: List[ConceptProficiency]

class HeatmapService:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.1)
        
        self.parser = JsonOutputParser(pydantic_object=ChatHeatmapSummary)
        
        system_prompt = (
            "You are an expert educational analyst. Your task is to analyze a student's chat interaction "
            "with an AI tutor and extract the core concepts discussed. For each concept, assess the student's "
            "mastery/proficiency on a scale from -10 (complete lack of understanding/confusion) to 10 (perfect mastery). "
            "\n\n"
            "Format the output as a JSON object matching this schema:\n"
            "{format_instructions}\n"
            "\n"
            "Ensure the 'topic_tag' is a short, slug-like string (e.g., 'algebra-basics', 'photosynthesis')."
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Analyze this chat log for student {student_id} in the subject {subject}:\n\n{chat_log}"),
        ])

    async def generate_summary(self, student_id: str, chat_id: str, subject: str, chat_log: str) -> ChatHeatmapSummary:
        """
        Generates a summary of the chat log focusing on concept mastery.
        """
        chain = self.prompt | self.llm | self.parser
        
        result = await chain.ainvoke({
            "student_id": student_id,
            "subject": subject,
            "chat_log": chat_log,
            "format_instructions": self.parser.get_format_instructions()
        })
        
        # Ensure student_id and chat_id are correctly set if LLM hallucinated them
        result["student_id"] = student_id
        result["chat_id"] = chat_id
        result["subject"] = subject
        
        return ChatHeatmapSummary(**result)
