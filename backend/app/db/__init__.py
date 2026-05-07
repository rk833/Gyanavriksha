from .base import Base

# Domain 1: User Management
from app.db.models import user
from app.db.models import qr_session
from app.db.models import refresh_token
from app.db.models import email_verification
from app.db.models import two_factor_email_challenge
from app.db.models import two_factor_trusted_device

# Domain 2: Academic Structure 
from app.db.models import grade
from app.db.models import subject
from app.db.models import student_enrollment
from app.db.models import instructor_subject

# Domain 3: Curriculum & Content 
from app.db.models import assignment
from app.db.models import curriculum_document
from app.db.models import student_personal_note

# Domain 4: Submissions & AI Pipeline 
from app.db.models import ocr_log
from app.db.models import submission
from app.db.models import knowledge_gap
from app.db.models import submission_feedback
from app.db.models import chat_history

# Domain 5: Adaptive Quiz System 
from app.db.models import micro_quiz
from app.db.models import quiz_attempt
from app.db.models import quiz_question

# Domain 6: Analytics & Progress 
from app.db.models import student_progress
from app.db.models import concept_heatmap_entry

# Domain 7: IoT Smart Desk 
from app.db.models import iot_device
from app.db.models import sensor_log
from app.db.models import exam_session

# Domain 8: System & Security 
from app.db.models import audit_log
from app.db.models import notification
