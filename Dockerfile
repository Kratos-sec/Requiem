# Stage 1: Build the frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend

# Assuming Dockerfile is in the root, and frontend/ is a folder next to it
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend and runner
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    nmap \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install ProjectDiscovery tools
RUN wget https://github.com/projectdiscovery/subfinder/releases/download/v2.14.0/subfinder_2.14.0_linux_amd64.zip && \
    unzip -o subfinder_2.14.0_linux_amd64.zip -d /usr/local/bin/ && \
    rm subfinder_2.14.0_linux_amd64.zip

RUN wget https://github.com/projectdiscovery/httpx/releases/download/v1.9.0/httpx_1.9.0_linux_amd64.zip && \
    unzip -o httpx_1.9.0_linux_amd64.zip -d /usr/local/bin/ && \
    rm httpx_1.9.0_linux_amd64.zip

RUN wget https://github.com/projectdiscovery/nuclei/releases/download/v3.9.0/nuclei_3.9.0_linux_amd64.zip && \
    unzip -o nuclei_3.9.0_linux_amd64.zip -d /usr/local/bin/ && \
    rm nuclei_3.9.0_linux_amd64.zip

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the clean backend code (NO EXE FILES ALLOWED)
COPY backend/ ./backend/

# Copy the built React app from Stage 1
COPY --from=frontend-builder /app/frontend/dist/ ./frontend/dist/

EXPOSE 8000
ENV PYTHONUNBUFFERED=1

# Use the exec form for Cloud Run
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]