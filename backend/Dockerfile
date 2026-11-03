# Production Dockerfile for StormSentinel Backend
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install essential system dependencies for OpenCV and spatial algorithms
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 8000

# Healthcheck to ensure FastAPI server is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch FastAPI ASGI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
