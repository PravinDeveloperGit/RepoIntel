# 🧠 RepoIntel — Repository Intelligence & Semantic Code Analysis Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000.svg?logo=express)](https://expressjs.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.10+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**RepoIntel** is an end-to-end repository intelligence and semantic code exploration platform. It enables developers to index entire codebases, perform hybrid semantic + lexical searches, chat with code repositories using retrieval-augmented generation (RAG), and benchmark retrieval accuracy with built-in evaluation metrics.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Backend Setup](#3-backend-setup)
  - [4. Frontend Setup](#4-frontend-setup)
  - [5. AI Service Setup](#5-ai-service-setup)
  - [6. Seed Test Credentials](#6-seed-test-credentials)
- [Test User Credentials](#-test-user-credentials)
- [API Reference](#-api-reference)
- [Evaluation & Benchmarking](#-evaluation--benchmarking)
- [Git Setup & Pushing to GitHub](#-git-setup--pushing-to-github)
- [License](#-license)

---

## ✨ Key Features

- 🔍 **Hybrid Code Search**: Combines Dense Vector Search (`sentence-transformers/all-MiniLM-L6-v2`) with Lexical Keyword Search (BM25) and Reciprocal Rank Fusion (RRF) for high precision code retrieval.
- 💬 **Code Q&A (RAG Engine)**: Ask natural language questions about your repository architecture, functions, and logic with context-expanded answers and citations.
- 🧩 **AST & Language-Aware Chunking**: Intelligently chunks source code files preserving function definitions, class structures, imports, and docstrings.
- 📊 **Evaluation & Benchmark Suite**: Measures retrieval performance with standard information retrieval metrics:
  - **MRR (Mean Reciprocal Rank)**
  - **Success@1, Success@5, Success@10**
  - **Precision@k**
  - **Latency (p50, p90, p99)**
- 📂 **Multi-Format Repository Ingestion**: Supports `.zip` and `.tar.gz` repository archive uploads with automated extraction and indexing.
- 🎨 **Modern Cyber-Dark UI**: Glassmorphic dark interface built with Tailwind CSS, Lucide icons, Monaco code viewer, and responsive charts.
- 🔒 **Secure Authentication**: JWT-based authentication with bcrypt password hashing, input validation via Zod, and rate-limiting.

---

## 🏛 System Architecture

```text
┌────────────────────────────────────────────────────────┐
│             Frontend (React 18 + Vite)                 │
│                 http://localhost:5173                  │
└───────────────────────────┬────────────────────────────┘
                            │ /api/* (Proxy)
                            ▼
┌────────────────────────────────────────────────────────┐
│           Backend API (Express 5 + TypeScript)         │
│                 http://localhost:4000                  │
└─────────────┬────────────────────────────┬─────────────┘
              │ Mongoose                   │ REST Calls
              ▼                            ▼
┌────────────────────────┐   ┌───────────────────────────┐
│     MongoDB Atlas      │   │   AI Service (FastAPI)    │
│  (Users, Repositories, │   │   http://localhost:8000   │
│   Jobs, Q&A, Metrics)  │   │   - FAISS Vector Store    │
└────────────────────────┘   │   - BM25 Ranker           │
                             │   - Sentence Transformers │
                             │   - LLM Orchestrator      │
                             └───────────────────────────┘
```

---

## 💻 Tech Stack

### Frontend
- **Framework**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [TanStack React Query v5](https://tanstack.com/query)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Code Editor**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (v18+)
- **Framework**: [Express 5](https://expressjs.com/) + TypeScript
- **Database**: [MongoDB Atlas](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Security**: Helmet, Express Rate Limit, JWT, BcryptJS

### AI Service
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+)
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`)
- **Vector Index**: FAISS / NumPy
- **Keyword Search**: Rank-BM25
- **Reranker**: Cross-Encoder (`ms-marco-MiniLM-L-6-v2`) or Lexical RRF

---

## 📁 Project Structure

```text
RepoIntel/
├── .env.example              # Environment variables template
├── .gitignore                # Git exclusions (credentials, node_modules, dist)
├── package.json              # Root project convenience scripts
├── README.md                 # Complete project documentation
│
├── frontend/                 # React + Vite client
│   ├── src/
│   │   ├── components/       # Reusable layout & UI components
│   │   ├── lib/              # Axios API client & endpoints
│   │   ├── pages/            # Dashboard, Search, Q&A, Repos, Auth
│   │   ├── stores/           # Zustand state (Auth, UI)
│   │   ├── App.tsx           # Application route definitions
│   │   └── main.tsx          # Client entrypoint
│   └── vite.config.ts        # Vite configuration & /api proxy
│
├── backend/                  # Express REST API
│   ├── src/
│   │   ├── config/           # Database & environment configuration
│   │   ├── middleware/       # JWT auth & error handling
│   │   ├── models/           # Mongoose schemas (User, Repo, Q&A, Jobs)
│   │   ├── routes/           # Express router endpoints
│   │   ├── utils/            # Logging and helpers
│   │   ├── app.ts            # Express server configuration
│   │   └── index.ts          # Server entrypoint
│   └── tsconfig.json         # TypeScript configuration
│
├── ai-service/               # Python RAG & Vector Engine
│   ├── core/                 # BM25, Vector Retriever, Chunker, Q&A
│   ├── routers/              # Indexing, Search, Q&A, Evaluation
│   ├── main.py               # FastAPI application
│   └── requirements.txt      # Python dependencies
│
└── scripts/
    └── seed-test-user.cjs    # Database seeder for demo credentials
```

---

## ⚙ Prerequisites

Before running RepoIntel, make sure you have the following installed:

- **Node.js** (v18.0.0 or higher) & **npm**
- **Python** (v3.10 or higher) & **pip**
- **MongoDB Atlas** connection string (or local MongoDB server)
- **Git**

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/PravinDeveloperGit/RepoIntel.git
cd RepoIntel
```

### 2. Environment Configuration

Copy `.env.example` to `.env` in both the root directory and the `backend/` directory:

```bash
cp .env.example .env
cp .env.example backend/.env
```

Ensure your `MONGODB_URI` and `JWT_SECRET` are configured:

```env
MONGODB_URI=mongodb://your-mongodb-connection-string/repointel
MONGODB_DB_NAME=repointel
BACKEND_PORT=4000
JWT_SECRET=your-secure-random-secret-key-at-least-64-characters
VITE_API_BASE_URL=http://localhost:4000/api
AI_SERVICE_URL=http://localhost:8000
```

### 3. Backend Setup

```bash
cd backend
npm install
npm run dev
```
> The Backend API starts on: **http://localhost:4000**

### 4. Frontend Setup

In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
> The Frontend dev server starts on: **http://localhost:5173**

### 5. AI Service Setup

In a new terminal:
```bash
cd ai-service
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
> The AI Service starts on: **http://localhost:8000**

### 6. Seed Test Credentials

To populate your database with a verified test user, run:

```bash
npm run seed
```

---

## 🔑 Test User Credentials

You can log in directly using the seeded credentials:

| Field | Value |
| :--- | :--- |
| **Email** | `test@repointel.dev` |
| **Password** | `Test1234!` |
| **Display Name** | Test User |

> 💡 **Tip**: On the **[Sign In Page](http://localhost:5173/login)**, click the **"Auto-Fill"** button to populate the credentials in 1 click!

---

## 🔌 API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new account | No |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | No |
| `POST` | `/api/auth/logout` | Invalidate current session | Yes |
| `GET` | `/api/auth/me` | Fetch profile of authenticated user | Yes |

### Repositories (`/api/repositories`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/repositories` | List indexed repositories with pagination | Yes |
| `POST` | `/api/repositories` | Create a new repository record | Yes |
| `POST` | `/api/repositories/:id/upload` | Upload `.zip`/`.tar.gz` codebase archive | Yes |
| `GET` | `/api/repositories/:id` | Get repository details & statistics | Yes |
| `DELETE` | `/api/repositories/:id` | Delete repository and associated indexes | Yes |

### Search & Q&A
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/search` | Execute hybrid vector/lexical search query | Yes |
| `GET` | `/api/search/history` | Retrieve user search history | Yes |
| `POST` | `/api/qa/ask` | Ask natural language question to RAG engine | Yes |
| `GET` | `/api/qa/conversations` | List conversation threads | Yes |

---

## 📈 Evaluation & Benchmarking

RepoIntel includes an automated benchmarking pipeline for evaluating code retrieval quality:

- **System Variants**: Compare Vector-Only (Variant A), BM25-Only (Variant B), Hybrid RRF (Variant C), and Reranked Hybrid (Variant D).
- **Latency Profiling**: Millisecond-level tracking across chunk retrieval, reranking, and generation.
- **Accuracy Benchmarks**: Automatically computes MRR and Success@k on curated datasets.

To run a benchmark from the UI, navigate to the **Evaluation** tab in the dashboard.

---

## 📦 Git Setup & Pushing to GitHub

To push this codebase to your GitHub repository:

1. Create a repository on [GitHub](https://github.com/new) named `RepoIntel` under your account (`PravinDeveloperGit`).
2. Run the following commands in the project root:

```bash
# Add origin remote
git remote add origin https://github.com/PravinDeveloperGit/RepoIntel.git

# Set main branch
git branch -M main

# Push code to GitHub
git push -u origin main
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
