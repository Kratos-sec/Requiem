# 🛡️ Requiem

### Quantum-Proof Cryptography Scanner

<p align="center">

  <a href="https://github.com/Biggestprocrastinator/Requiem">
    <img src="https://img.shields.io/github/stars/Biggestprocrastinator/Requiem?style=for-the-badge&logo=github" />
  </a>

  <a href="https://github.com/Biggestprocrastinator/Requiem/network">
    <img src="https://img.shields.io/github/forks/Biggestprocrastinator/Requiem?style=for-the-badge&logo=github" />
  </a>

  <img src="https://img.shields.io/badge/Python-3.10+-blue?style=for-the-badge&logo=python" />

  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi" />

  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react" />

  <img src="https://img.shields.io/badge/Nuclei-Security-red?style=for-the-badge" />

  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" />

  <img src="https://img.shields.io/badge/PQC-Ready-purple?style=for-the-badge" />
  
  <img src="https://img.shields.io/badge/Cyber-Rating-orange?style=for-the-badge" />

  <img src="https://img.shields.io/badge/CBOM-Enabled-black?style=for-the-badge" />

</p>

---

## 🚀 Overview

**Requiem** is a next-generation **cryptographic intelligence platform** that enables organizations to discover assets, analyze vulnerabilities, and assess **post-quantum cryptographic readiness** in a unified interface.

It integrates **reconnaissance, TLS analysis, certificate intelligence, and vulnerability scanning** to provide actionable security insights across enterprise infrastructure.

---
## 🧠 Why Requiem?

- 🔍 Combines **asset discovery + cryptographic analysis**
- 🔐 Provides **CBOM (Cryptographic Bill of Materials)**
- ⚛️ Evaluates **Post-Quantum Cryptography readiness**
- ⚡ Designed for **real-time security insights**
  
---

## ✨ Features

### 🔍 Asset Discovery

* Subdomain enumeration using **Subfinder**
* Certificate-based discovery using **crt.sh**
* Real-time asset inventory generation

---

### 🌐 Live Host Detection

* Fast probing using **httpx**
* DNS resolution + filtering of active assets

---

### 🔓 Vulnerability Scanning

* On-demand scanning using **Nuclei**
* Focused detection of **High & Critical vulnerabilities**

---

### 🔐 Cryptographic Analysis (CBOM)

* TLS version detection
* Cipher suite identification
* Key algorithm & key size extraction
* Certificate authority & expiry tracking

---

### 🧠 PQC Risk Assessment

* Detects non-quantum-safe algorithms (RSA, ECC)
* Flags cryptographic weaknesses
* Evaluates future quantum risk exposure

---

### 📊 Cyber Rating Engine

* Aggregates:

  * Vulnerabilities
  * Cryptographic posture
  * Certificate risks
* Generates an overall **security rating**

---

## 🏗️ Tech Stack

| Layer    | Technology       |
| -------- | ---------------- |
| Backend  | FastAPI, Python  |
| Frontend | React, HTML, CSS |
| Database | SQLAlchemy       |
| Recon    | Subfinder, httpx |
| Scanning | Nmap, Nuclei     |
| Crypto   | SSLyze, OpenSSL  |

---

## ⚙️ Installation & Setup

### 📌 Prerequisites

* Python 3.10+
* Node.js 18+
* Nmap installed system-wide
  👉 https://nmap.org/download.html

---

### 🖥️ Backend Setup

```bash
cd qshield-backend

# Create virtual environment
python -m venv .venv

# Activate environment
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download Nuclei into qshield-backend/nuclei.exe
powershell -ExecutionPolicy Bypass -File .\scripts\setup-tools.ps1

# Run backend
uvicorn backend.app.main:app --reload
```

If you want to skip the script, you can also place `nuclei.exe` directly in the `qshield-backend/` folder. The backend looks for that file there first.

---

### 🌐 Frontend Setup

```bash
cd qshield-backend/frontend

npm install
npm run dev
```

---

## 🧪 Usage

1. Enter a domain (e.g., `example.com`)
2. Run asset discovery
3. View:

   * Live assets
   * TLS & cryptographic details
   * Certificate intelligence
4. Optionally run **Nuclei scan**
5. Analyze:

   * Vulnerabilities
   * PQC readiness
   * Cyber rating

---

## 📸 Key Modules

* 🧾 **Assets Dashboard** – Full asset + certificate intelligence
* 🔐 **CBOM** – Cryptographic Bill of Materials
* ⚠️ **Vulnerability Scan** – Nuclei-powered findings
* 🧠 **PQC Posture** – Quantum readiness insights

---

## 🛠️ Roadmap

* [ ] Real-time scan progress tracking
* [ ] Advanced risk scoring engine
* [ ] Authentication & role-based access
* [ ] Cloud deployment

---

## 🤝 Contributing

Contributions are welcome!
Feel free to fork the repo and submit a PR.

---
