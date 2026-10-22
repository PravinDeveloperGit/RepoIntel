"""
Code-aware reranker.

Implements a transparent weighted feature reranker as the primary
approach, with an optional cross-encoder model.

Feature set:
1. Query-to-code semantic similarity (cosine)
2. BM25 rank (normalized)
3. Vector similarity (if available)
4. Identifier / symbol name match
5. File-path / module-name match
6. Symbol type relevance bonus
7. Import match
8. Containing class relevance
"""
import re
import os
from typing import List, Dict, Optional, Tuple

import numpy as np


# ── Feature weights (tuned on validation set, not test set) ──
WEIGHTS = {
    "semantic_sim": 0.30,
    "bm25_rank_norm": 0.20,
    "vector_sim": 0.15,
    "identifier_match": 0.15,
    "path_match": 0.10,
    "symbol_type_bonus": 0.05,
    "import_match": 0.03,
    "class_match": 0.02,
}


def _normalize_rank(rank: Optional[int], max_rank: int = 50) -> float:
    """Convert rank to score: rank 1 → 1.0, higher ranks → lower score."""
    if rank is None:
        return 0.0
    return max(0.0, 1.0 - (rank - 1) / max_rank)


def _identifier_match_score(query: str, chunk: dict) -> float:
    """Score based on query terms matching code identifiers."""
    query_tokens = set(re.findall(r'[a-zA-Z]\w*', query.lower()))
    if not query_tokens:
        return 0.0

    symbol = (chunk.get("symbol_name") or "").lower()
    file_path = (chunk.get("relative_file_path") or "").lower()
    class_name = (chunk.get("containing_class") or "").lower()

    target_tokens = set(
        re.findall(r'[a-zA-Z]\w*', f"{symbol} {file_path} {class_name}")
    )

    if not target_tokens:
        return 0.0

    overlap = query_tokens & target_tokens
    return len(overlap) / len(query_tokens)


def _path_match_score(query: str, chunk: dict) -> float:
    """Score based on query terms appearing in file path."""
    path = (chunk.get("relative_file_path") or "").lower()
    query_lower = query.lower()

    # Check whole-word matches in path
    path_parts = set(re.split(r'[/\\_\-\.]', path))
    query_parts = set(re.findall(r'[a-zA-Z]\w*', query_lower))

    if not query_parts:
        return 0.0
    return len(path_parts & query_parts) / len(query_parts)


def _symbol_type_bonus(query: str, chunk: dict) -> float:
    """Small bonus for relevant symbol types."""
    symbol_type = chunk.get("symbol_type", "")
    query_lower = query.lower()

    bonuses = {
        "function": ["function", "method", "func", "call", "implement"],
        "class": ["class", "object", "model", "entity"],
        "method": ["method", "function"],
    }
    for stype, keywords in bonuses.items():
        if symbol_type == stype and any(k in query_lower for k in keywords):
            return 1.0
    return 0.0


def _import_match_score(query: str, chunk: dict) -> float:
    """Score if query mentions modules imported by this chunk."""
    imports = chunk.get("imports", [])
    if not imports:
        return 0.0

    query_lower = query.lower()
    matches = sum(1 for imp in imports if imp.lower() in query_lower)
    return min(1.0, matches / max(len(imports), 1))


def _semantic_similarity(query_embedding: np.ndarray, chunk_embedding: Optional[np.ndarray]) -> float:
    if chunk_embedding is None or query_embedding is None:
        return 0.0
    # Both should be already normalized
    return float(np.clip(np.dot(query_embedding, chunk_embedding), 0.0, 1.0))


def extract_features(
    query: str,
    item: dict,
    query_embedding: Optional[np.ndarray] = None,
    chunk_embeddings: Optional[Dict[str, np.ndarray]] = None,
    max_bm25_rank: int = 50,
) -> Dict[str, float]:
    chunk = item["chunk"]
    chunk_id = item["chunk_id"]

    chunk_embedding = None
    if chunk_embeddings and chunk_id in chunk_embeddings:
        chunk_embedding = chunk_embeddings[chunk_id]

    features = {
        "semantic_sim": _semantic_similarity(query_embedding, chunk_embedding),
        "bm25_rank_norm": _normalize_rank(item.get("bm25_rank"), max_bm25_rank),
        "vector_sim": float(item.get("vector_score") or 0.0),
        "identifier_match": _identifier_match_score(query, chunk),
        "path_match": _path_match_score(query, chunk),
        "symbol_type_bonus": _symbol_type_bonus(query, chunk),
        "import_match": _import_match_score(query, chunk),
        "class_match": 1.0 if chunk.get("containing_class") and chunk["containing_class"].lower() in query.lower() else 0.0,
    }
    return features


def compute_rerank_score(features: Dict[str, float]) -> float:
    return sum(WEIGHTS.get(k, 0.0) * v for k, v in features.items())


def _explain_ranking(features: Dict[str, float], score: float) -> str:
    """Generate a brief human-readable explanation."""
    top_features = sorted(
        [(k, v) for k, v in features.items() if v > 0.1],
        key=lambda x: x[1] * WEIGHTS.get(x[0], 0),
        reverse=True,
    )[:3]

    if not top_features:
        return "Low relevance across all signals."

    parts = []
    labels = {
        "semantic_sim": "semantic similarity",
        "bm25_rank_norm": "lexical match rank",
        "vector_sim": "vector similarity",
        "identifier_match": "identifier overlap",
        "path_match": "file path relevance",
        "symbol_type_bonus": "symbol type relevance",
        "import_match": "import reference",
        "class_match": "class name match",
    }
    for k, v in top_features:
        parts.append(f"{labels.get(k, k)} ({v:.2f})")

    return "Ranked by: " + ", ".join(parts) + f". Score: {score:.3f}"


def rerank(
    query: str,
    candidates: List[Dict],
    query_embedding: Optional[np.ndarray] = None,
    chunk_embeddings: Optional[Dict[str, np.ndarray]] = None,
    use_cross_encoder: bool = False,
    top_k: int = 10,
) -> List[Dict]:
    """
    Rerank candidates and return top_k results with scores and explanations.
    """
    if not candidates:
        return []

    max_bm25_rank = max(
        (item.get("bm25_rank") or 0 for item in candidates), default=50
    )

    scored = []
    for original_rank, item in enumerate(candidates, start=1):
        features = extract_features(
            query, item, query_embedding, chunk_embeddings, max_bm25_rank
        )
        score = compute_rerank_score(features)

        result = {
            **item,
            "original_rank": original_rank,
            "rerank_score": score,
            "rerank_features": features,
            "rerank_explanation": _explain_ranking(features, score),
            "reranker": "weighted_features",
        }
        scored.append(result)

    # Optional cross-encoder (if model is available and enabled)
    if use_cross_encoder:
        scored = _apply_cross_encoder(query, scored)

    # Sort by rerank_score descending
    scored.sort(key=lambda x: x["rerank_score"], reverse=True)

    # Assign final ranks
    for final_rank, item in enumerate(scored[:top_k], start=1):
        item["final_rank"] = final_rank

    return scored[:top_k]


def _apply_cross_encoder(query: str, candidates: List[Dict]) -> List[Dict]:
    """
    Apply cross-encoder reranker if model is available.
    Falls back silently if model is not installed.
    """
    model_name = os.getenv("RERANKER_MODEL", "")
    if not model_name or model_name == "lexical":
        return candidates

    try:
        from sentence_transformers import CrossEncoder
        model = CrossEncoder(model_name)
        pairs = [(query, item["chunk"]["source_code"][:512]) for item in candidates]
        ce_scores = model.predict(pairs)

        for item, ce_score in zip(candidates, ce_scores):
            # Blend cross-encoder score with weighted features
            item["cross_encoder_score"] = float(ce_score)
            # Weight: 50% cross-encoder, 50% feature score
            item["rerank_score"] = 0.5 * item["rerank_score"] + 0.5 * float(ce_score)
            item["reranker"] = "cross_encoder_blend"

    except Exception as e:
        print(f"[Reranker] Cross-encoder failed: {e}. Using feature reranker.")

    return candidates
