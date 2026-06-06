from fastapi import FastAPI, HTTPException
import mediapipe as mp
from pydantic import BaseModel
from typing import List, Optional
import cv2
import numpy as np
import base64
import pickle
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from deepface import DeepFace
from scipy.spatial.distance import cosine
import time

mpFace = mp.solutions.face_detection



faceDetectClose = mpFace.FaceDetection(model_selection=0, min_detection_confidence=0.6)
faceDetectFar   = mpFace.FaceDetection(model_selection=1, min_detection_confidence=0.5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("(INFO) Pre-loading Facenet512 model...")
    dummy = np.zeros((160, 160, 3), dtype=np.uint8)
    DeepFace.represent(dummy, model_name="Facenet512", enforce_detection=False, detector_backend="skip")
    print("(INFO) Model loaded successfully!")
    yield


app = FastAPI(lifespan=lifespan)

EMBEDDINGS_FILE = "./embeddings/embs_facenet512.pkl"
os.makedirs("./embeddings", exist_ok=True)
os.makedirs("./faces", exist_ok=True)


def base64_to_image(b64):
    if "," in b64:
        b64 = b64.split(",")[1]
    b64 = b64.strip()
    padding = 4 - len(b64) % 4
    if padding != 4:
        b64 += "=" * padding
    img_bytes = base64.b64decode(b64)
    arr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_all_faces(bgr_image):
    rgb = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
    results = faceDetectClose.process(rgb)
    if results.detections:
        return results.detections
    results = faceDetectFar.process(rgb)
    return results.detections or []



def crop_face(bgr_image, bbox, img_w, img_h):
    x  = int(bbox.xmin  * img_w)
    y  = int(bbox.ymin  * img_h)
    bw = int(bbox.width  * img_w)
    bh = int(bbox.height * img_h)

    face_area_ratio = (bw * bh) / (img_w * img_h)

    if face_area_ratio < 0.05:
        pad = 0.35       
    elif face_area_ratio < 0.15:
        pad = 0.25     
    else:
        pad = 0.15      

    x1 = max(0, x - int(bw * pad))
    y1 = max(0, y - int(bh * pad))
    x2 = min(img_w, x + bw + int(bw * pad))
    y2 = min(img_h, y + bh + int(bh * pad))
    if x2 > x1 and y2 > y1:
        cropped = bgr_image[y1:y2, x1:x2]
        if cropped.size > 0:
            return cropped

    return np.empty((0, 0, 3), dtype=np.uint8)

def crop_largest_face(bgr_image):
    detections = detect_all_faces(bgr_image)
    if not detections:
        return np.empty((0, 0, 3), dtype=np.uint8)
        
    h, w = bgr_image.shape[:2]
    best = max(
        detections,
        key=lambda d: (
            d.location_data.relative_bounding_box.width *
            d.location_data.relative_bounding_box.height
        )
    )
    return crop_face(bgr_image, best.location_data.relative_bounding_box, w, h)


def get_embedding(image):
    face_crop = crop_largest_face(image)
    rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    result = DeepFace.represent(rgb, model_name="Facenet512",
                                enforce_detection=False, detector_backend="skip")
    return result[0]["embedding"]


def load_embeddings():
    if os.path.exists(EMBEDDINGS_FILE):
        with open(EMBEDDINGS_FILE, "rb") as f:
            return pickle.load(f)
    return {}


def save_embeddings(db):
    with open(EMBEDDINGS_FILE, "wb") as f:
        pickle.dump(db, f)


def clamp(value):
    return float(max(0.0, min(1.0, value)))


class UploadRequest(BaseModel):
    studentId: Optional[str] = None
    student_id: Optional[str] = None
    imagesBase64: Optional[List[str]] = None
    images_base64: Optional[List[str]] = None
    images: Optional[List[str]] = None
    name: Optional[str] = None
    confidence_threshold: Optional[float] = 0.6


class RecognizeRequest(BaseModel):
    imageBase64: Optional[str] = None
    image_base64: Optional[str] = None
    image: Optional[str] = None
    confidence_threshold: Optional[float] = 0.75


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload/batch")
def upload_batch(req: UploadRequest):
    student_id = req.studentId or req.student_id
    images     = req.imagesBase64 or req.images_base64 or req.images
    print(f"(Debug) student_id: {student_id}")
    print(f"(Debug) images count: {len(images) if images else 0}")
    if not student_id or not images:
        raise HTTPException(status_code=400, detail="studentId and imagesBase64 are required")
    embeddings = []
    for i, b64 in enumerate(images):
        img = base64_to_image(b64)
        if img is None:
            print(f"(Debug) image {i} → failed to decode") 
            continue
        try:
            emb = get_embedding(img)
            embeddings.append(emb)
            print(f"(Debug) image {i} → embedding OK")
        except Exception as e:             
            print(f"(Debug) image {i} → embedding FAILED: {e}")
            continue
    print(f"([Debug] )total embeddings: {len(embeddings)}")  
    if not embeddings:
        raise HTTPException(status_code=400, detail="No valid faces found in provided images")
    db = load_embeddings()
    db[student_id] = embeddings
    save_embeddings(db)
    return {
        "studentId": student_id,
        "name": req.name or "",
        "embedding": np.mean(embeddings, axis=0).tolist(),
        "embeddings": [],
        "imagesProcessed": len(embeddings),
        "facesDetected": len(embeddings),
        "dateCreated": datetime.now(timezone.utc).isoformat(),
        "versionOfModel": "Facenet512",
        "status": "success",
        "message": f"Successfully registered {len(embeddings)} faces",
        "success": True,
    }


@app.post("/recognize")
def recognize(req: RecognizeRequest):
    start = time.time()
    image = req.imageBase64 or req.image_base64 or req.image
    if not image:
        raise HTTPException(status_code=400, detail="imageBase64 is required")

    no_face_response = [{
        "studentId": None, "name": None, "match": 0.0, "confidenceScore": 0.0,
        "versionOfModel": "Facenet512", "matchStatus": "NO_FACE_DETECTED",
        "status": "NO_FACE_DETECTED", "matched": False, "processingTimeMs": 0,
    }]

    try:
        img = base64_to_image(image)
    except Exception:
        return no_face_response

    if img is None:
        return no_face_response

    detections = detect_all_faces(img)
    if not detections:
        return no_face_response

    db = load_embeddings()
    if not db:
        raise HTTPException(status_code=404, detail="No embeddings in database yet")

    threshold = req.confidence_threshold or 0.75
    h, w = img.shape[:2]
    all_results = []

    for detection in detections:
        bbox = detection.location_data.relative_bounding_box
        face_area = bbox.width * bbox.height
        if face_area < 0.02:
         print(f"(Debug) small background face, area={face_area:.4f}")
         continue
        face_crop = crop_face(img, bbox, w, h)
        if face_crop.size == 0:
            continue
        try:
            rgb_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
            result = DeepFace.represent(rgb_crop, model_name="Facenet512",
                                        enforce_detection=False, detector_backend="skip")
            target_emb = result[0]["embedding"]
        except Exception:
            continue

        best_match, best_similarity = None, 0.0
        for student_id, stored in db.items():
            emb_list = stored if isinstance(stored, list) else [stored]
            for db_emb in emb_list:
                raw_sim = 1 - cosine(target_emb, db_emb)
                if np.isnan(raw_sim) or np.isinf(raw_sim):
                    raw_sim = 0.0
                sim = clamp(raw_sim)
                if sim > best_similarity:
                    best_similarity = sim
                    best_match = student_id

        similarity = clamp(round(best_similarity, 4))
        matched    = bool(best_similarity >= threshold) 
           

        all_results.append({
           "studentId":        best_match if matched else None,
           "name":             best_match if matched else None,
            "match":            float(similarity),
            "confidenceScore":  float(similarity),
            "versionOfModel":   "Facenet512",
           "matchStatus":      "MATCH" if matched else "NO_MATCH",
           "status":           "MATCH" if matched else "NO_MATCH",
           "matched":          matched,
            "processingTimeMs": int((time.time() - start) * 1000),
       })
        
    return all_results if all_results else no_face_response


