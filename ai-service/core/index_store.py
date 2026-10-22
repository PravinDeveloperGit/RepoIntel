"""
IndexStore — singleton managing per-repository BM25 and FAISS indexes.
All indexes are stored to disk so they survive service restarts.
"""
import os
import json
import pickle
import hashlib
import threading
from pathlib import Path
from typing import Dict, Optional, List

import numpy as np


class RepositoryIndex:
    """Holds all in-memory index artifacts for one repository."""
    def __init__(self, repository_id: str):
        self.repository_id = repository_id
        self.chunks: List[dict] = []  # serialised CodeChunk dicts
        self.bm25_index = None       # rank_bm25.BM25Okapi instance
        self.faiss_index = None       # faiss.IndexFlatIP instance
        self.chunk_id_to_pos: Dict[str, int] = {}  # chunk_id → list index
        self.relationship_index: Dict[str, dict] = {}  # file path → relationships
        self.metadata: dict = {}


class IndexStore:
    _lock = threading.Lock()
    _indexes: Dict[str, RepositoryIndex] = {}
    _storage_path: Path = Path("./indexes")

    @classmethod
    def initialize(cls):
        path = os.getenv("INDEX_STORAGE_PATH", "./indexes")
        cls._storage_path = Path(path)
        cls._storage_path.mkdir(parents=True, exist_ok=True)
        print(f"[IndexStore] Storage: {cls._storage_path.resolve()}")

    @classmethod
    def get(cls, repository_id: str) -> Optional[RepositoryIndex]:
        with cls._lock:
            if repository_id in cls._indexes:
                return cls._indexes[repository_id]
            # Try to load from disk
            return cls._load(repository_id)

    @classmethod
    def _load(cls, repository_id: str) -> Optional[RepositoryIndex]:
        """Load index from disk into memory."""
        repo_dir = cls._storage_path / repository_id
        chunks_path = repo_dir / "chunks.json"
        bm25_path = repo_dir / "bm25.pkl"
        faiss_path = repo_dir / "faiss.bin"
        rel_path = repo_dir / "relationships.json"
        meta_path = repo_dir / "metadata.json"

        if not chunks_path.exists():
            return None

        idx = RepositoryIndex(repository_id)
        with open(chunks_path, "r", encoding="utf-8") as f:
            idx.chunks = json.load(f)
        idx.chunk_id_to_pos = {c["chunk_id"]: i for i, c in enumerate(idx.chunks)}

        if bm25_path.exists():
            with open(bm25_path, "rb") as f:
                idx.bm25_index = pickle.load(f)

        if faiss_path.exists():
            import faiss
            idx.faiss_index = faiss.read_index(str(faiss_path))

        if rel_path.exists():
            with open(rel_path, "r", encoding="utf-8") as f:
                idx.relationship_index = json.load(f)

        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                idx.metadata = json.load(f)

        cls._indexes[repository_id] = idx
        print(f"[IndexStore] Loaded index for {repository_id}: {len(idx.chunks)} chunks")
        return idx

    @classmethod
    def save(cls, idx: RepositoryIndex):
        """Persist index to disk."""
        repo_dir = cls._storage_path / idx.repository_id
        repo_dir.mkdir(parents=True, exist_ok=True)

        with open(repo_dir / "chunks.json", "w", encoding="utf-8") as f:
            json.dump(idx.chunks, f)

        if idx.bm25_index is not None:
            with open(repo_dir / "bm25.pkl", "wb") as f:
                pickle.dump(idx.bm25_index, f)

        if idx.faiss_index is not None:
            import faiss
            faiss.write_index(idx.faiss_index, str(repo_dir / "faiss.bin"))

        if idx.relationship_index:
            with open(repo_dir / "relationships.json", "w", encoding="utf-8") as f:
                json.dump(idx.relationship_index, f)

        with open(repo_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(idx.metadata, f)

        with cls._lock:
            cls._indexes[idx.repository_id] = idx
        print(f"[IndexStore] Saved index for {idx.repository_id}")

    @classmethod
    def delete(cls, repository_id: str):
        import shutil
        with cls._lock:
            cls._indexes.pop(repository_id, None)
        repo_dir = cls._storage_path / repository_id
        if repo_dir.exists():
            shutil.rmtree(repo_dir)
        print(f"[IndexStore] Deleted index for {repository_id}")

    @classmethod
    def register(cls, idx: RepositoryIndex):
        with cls._lock:
            cls._indexes[idx.repository_id] = idx
