import chromadb
import os

# Define the persistence directory for Chroma DB inside ai-service
CHROMA_DATA_PATH = os.environ.get(
    "CHROMA_DATA_PATH", 
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_data")
)

class ChromaDBManager:
    def __init__(self, persist_directory=CHROMA_DATA_PATH):
        """Initialize the ChromaDB client and default collections."""
        # Ensure the directory exists
        os.makedirs(persist_directory, exist_ok=True)
        
        # Initialize the ChromaDB persistent client
        self.client = chromadb.PersistentClient(path=persist_directory)
        self._initialize_admin_collections()

    def _initialize_admin_collections(self):
        """
        Creates the global collections for Grade 8, 9, and 10 if they do not exist.
        Permissions (Admin edit, User read) should be enforced at the API/Service level.
        Expected Metadata for items: submission date, submitted by, grade, subject, file name
        """
        self.grade_8_collection = self.client.get_or_create_collection(
            name="grade_8",
            metadata={"description": "Admin collection for Grade 8 materials"}
        )
        self.grade_9_collection = self.client.get_or_create_collection(
            name="grade_9",
            metadata={"description": "Admin collection for Grade 9 materials"}
        )
        self.grade_10_collection = self.client.get_or_create_collection(
            name="grade_10",
            metadata={"description": "Admin collection for Grade 10 materials"}
        )

    def get_admin_collection(self, grade: int):
        """Retrieve the global admin collection for a specific grade."""
        if grade == 8:
            return self.grade_8_collection
        elif grade == 9:
            return self.grade_9_collection
        elif grade == 10:
            return self.grade_10_collection
        else:
            raise ValueError("Only grades 8, 9, and 10 are supported for global collections.")

    def get_or_create_instructor_collection(self, instructor_id: str, class_id: str):
        """
        Instructor level collections where they add materials based on the class they teach.
        Permissions (Instructor/Admin edit, Student read) should be enforced at the API/Service level.
        Expected Metadata for items: submission date, submitted by, grade, subject, instructor_subject_id, file name
        """
        # Collection names must be alphanumeric and underscores/hyphens only
        collection_name = f"instructor_{instructor_id}_class_{class_id}".replace("-", "_")
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": f"Instructor {instructor_id} collection for class {class_id}"}
        )

    def get_or_create_student_collection(self, student_id: str):
        """
        Student level collections permitted only by the student to view and add materials.
        Permissions (Student edit/read) should be enforced at the API/Service level.
        Expected Metadata for items: submission date, submitted by, grade, subject, file name
        """
        collection_name = f"student_{student_id}".replace("-", "_")
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": f"Student {student_id} private collection"}
        )

# Create a singleton instance to be imported across the application
chroma_manager = ChromaDBManager()

if __name__ == "__main__":
    print(f"ChromaDB persistence path: {CHROMA_DATA_PATH}")
    print("Existing Collections:")
    collections = chroma_manager.client.list_collections()
    for col in collections:
        print(f" - {col.name}")
