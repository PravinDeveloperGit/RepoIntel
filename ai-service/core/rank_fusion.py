"""
Reciprocal Rank Fusion (RRF) for combining BM25 and vector retrieval results.
RRF(d) = Σ_i 1 / (k + rank_i(d))
"""
from typing import List, Dict, Optional


DEFAULT_K = 60  # Standard RRF constant


def reciprocal_rank_fusion(
    *result_lists: List[Dict],
    k: int = DEFAULT_K,
    top_k: int = 20,
) -> List[Dict]:
    """
    Combine multiple ranked result lists using RRF.
    Each result in a list must have 'chunk_id' and 'rank'.
    Returns merged list sorted by RRF score descending.
    """
    scores: Dict[str, float] = {}
    chunk_registry: Dict[str, dict] = {}
    source_ranks: Dict[str, Dict[str, int]] = {}  # chunk_id → {source: rank}
    source_scores: Dict[str, Dict[str, float]] = {}  # chunk_id → {source: score}

    for result_list in result_lists:
        for item in result_list:
            chunk_id = item["chunk_id"]
            rank = item["rank"]
            source = item.get("retrieval_source", "unknown")

            rrf_contribution = 1.0 / (k + rank)
            scores[chunk_id] = scores.get(chunk_id, 0.0) + rrf_contribution

            if chunk_id not in chunk_registry:
                chunk_registry[chunk_id] = item["chunk"]
                source_ranks[chunk_id] = {}
                source_scores[chunk_id] = {}

            source_ranks[chunk_id][source] = rank
            source_scores[chunk_id][source] = item.get("score", 0.0)

    # Sort by RRF score
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    results = []
    for final_rank, (chunk_id, rrf_score) in enumerate(ranked[:top_k], start=1):
        chunk = chunk_registry[chunk_id]
        results.append({
            "chunk_id": chunk_id,
            "rrf_score": rrf_score,
            "final_rank": final_rank,
            "bm25_rank": source_ranks[chunk_id].get("bm25"),
            "vector_rank": source_ranks[chunk_id].get("vector"),
            "bm25_score": source_scores[chunk_id].get("bm25"),
            "vector_score": source_scores[chunk_id].get("vector"),
            "retrieval_source": _retrieval_source(source_ranks[chunk_id]),
            "chunk": chunk,
        })

    return results


def _retrieval_source(source_ranks: Dict[str, int]) -> str:
    sources = list(source_ranks.keys())
    if len(sources) > 1:
        return "hybrid"
    return sources[0] if sources else "unknown"


def apply_metadata_filters(
    candidates: List[Dict],
    language_filter: Optional[str] = None,
    path_filter: Optional[str] = None,
    symbol_type_filter: Optional[str] = None,
) -> List[Dict]:
    """Apply post-fusion metadata filters."""
    filtered = []
    for item in candidates:
        chunk = item["chunk"]
        if language_filter and chunk.get("language") != language_filter:
            continue
        if path_filter and path_filter.lower() not in chunk.get("relative_file_path", "").lower():
            continue
        if symbol_type_filter and chunk.get("symbol_type") != symbol_type_filter:
            continue
        filtered.append(item)
    return filtered
