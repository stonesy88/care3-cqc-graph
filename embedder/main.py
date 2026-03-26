from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Local Embedding Service")

MODEL_NAME = os.getenv("MODEL_NAME", "google/embeddinggemma-300m")

print(f"Loading model: {MODEL_NAME}...")
model = SentenceTransformer(MODEL_NAME)
print("Model loaded successfully.")

class EmbedRequest(BaseModel):
    text: str

@app.post("/embed")
def generate_embedding(req: EmbedRequest):
    vector = model.encode(req.text).tolist()
    return {"vector": vector}