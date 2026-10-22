"""
Dense vector retrieval using sentence-transformers + FAISS.
"""
import os
import numpy as np
from typing import List, Dict, Optional

import faiss


_embedding_model_cache = {}


def get_embedding_model(model_name: str = None):
    """Lazy-load embedding model with caching."""
    if model_name is None:
        model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    if model_name not in _embedding_model_cache:
        from sentence_transformers import SentenceTransformer
        print(f"[Embedder] Loading model: {model_name}")
        _embedding_model_cache[model_name] = SentenceTransformer(model_name)
        print(f"[Embedder] Model loaded.")

    return _embedding_model_cache[model_name]


def embed_texts(texts: List[str], model_name: str = None) -> np.ndarray:
    """Embed a list of texts and return normalized float32 embeddings."""
    model = get_embedding_model(model_name)
    batch_size = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        normalize_embeddings=True,  # Cosine similarity via inner product
        convert_to_numpy=True,
    )
    return embeddings.astype(np.float32)


def build_faiss_index(embeddings: np.ndarray) -> faiss.Index:
    """Build FAISS IndexFlatIP (inner product = cosine for normalized vectors)."""
    if len(embeddings) == 0:
        dim = 384  # default for all-MiniLM-L6-v2
        index = faiss.IndexFlatIP(dim)
        return index

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    return index


def build_chunk_embeddings(
    chunks: List[dict],
    model_name: str = None,
) -> np.ndarray:
    """Generate embeddings for a list of chunk dicts."""
    texts = []
    for chunk in chunks:
        # Compose embedding text: symbol + file path + source
        parts = []
        if chunk.get("symbol_name"):
            parts.append(chunk["symbol_name"])
        parts.append(chunk.get("relative_file_path", ""))
        parts.append(chunk.get("source_code", "")[:1000])
        texts.append(" ".join(filter(None, parts)))

    if not texts:
        return np.zeros((0, 384), dtype=np.float32)

    return embed_texts(texts, model_name)


def vector_search(
    faiss_index: faiss.Index,
    chunks: List[dict],
    query: str,
    top_k: int = 20,
    language_filter: Optional[str] = None,
    path_filter: Optional[str] = None,
    symbol_type_filter: Optional[str] = None,
    model_name: str = None,
) -> List[Dict]:
    """
    Run dense vector search and return top_k results.
    Returns list of {chunk_id, score, rank, chunk}.
    """
    if faiss_index is None or faiss_index.ntotal == 0:
        return []

    query_embedding = embed_texts([query], model_name)  # (1, dim)
    # Search more candidates to allow for filtering
    search_k = min(top_k * 5, faiss_index.ntotal)
    scores, indices = faiss_index.search(query_embedding, search_k)
    scores = scores[0]
    indices = indices[0]

    results = []
    rank = 0
    for score, idx in zip(scores, indices):
        if idx < 0 or idx >= len(chunks):
            continue
        chunk = chunks[idx]

        # Apply filters
        if language_filter and chunk.get("language") != language_filter:
            continue
        if path_filter and path_filter.lower() not in chunk.get("relative_file_path", "").lower():
            continue
        if symbol_type_filter and chunk.get("symbol_type") != symbol_type_filter:
            continue

        results.append({
            "chunk_id": chunk["chunk_id"],
            "score": float(score),
            "raw_score": float(score),
            "rank": rank + 1,
            "chunk": chunk,
            "retrieval_source": "vector",
        })
        rank += 1
        if len(results) >= top_k:
            break

    return results
