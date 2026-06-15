# Stage 1: Build the frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY qshield-backend/frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY qshield-backend/frontend/ ./
RUN npm run build


# Stage 2: Backend
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    nmap \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install ProjectDiscovery tools

# Subfinder
RUN wget https://github.com/projectdiscovery/subfinder/releases/download/v2.14.0/subfinder_2.14.0_linux_amd64.zip && \
    unzip -o subfinder_2.14.0_linux_amd64.zip -d /usr/local/bin/ && \
    rm subfinder_2.14.0_linux_amd64.zip

# HTTPX
RUN wget https://github.com/projectdiscovery/httpx/releases/download/v1.9.0/httpx_1.9.0_linux_amd64.zip && \
    unzip -o httpx_1.9.0_linux_amd64.zip -d /usr/local/bin/ && \
    rm httpx_1.9.0_linux_amd64.zip

# Nuclei
RUN wget https://github.com/projectdiscovery/nuclei/releases/download/v3.9.0/nuclei_3.9.0_linux_amd64.zip && \
    unzip -o nuclei_3.9.0_linux_amd64.zip -d /usr/local/bin/ && \
    rm nuclei_3.9.0_linux_amd64.zip

# Python dependencies
COPY qshield-backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend source
COPY qshield-backend/backend/ ./backend/

# Built frontend
COPY --from=frontend-builder /app/frontend/dist/ ./frontend/dist/

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]