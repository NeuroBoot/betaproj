import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Model Configuration
    MODEL_NAME = os.getenv("MODEL_NAME", "Facenet512")
    DETECTION_CONFIDENCE = float(os.getenv("DETECTION_CONFIDENCE", "0.6"))
    MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.35"))
    
    # Paths
    EMBEDDINGS_DIR = os.getenv("EMBEDDINGS_DIR", "./embeddings")
    
    # Server Configuration
    AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
    AI_SERVICE_HOST = os.getenv("AI_SERVICE_HOST", "127.0.0.1")
    
    # Debug
    DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
    
    @staticmethod
    def ensure_dirs():
        """Ensure required directories exist"""
        os.makedirs(Config.EMBEDDINGS_DIR, exist_ok=True)

# Ensure directories exist
Config.ensure_dirs()