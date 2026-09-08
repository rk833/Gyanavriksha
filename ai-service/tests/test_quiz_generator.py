import json
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.quiz_generator.service import QuizGeneratorService, GeneratedQuiz, GeneratedQuestion, questions_similar
from app.quiz_generator.gap_detector import QuizGapDetector, GapAnalysisResult, IdentifiedGap

@pytest.mark.asyncio
async def test_quiz_generator_service_success():
    mock_questions = [
        {
            "question_text": "What is photosynthesis?",
            "question_type": "mcq",
            "options": ["Making food", "Walking", "Sleeping", "Running"],
            "correct_answer": "Making food",
            "explanation": "Plants use light to make food.",
            "difficulty": "EASY"
        }
    ]

    with patch('app.quiz_generator.service.ChatVertexAI'), \
         patch('app.quiz_generator.service.RAGService') as mock_rag_cls:

        mock_rag_instance = MagicMock()
        mock_rag_instance.query.return_value = {
            "context_sources": [{"text": "Photosynthesis is the process by which plants make food."}]
        }
        mock_rag_cls.return_value = mock_rag_instance

        service = QuizGeneratorService()

        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value=json.dumps(mock_questions))
        # chain = (prompt | llm) | str_parser
        intermediate = MagicMock()
        intermediate.__or__ = MagicMock(return_value=mock_chain)
        service.prompt = MagicMock()
        service.prompt.__or__ = MagicMock(return_value=intermediate)

        quiz = await service.generate_quiz(concept="Photosynthesis", num_questions=1)

        assert quiz.concept_targeted == "Photosynthesis"
        assert len(quiz.questions) == 1
        assert quiz.questions[0].question_text == "What is photosynthesis?"

def test_questions_similar_flowchart_paraphrases():
    a = "Which symbol is typically used to indicate the termination of a process in a flowchart?"
    b = "In a flowchart, which symbol is used to indicate the start or end point of a program?"
    assert questions_similar(a, b)

    c = "What does a parallelogram represent in a standard flowchart?"
    assert not questions_similar(a, c)


@pytest.mark.asyncio
async def test_gap_detector_success():
    mock_data = {
        "student_id": "std123",
        "subject": "Biology",
        "gaps": [
            {
                "concept_name": "Cell Division",
                "topic_tag": "cell-division",
                "description": "Confusion between mitosis and meiosis",
                "suggested_difficulty": "MEDIUM",
                "evidence_snippet": "I don't get the difference between mitosis and meiosis"
            }
        ]
    }

    with patch('app.quiz_generator.gap_detector.ChatVertexAI'):
        detector = QuizGapDetector()

        # Mock the chain by patching the prompt's pipe operator
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value=mock_data)
        mock_chain.__or__ = MagicMock(return_value=mock_chain)

        with patch.object(detector, 'prompt') as mock_prompt:
            mock_prompt.__or__ = MagicMock(return_value=mock_chain)

            result = await detector.detect_gaps(student_id="std123", subject="Biology", chat_log="...")

            assert result.student_id == "std123"
            assert len(result.gaps) == 1
            assert result.gaps[0].concept_name == "Cell Division"
