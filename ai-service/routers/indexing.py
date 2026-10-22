"""
Indexing router — receives ZIP, parses, embeds, and builds indexes.
"""
import os
import io
import re
import time
import zipfile
import hashlib
import threading
from pathlib import Path
from typing import Optional

import requests
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from core.chunker import chunk_file, detect_language
from core.bm25_retriever import build_bm25_index, build_bm25_corpus
from core.vector_retriever import build_chunk_embeddings, build_faiss_index
from core.context_expander import extract_file_relationships
from core.index_store import IndexStore, RepositoryIndex
from core.chunk import CodeChunk

router = APIRouter()

# ── Security constants ────────────────────────────────────────
MAX_ARCHIVE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024
MAX_EXTRACTED_BYTES = int(os.getenv("MAX_EXTRACTED_SIZE_MB", "200")) * 1024 * 1024
MAX_FILE_COUNT = int(os.getenv("MAX_FILE_COUNT", "5000"))
MAX_SINGLE_FILE_BYTES = int(os.getenv("MAX_SINGLE_FILE_SIZE_MB", "2")) * 1024 * 1024

EXCLUDED_DIRS = {
    "node_modules", ".git", "dist", "build", "coverage",
    "vendor", ".cache", "__pycache__", ".pytest_cache",
    ".venv", "venv", "env", ".eggs", ".mypy_cache",
    ".tox", "htmlcov", ".nyc_output",
}

EXCLUDED_EXTENSIONS = {
    ".lock", ".min.js", ".min.css", ".map", ".ico", ".png",
    ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2",
    ".ttf", ".eot", ".zip", ".tar", ".gz", ".rar",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".pyc",
    ".pyo", ".class", ".jar", ".war",
}

ALLOWED_TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go",
    ".rs", ".rb", ".cpp", ".c", ".h", ".cs", ".php",
    ".swift", ".kt", ".md", ".txt", ".json", ".yaml",
    ".yml", ".toml", ".sh", ".bash", ".env.example",
    ".sql", ".graphql", ".html", ".css", ".scss",
}

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")


class IndexRequest(BaseModel):
    jobId: str
    repositoryId: str
    filePath: str
    embeddingModel: str = "all-MiniLM-L6-v2"


def _is_excluded(path: str) -> bool:
    """Return True if this path should be excluded from indexing."""
    parts = Path(path).parts
    for part in parts:
        if part in EXCLUDED_DIRS:
            return True
        # Exclude hidden directories (except .github, .vscode known config)
        if part.startswith(".") and part not in {".github", ".vscode", ".env.example"}:
            return True
    ext = Path(path).suffix.lower()
    if ext in EXCLUDED_EXTENSIONS:
        return True
    if ext not in ALLOWED_TEXT_EXTENSIONS and ext != "":
        return True
    # Exclude common secret files
    name = Path(path).name.lower()
    if name in {".env", ".env.local", ".env.production", "secrets.json"}:
        return True
    return False


def _safe_extract(zip_path: str) -> dict:
    """
    Safely extract and read files from a ZIP archive.
    Returns {relative_path: source_code} for non-excluded files.
    """
    files = {}
    total_extracted = 0
    file_count = 0

    if not os.path.exists(zip_path):
        raise ValueError(f"Archive not found: {zip_path}")

    archive_size = os.path.getsize(zip_path)
    if archive_size > MAX_ARCHIVE_BYTES:
        raise ValueError(f"Archive too large: {archive_size} bytes")

    with zipfile.ZipFile(zip_path, "r") as zf:
        for entry in zf.infolist():
            # ZIP traversal protection
            entry_path = entry.filename
            if ".." in entry_path or entry_path.startswith("/") or ":" in entry_path:
                continue
            if entry.is_dir():
                continue

            # Normalize path separators
            norm_path = entry_path.replace("\\", "/")

            if _is_excluded(norm_path):
                continue

            if file_count >= MAX_FILE_COUNT:
                break

            if entry.file_size > MAX_SINGLE_FILE_BYTES:
                continue

            total_extracted += entry.file_size
            if total_extracted > MAX_EXTRACTED_BYTES:
                break

            try:
                raw = zf.read(entry.filename)
                # Try to decode as UTF-8; skip binary files
                text = raw.decode("utf-8", errors="strict")
                files[norm_path] = text
                file_count += 1
            except (UnicodeDecodeError, KeyError):
                # Binary file or read error — skip
                continue

    return files


def _notify_backend(job_id: str, status: str, stats: dict):
    """Notify the backend API of job status changes."""
    try:
        requests.patch(
            f"{BACKEND_URL}/api/internal/jobs/{job_id}",
            json={"status": status, **stats},
            timeout=10,
        )
    except Exception as e:
        print(f"[Indexer] Backend notify failed: {e}")


def _run_indexing(job_id: str, repository_id: str, file_path: str, embedding_model: str):
    """Background indexing task."""
    start_time = time.time()
    stats = {
        "totalFiles": 0,
        "processedFiles": 0,
        "skippedFiles": 0,
        "chunkCount": 0,
        "parseFailures": 0,
        "errors": [],
    }

    try:
        print(f"[Indexer] Starting job {job_id} for repo {repository_id}")

        # Extract files
        source_files = _safe_extract(file_path)
        stats["totalFiles"] = len(source_files)
        print(f"[Indexer] Extracted {len(source_files)} files")

        all_chunks: list[CodeChunk] = []
        parse_failures = 0

        for rel_path, source in source_files.items():
            lang = detect_language(rel_path)
            if lang is None:
                stats["skippedFiles"] += 1
                continue

            chunks, status = chunk_file(source, rel_path, repository_id, embedding_model)

            if status == "error":
                parse_failures += 1
                stats["parseFailures"] += 1
            elif status == "unsupported":
                stats["skippedFiles"] += 1
                continue

            all_chunks.extend(chunks)
            stats["processedFiles"] += 1

        stats["chunkCount"] = len(all_chunks)
        print(f"[Indexer] Created {len(all_chunks)} chunks from {stats['processedFiles']} files")

        if not all_chunks:
            raise ValueError("No indexable code found in archive")

        # Build BM25 index
        chunk_dicts = [c.to_dict() for c in all_chunks]
        print(f"[Indexer] Building BM25 index...")
        bm25_idx = build_bm25_index(all_chunks)

        # Build FAISS index
        print(f"[Indexer] Generating embeddings with {embedding_model}...")
        embeddings = build_chunk_embeddings(chunk_dicts, embedding_model)
        faiss_idx = build_faiss_index(embeddings)
        print(f"[Indexer] FAISS index built with {faiss_idx.ntotal} vectors")

        # Build relationship index
        print(f"[Indexer] Extracting relationships...")
        rel_index = extract_file_relationships(chunk_dicts)

        # Assemble RepositoryIndex
        idx = RepositoryIndex(repository_id)
        idx.chunks = chunk_dicts
        idx.bm25_index = bm25_idx
        idx.faiss_index = faiss_idx
        idx.chunk_id_to_pos = {c["chunk_id"]: i for i, c in enumerate(chunk_dicts)}
        idx.relationship_index = rel_index
        idx.metadata = {
            "embedding_model": embedding_model,
            "chunk_count": len(chunk_dicts),
            "file_count": stats["processedFiles"],
            "languages": list(set(c["language"] for c in chunk_dicts)),
            "indexed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        # Persist to disk
        IndexStore.save(idx)
        duration_ms = int((time.time() - start_time) * 1000)

        # Update backend
        final_stats = {
            **stats,
            "durationMs": duration_ms,
            "embeddingModel": embedding_model,
            "languages": idx.metadata["languages"],
        }

        # Notify backend
        try:
            requests.post(
                f"{BACKEND_URL}/api/internal/jobs/{job_id}/complete",
                json=final_stats,
                timeout=10,
            )
        except Exception as e:
            print(f"[Indexer] Could not notify backend: {e}")

        print(f"[Indexer] Job {job_id} completed in {duration_ms}ms")

    except Exception as e:
        import traceback
        err_msg = str(e)
        print(f"[Indexer] Job {job_id} FAILED: {err_msg}")
        traceback.print_exc()
        try:
            requests.post(
                f"{BACKEND_URL}/api/internal/jobs/{job_id}/fail",
                json={"error": err_msg},
                timeout=10,
            )
        except Exception:
            pass


@router.post("/index")
async def start_indexing(request: IndexRequest, background_tasks: BackgroundTasks):
    """Accept an indexing job and run it in the background."""
    background_tasks.add_task(
        _run_indexing,
        request.jobId,
        request.repositoryId,
        request.filePath,
        request.embeddingModel,
    )
    return {"message": "Indexing started", "jobId": request.jobId}


@router.delete("/index/{repository_id}")
async def delete_index(repository_id: str):
    """Delete a repository index."""
    IndexStore.delete(repository_id)
    return {"message": "Index deleted", "repositoryId": repository_id}
