FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- HUGGING FACE BUILD AUTHENTICATION ---
# Define a build argument for the token. This allows us to pass the token
# securely during the `docker build` command without hardcoding it.
ARG HF_TOKEN

# Pre-download the gated Gemma model during build time.
# By passing HF_TOKEN inline, the sentence_transformers library will 
# automatically authenticate and cache the model weights in the image layer.
RUN HF_TOKEN=${HF_TOKEN} python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('google/embeddinggemma-300m')"
# -----------------------------------------

COPY main.py .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]