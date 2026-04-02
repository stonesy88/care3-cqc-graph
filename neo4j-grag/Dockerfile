FROM python:3.11-slim

WORKDIR /app

# Install dependencies explicitly bypassing cache for clean layer builds
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code natively
COPY . .

# Expose the API port
EXPOSE 8000

# Execute Uvicorn binding internally and externally
CMD ["uvicorn", "grag-service:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
