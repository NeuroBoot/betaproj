from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Tuple
import uvicorn
import os
import cv2
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import pickle
import base64
from datetime import datetime
from deepface import DeepFace
from tqdm import tqdm
from scipy.spatial.distance import cosine
import mediapipe as mp
from contextlib import asynccontextmanager

# ==================== Configuration ====================
MODEL_NAME = "Facenet512"
DETECTION_CONFIDENCE = 0.6
MATCH_THRESHOLD = 0.35
EMBEDDINGS_DIR = "./embeddings"
EMBEDDINGS_FILE = "./embeddings/embs_facenet512.pkl"
FACES_DIR = "./faces"
NORM_FACES_DIR = "./norm_faces"
TEST_FACES_DIR = "./test_faces"

# Ensure directories exist
os.makedirs(FACES_DIR, exist_ok=True)
os.makedirs(NORM_FACES_DIR, exist_ok=True)
os.makedirs(TEST_FACES_DIR, exist_ok=True)
os.makedirs(EMBEDDINGS_DIR, exist_ok=True)

# ==================== Global Variables ====================
face_detector = None
embeddings_cache = None

# ==================== Initialize MediaPipe ====================
print(" Loading model ")
mp_face_detect = mp.solutions.face_detection
faceDetect = mp_face_detect.FaceDetection(model_selection=1, min_detection_confidence=DETECTION_CONFIDENCE)
print("ready")

# ==================== Lifespan Manager ====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global face_detector, embeddings_cache
    
    print("=" * 60)
    print("🚀 Starting Face Recognition AI Service...")
    print("=" * 60)
    
    face_detector = faceDetect
    
    print(f"📂 Loading embeddings from {EMBEDDINGS_FILE}...")
    if os.path.exists(EMBEDDINGS_FILE):
        with open(EMBEDDINGS_FILE, "rb") as f:
            embeddings_cache = pickle.load(f)
        print(f"✅ Loaded {len(embeddings_cache)} embeddings")
    else:
        embeddings_cache = {}
        print("⚠️ No existing embeddings file found. Creating a new one.")
    
    print("=" * 60)
    print("🎯 AI Service is ready!")
    print("📍 Running on: http://127.0.0.1:8000")
    print("=" * 60)
    
    yield
    
    print("🛑 Shutting down AI Service...")

# Create FastAPI app
app = FastAPI(
    title="Face Recognition AI Service",
    description="AI service for student face registration and recognition",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Request/Response Models ====================

class UploadRequest(BaseModel):
    images_base64: List[str]
    student_id: str
    name: str
    section_id: Optional[str] = None
    confidence_threshold: Optional[float] = 0.6

class UploadResponse(BaseModel):
    status: str
    student_id: str
    name: str
    message: str
    faces_detected: int
    embeddings_count: int
    dateCreated: str
    versionOfModel: str
    section_id: Optional[str] = None

class RecognizeRequest(BaseModel):
    image_base64: str
    confidence_threshold: Optional[float] = 0.7

class RecognizeResponse(BaseModel):
    status: str
    matchStatus: str
    student_id: Optional[str]
    name: Optional[str]
    match: float
    confidenceScore: float
    versionOfModel: str
    processingTimeMs: float

# ==================== Helper Functions ====================

def decode_base64_image(base64_string: str) -> np.ndarray:
    """Convert base64 string to OpenCV image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    image_data = base64.b64decode(base64_string)
    nparr = np.frombuffer(image_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def detect_faces(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """Detect faces using MediaPipe"""
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = faceDetect.process(rgb_image)
    
    faces = []
    if results.detections:
        h, w = image.shape[:2]
        for detection in results.detections:
            bbox = detection.location_data.relative_bounding_box
            x = int(bbox.xmin * w)
            y = int(bbox.ymin * h)
            width = int(bbox.width * w)
            height = int(bbox.height * h)
            
            x1 = max(0, x - width // 4)
            y1 = max(0, y - height // 4)
            x2 = min(w, x + width + width // 4)
            y2 = min(h, y + height + height // 4)
            
            faces.append((x1, y1, x2, y2))
    
    return faces

def crop_faces(image: np.ndarray, faces: List[Tuple[int, int, int, int]]) -> List[np.ndarray]:
    """Crop faces from image"""
    crops = []
    for (x1, y1, x2, y2) in faces:
        crop = image[y1:y2, x1:x2]
        crops.append(crop)
    return crops

def extract_embedding_from_face(face_crop: np.ndarray, model_name: str = MODEL_NAME) -> np.ndarray:
    """Extract face embedding using DeepFace"""
    try:
        if len(face_crop.shape) == 3:
            if face_crop.shape[2] == 3:
                rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
            else:
                rgb = face_crop
        else:
            rgb = cv2.cvtColor(face_crop, cv2.COLOR_GRAY2RGB)
        
        emb_result = DeepFace.represent(
            rgb,
            model_name=model_name,
            enforce_detection=False,
            detector_backend="skip"
        )
        return np.array(emb_result[0]["embedding"])
    except Exception as e:
        raise ValueError(f"Failed to extract embedding: {str(e)}")

def load_embeddings() -> dict:
    """Load existing embeddings from pickle file"""
    if os.path.exists(EMBEDDINGS_FILE):
        try:
            with open(EMBEDDINGS_FILE, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            print(f"Error loading embeddings: {e}")
            return {}
    return {}

def save_embeddings(embeddings: dict):
    """Save embeddings to pickle file"""
    try:
        with open(EMBEDDINGS_FILE, "wb") as f:
            pickle.dump(embeddings, f)
        print(f"✅ Embeddings saved to {EMBEDDINGS_FILE}")
    except Exception as e:
        print(f"Error saving embeddings: {e}")

# ==================== Model 1 Functions ====================

def process_and_save_faces_from_base64(image_base64: str, student_id: str) -> List[np.ndarray]:
    """Process base64 image, detect faces, return face crops (without saving to disk)"""
    frame = decode_base64_image(image_base64)
    if frame is None:
        return []
    
    faces = detect_faces(frame)
    if len(faces) == 0:
        return []
    
    crops = crop_faces(frame, faces)
    print(f"Found {len(faces)} faces, extracted {len(crops)} crops")
    
    return crops

def extract_embedding_from_crops(crops: List[np.ndarray]) -> List[np.ndarray]:
    """Extract embeddings from face crops"""
    embeddings = []
    for crop in crops:
        try:
            emb = extract_embedding_from_face(crop)
            embeddings.append(emb)
        except Exception as e:
            print(f"Failed to extract embedding: {e}")
    return embeddings

# ==================== Model 2 Functions ====================

def find_best_match(test_embedding: np.ndarray, database_embs: dict, threshold: float = MATCH_THRESHOLD) -> dict:
    """Find best matching student from database"""
    if not database_embs:
        return None
    
    best_match = None
    best_similarity = -1
    
    for student_id, data in database_embs.items():
        if isinstance(data, dict):
            db_embedding = np.array(data['embedding'])
            name = data.get('name', student_id)
        else:
            db_embedding = np.array(data)
            name = student_id
        
        similarity = 1 - cosine(test_embedding, db_embedding)
        
        if similarity > best_similarity:
            best_similarity = similarity
            best_match = {
                'student_id': student_id,
                'name': name,
                'similarity': similarity,
                'confidence': similarity
            }
    
    if best_match and best_match['similarity'] > (1 - threshold):
        return best_match
    return None

# ==================== API Endpoints ====================

@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Face Recognition AI",
        "model": MODEL_NAME,
        "status": "running",
        "embeddings_count": len(embeddings_cache) if embeddings_cache else 0,
        "endpoints": ["/health", "/upload", "/recognize", "/embeddings"]
    }

@app.get("/health", tags=["Health"])
async def health_check():
    """Check if AI service is running"""
    return {
        "status": "healthy",
        "embeddings_count": len(embeddings_cache) if embeddings_cache else 0,
        "model_name": MODEL_NAME,
        "service": "fastapi"
    }

@app.post("/upload", tags=["Model 1 - Registration"])
async def register_student(request: UploadRequest):
    """
    Model 1: Register a student's face using multiple images
    """
    global embeddings_cache
    
    print(f"\n{'='*50}")
    print(f"Registering student: {request.name} (ID: {request.student_id})")
    print(f"Received {len(request.images_base64)} images")
    print(f"{'='*50}")
    
    all_embeddings = []
    processed_count = 0
    faces_detected = 0
    failed_indices = []
    
    # Process each image
    for idx, img_base64 in enumerate(request.images_base64):
        try:
            image = decode_base64_image(img_base64)
            faces = detect_faces(image)
            
            if len(faces) == 0:
                failed_indices.append(idx)
                continue
            
            crops = crop_faces(image, faces)
            faces_detected += len(crops)
            
            for crop in crops:
                try:
                    emb = extract_embedding_from_face(crop)
                    all_embeddings.append(emb)
                except:
                    pass
            
            processed_count += 1
        except Exception as e:
            print(f"Error processing image {idx}: {e}")
            failed_indices.append(idx)
    
    if len(all_embeddings) == 0:
        return {
            "success": False,
            "error": "No faces detected in any of the uploaded images",
            "timestamp": datetime.now().isoformat()
        }
    
    # Aggregate embeddings by averaging
    aggregated_embedding = np.mean(all_embeddings, axis=0).tolist()
    
    # Load existing embeddings
    embeddings = load_embeddings()
    
    # Save to storage
    embeddings[request.student_id] = {
        'name': request.name,
        'embedding': aggregated_embedding,
        'created_at': datetime.now().isoformat(),
        'images_processed': processed_count,
        'faces_detected': faces_detected,
        'version': MODEL_NAME
    }
    
    save_embeddings(embeddings)
    embeddings_cache = embeddings
    
    print(f"✅ Successfully registered {request.name} with {len(all_embeddings)} embeddings")
    
    # ✅ التنسيق المطلوب بالضبط
    return {
        "success": True,
        "data": {
            "studentId": request.student_id,
            "name": request.name,
            "totalImages": len(request.images_base64),
            "failedImages": len(failed_indices) if failed_indices else None,
            "failedIndices": failed_indices,
            "status": "SUCCESS",
            "embedding": aggregated_embedding
        }
    }

@app.post("/recognize", response_model=RecognizeResponse, tags=["Model 2 - Recognition"])
async def recognize_face(request: RecognizeRequest):
    """
    Model 2: Recognize a face from a single camera frame
    """
    start_time = datetime.now()
    
    print(f"\n{'='*50}")
    print(f"🔍 Processing recognition request")
    print(f"{'='*50}")
    
    try:
        # Decode image
        image = decode_base64_image(request.image_base64)
        
        # Detect faces
        faces = detect_faces(image)
        
        if len(faces) == 0:
            return RecognizeResponse(
                status="NO_FACE_DETECTED",
                matchStatus="NO_FACE_DETECTED",
                student_id=None,
                name=None,
                match=0,
                confidenceScore=0,
                versionOfModel=MODEL_NAME,
                processingTimeMs=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        if len(faces) > 1:
            return RecognizeResponse(
                status="MULTIPLE_FACES",
                matchStatus="MULTIPLE_FACES",
                student_id=None,
                name=None,
                match=0,
                confidenceScore=0,
                versionOfModel=MODEL_NAME,
                processingTimeMs=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        # Crop the face
        crops = crop_faces(image, faces)
        if len(crops) == 0:
            return RecognizeResponse(
                status="NO_FACE_DETECTED",
                matchStatus="NO_FACE_DETECTED",
                student_id=None,
                name=None,
                match=0,
                confidenceScore=0,
                versionOfModel=MODEL_NAME,
                processingTimeMs=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        # Extract embedding from face
        test_embedding = extract_embedding_from_face(crops[0])
        
        # Load database embeddings
        database_embs = load_embeddings()
        
        if len(database_embs) == 0:
            return RecognizeResponse(
                status="NO_MATCH",
                matchStatus="NO_MATCH",
                student_id=None,
                name=None,
                match=0,
                confidenceScore=0,
                versionOfModel=MODEL_NAME,
                processingTimeMs=(datetime.now() - start_time).total_seconds() * 1000
            )
        
        # Find best match
        threshold = request.confidence_threshold or MATCH_THRESHOLD
        best_match = find_best_match(test_embedding, database_embs, threshold)
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        if best_match:
            print(f"✅ Match found: {best_match['name']} (ID: {best_match['student_id']}) with confidence {best_match['confidence']:.2%}")
            return RecognizeResponse(
                status="MATCH",
                matchStatus="MATCH",
                student_id=best_match['student_id'],
                name=best_match['name'],
                match=best_match['similarity'],
                confidenceScore=best_match['confidence'],
                versionOfModel=MODEL_NAME,
                processingTimeMs=processing_time
            )
        else:
            print(f"❌ No match found")
            return RecognizeResponse(
                status="NO_MATCH",
                matchStatus="NO_MATCH",
                student_id=None,
                name=None,
                match=0,
                confidenceScore=0,
                versionOfModel=MODEL_NAME,
                processingTimeMs=processing_time
            )
            
    except Exception as e:
        print(f"❌ Recognition error: {str(e)}")
        return RecognizeResponse(
            status="ERROR",
            matchStatus="ERROR",
            student_id=None,
            name=None,
            match=0,
            confidenceScore=0,
            versionOfModel=MODEL_NAME,
            processingTimeMs=(datetime.now() - start_time).total_seconds() * 1000
        )

@app.get("/embeddings", tags=["Embeddings"])
async def list_embeddings():
    """List all registered students with embeddings"""
    embeddings = load_embeddings()
    
    students = []
    for student_id, data in embeddings.items():
        if isinstance(data, dict):
            students.append({
                'student_id': student_id,
                'name': data.get('name', student_id),
                'created_at': data.get('created_at')
            })
        else:
            students.append({
                'student_id': student_id,
                'name': student_id,
                'created_at': None
            })
    
    return {
        "count": len(students),
        "students": students
    }

@app.get("/embeddings/{student_id}", tags=["Embeddings"])
async def get_embedding(student_id: str):
    """Check if a student has a face embedding"""
    embeddings = load_embeddings()
    if student_id in embeddings:
        data = embeddings[student_id]
        if isinstance(data, dict):
            return {
                "exists": True,
                "student_id": student_id,
                "name": data.get('name', student_id),
                "created_at": data.get('created_at')
            }
        else:
            return {
                "exists": True,
                "student_id": student_id,
                "name": student_id,
                "created_at": None
            }
    return {"exists": False, "student_id": student_id}

@app.delete("/embeddings/{student_id}", tags=["Embeddings"])
async def delete_embedding(student_id: str):
    """Delete a student's face embedding"""
    global embeddings_cache
    
    embeddings = load_embeddings()
    if embeddings and student_id in embeddings:
        del embeddings[student_id]
        save_embeddings(embeddings)
        embeddings_cache = embeddings
        
        return {
            "success": True,
            "message": f"Embedding for student {student_id} deleted"
        }
    return {
        "success": False,
        "message": f"Embedding for student {student_id} not found"
    }

@app.get("/embeddings/vector/{student_id}", tags=["Embeddings"])
async def get_embedding_vector(student_id: str):
    """Get the actual embedding vector for a student"""
    embeddings = load_embeddings()
    
    if student_id not in embeddings:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    
    data = embeddings[student_id]
    
    if isinstance(data, dict):
        embedding_vector = data.get('embedding', [])
        return {
            "success": True,
            "data": {
                "student_id": student_id,
                "name": data.get('name', student_id),
                "embedding_size": len(embedding_vector),
                "embedding_preview": embedding_vector[:10],
                "full_embedding": embedding_vector,
                "created_at": data.get('created_at'),
                "version": data.get('version', MODEL_NAME)
            }
        }
    else:
        return {
            "success": True,
            "data": {
                "student_id": student_id,
                "embedding_size": len(data) if data else 0,
                "embedding_preview": data[:10] if data else [],
                "full_embedding": data,
                "created_at": None
            }
        }

if __name__ == "__main__":
    print("=" * 60)
    print("🤖 Face Recognition AI Service")
    print(f"📦 Model: {MODEL_NAME}")
    print(f"📍 Running on: http://127.0.0.1:8000")
    print(f"💾 Embeddings directory: {EMBEDDINGS_DIR}")
    print("=" * 60)
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info"
    )