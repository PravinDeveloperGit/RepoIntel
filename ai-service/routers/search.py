"""
Search router — hybrid retrieval with BM25, vector, RRF fusion, and reranking.
"""
import time
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.bm25_retriever import bm25_search
from core.vector_retriever import vector_search, embed_texts
from core.rank_fusion import reciprocal_rank_fusion, apply_metadata_filters
from core.reranker import rerank
from core.context_expander import expand_context
from core.index_store import IndexStore

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    repository_id: str
    mode: str = "hybrid_rerank"  # bm25 | vector | hybrid | hybrid_rerank | hybrid_rerank_context
    top_k: int = Field(default=10, ge=1, le=50)
    language_filter: Optional[str] = None
    path_filter: Optional[str] = None
    symbol_type_filter: Optional[str] = None
    reranker_enabled: bool = True
    context_expansion: bool = False
    rrf_k: int = 60


@router.post("/search")
async def search(request: SearchRequest):
    start = time.time()

    idx = IndexStore.get(request.repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found. Please index the repository first.")

    if not idx.chunks:
        return {"results": [], "total_candidates": 0, "duration_ms": 0, "mode": request.mode}

    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    bm25_results = []
    vector_results = []
    query_embedding = None

    # ── BM25 retrieval ────────────────────────────────────────
    if request.mode in ("bm25", "hybrid", "hybrid_rerank", "hybrid_rerank_context"):
        if idx.bm25_index is not None:
            bm25_results = bm25_search(
                idx.bm25_index,
                idx.chunks,
                query,
                top_k=request.top_k * 3,
                language_filter=request.language_filter,
                path_filter=request.path_filter,
                symbol_type_filter=request.symbol_type_filter,
            )

    # ── Vector retrieval ──────────────────────────────────────
    if request.mode in ("vector", "hybrid", "hybrid_rerank", "hybrid_rerank_context"):
        if idx.faiss_index is not None and idx.faiss_index.ntotal > 0:
            vector_results = vector_search(
                idx.faiss_index,
                idx.chunks,
                query,
                top_k=request.top_k * 3,
                language_filter=request.language_filter,
                path_filter=request.path_filter,
                symbol_type_filter=request.symbol_type_filter,
            )
            # Compute query embedding for reranker
            query_embedding = embed_texts([query])[0]

    # ── Fusion ────────────────────────────────────────────────
    if request.mode == "bm25":
        candidates = bm25_results[: request.top_k * 2]
    elif request.mode == "vector":
        candidates = vector_results[: request.top_k * 2]
    else:
        candidates = reciprocal_rank_fusion(
            bm25_results,
            vector_results,
            k=request.rrf_k,
            top_k=request.top_k * 2,
        )

    total_candidates = len(candidates)

    # ── Reranking ─────────────────────────────────────────────
    if request.reranker_enabled and request.mode in (
        "hybrid_rerank", "hybrid_rerank_context"
    ):
        candidates = rerank(
            query=query,
            candidates=candidates,
            query_embedding=query_embedding,
            top_k=request.top_k,
        )
    else:
        # Apply simple rank trimming
        for i, c in enumerate(candidates[: request.top_k], start=1):
            c["final_rank"] = i
        candidates = candidates[: request.top_k]

    # ── Context expansion ─────────────────────────────────────
    if request.context_expansion or request.mode == "hybrid_rerank_context":
        candidates = expand_context(
            candidates,
            idx.chunks,
            idx.relationship_index,
            max_extra=3,
        )

    duration_ms = int((time.time() - start) * 1000)

    # Serialize results (avoid returning full source if too long)
    results = []
    for item in candidates:
        chunk = item.get("chunk", {})
        results.append({
            "chunkId": item.get("chunk_id"),
            "filePath": chunk.get("relative_file_path"),
            "language": chunk.get("language"),
            "startLine": chunk.get("start_line"),
            "endLine": chunk.get("end_line"),
            "symbolName": chunk.get("symbol_name"),
            "symbolType": chunk.get("symbol_type"),
            "sourceCode": chunk.get("source_code", "")[:2000],
            "imports": chunk.get("imports", []),
            "containingClass": chunk.get("containing_class"),
            "parserStatus": chunk.get("parser_status"),
            # Retrieval metadata
            "rrfScore": item.get("rrf_score"),
            "bm25Rank": item.get("bm25_rank"),
            "vectorRank": item.get("vector_rank"),
            "bm25Score": item.get("bm25_score"),
            "vectorScore": item.get("vector_score"),
            "rerankScore": item.get("rerank_score"),
            "rerankFeatures": item.get("rerank_features"),
            "rerankExplanation": item.get("rerank_explanation"),
            "finalRank": item.get("final_rank"),
            "retrievalSource": item.get("retrieval_source", "unknown"),
            "contextType": item.get("context_type"),
            "contextReason": item.get("context_reason"),
        })

    return {
        "results": results,
        "total_candidates": total_candidates,
        "duration_ms": duration_ms,
        "mode": request.mode,
        "query": query,
    }
