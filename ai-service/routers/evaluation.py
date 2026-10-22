"""
Evaluation router — runs experiment systems (A–E) and computes metrics.
"""
import time
import json
import os
import statistics
from typing import List, Optional, Dict, Any
from pathlib import Path

import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from core.bm25_retriever import bm25_search
from core.vector_retriever import vector_search, embed_texts
from core.rank_fusion import reciprocal_rank_fusion
from core.reranker import rerank
from core.context_expander import expand_context
from core.index_store import IndexStore

router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")
EVAL_RESULTS_DIR = Path(os.getenv("EVAL_RESULTS_PATH", "./evaluation_results"))
EVAL_RESULTS_DIR.mkdir(parents=True, exist_ok=True)


class EvalRequest(BaseModel):
    run_id: str
    system_variant: str  # A, B, C, D, E
    dataset_name: str = "custom"
    dataset_version: str = "v1"
    split_id: str = "test"
    repository_id: Optional[str] = None
    config: Dict[str, Any] = {}
    random_seed: int = 42


def _load_dataset(dataset_name: str, split_id: str) -> List[dict]:
    """Load evaluation queries from a dataset file."""
    dataset_path = Path(os.getenv("EVAL_DATASET_PATH", "./datasets"))
    query_file = dataset_path / dataset_name / f"{split_id}_queries.json"

    if not query_file.exists():
        print(f"[Eval] Dataset not found: {query_file}")
        return []

    with open(query_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _retrieve_for_variant(
    variant: str,
    idx,
    query: str,
    top_k: int = 10,
) -> List[dict]:
    """Run retrieval for a given system variant."""
    bm25_results = []
    vector_results = []
    query_embedding = None

    # System A — BM25 only
    if variant in ("A",):
        if idx.bm25_index:
            bm25_results = bm25_search(idx.bm25_index, idx.chunks, query, top_k=top_k * 3)
        return bm25_results[:top_k]

    # System B — Vector only
    if variant in ("B",):
        if idx.faiss_index and idx.faiss_index.ntotal > 0:
            vector_results = vector_search(idx.faiss_index, idx.chunks, query, top_k=top_k * 3)
        return vector_results[:top_k]

    # System C — Hybrid (no rerank)
    if idx.bm25_index:
        bm25_results = bm25_search(idx.bm25_index, idx.chunks, query, top_k=top_k * 3)
    if idx.faiss_index and idx.faiss_index.ntotal > 0:
        vector_results = vector_search(idx.faiss_index, idx.chunks, query, top_k=top_k * 3)
        query_embedding = embed_texts([query])[0]

    fused = reciprocal_rank_fusion(bm25_results, vector_results, top_k=top_k * 2)

    if variant == "C":
        return fused[:top_k]

    # System D — Hybrid + Rerank
    ranked = rerank(query, fused, query_embedding, top_k=top_k)
    if variant == "D":
        return ranked

    # System E — Hybrid + Rerank + Context
    expanded = expand_context(ranked, idx.chunks, idx.relationship_index, max_extra=2)
    return expanded


def _chunk_is_relevant(chunk: dict, relevant_paths: List[str], relevant_symbols: List[str]) -> bool:
    """Check if a chunk matches the relevant ground truth."""
    file_path = chunk.get("relative_file_path", "").lower()
    symbol = (chunk.get("symbol_name") or "").lower()

    for rp in relevant_paths:
        if rp.lower() in file_path or file_path.endswith(rp.lower()):
            return True
    for rs in relevant_symbols:
        if rs.lower() == symbol:
            return True
    return False


def _compute_metrics(
    per_query_results: List[dict],
) -> dict:
    """Compute Success@K, MRR, and Precision@K from per-query results."""
    n = len(per_query_results)
    if n == 0:
        return {}

    success_1 = sum(1 for r in per_query_results if r["first_relevant_rank"] == 1) / n
    success_5 = sum(1 for r in per_query_results if r["first_relevant_rank"] is not None and r["first_relevant_rank"] <= 5) / n
    success_10 = sum(1 for r in per_query_results if r["first_relevant_rank"] is not None and r["first_relevant_rank"] <= 10) / n

    rr_values = [1.0 / r["first_relevant_rank"] for r in per_query_results if r["first_relevant_rank"] is not None]
    mrr = statistics.mean(rr_values) if rr_values else 0.0

    p5_values = [r.get("precision_5", 0.0) for r in per_query_results]
    p10_values = [r.get("precision_10", 0.0) for r in per_query_results]

    latencies = [r.get("latency_ms", 0) for r in per_query_results]

    return {
        "success_at_1": round(success_1, 4),
        "success_at_5": round(success_5, 4),
        "success_at_10": round(success_10, 4),
        "mrr": round(mrr, 4),
        "precision_at_5": round(statistics.mean(p5_values), 4) if p5_values else 0.0,
        "precision_at_10": round(statistics.mean(p10_values), 4) if p10_values else 0.0,
        "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else 0.0,
        "p50_latency_ms": round(statistics.median(latencies), 2) if latencies else 0.0,
        "p90_latency_ms": round(sorted(latencies)[int(0.9 * len(latencies))], 2) if len(latencies) > 1 else 0.0,
        "sample_count": n,
    }


def _run_evaluation(request: EvalRequest):
    """Background evaluation task."""
    print(f"[Eval] Starting run {request.run_id}, variant {request.system_variant}")

    # Notify backend
    try:
        requests.patch(
            f"{BACKEND_URL}/api/internal/evaluation/{request.run_id}",
            json={"status": "running"},
            timeout=5,
        )
    except Exception:
        pass

    try:
        queries = _load_dataset(request.dataset_name, request.split_id)

        if not queries:
            raise ValueError(f"No queries loaded from dataset '{request.dataset_name}' split '{request.split_id}'")

        idx = IndexStore.get(request.repository_id) if request.repository_id else None

        per_query = []
        for q in queries:
            query_text = q.get("query", "")
            relevant_paths = q.get("relevant_file_paths", [])
            relevant_symbols = q.get("relevant_symbols", [])
            repo_id = q.get("repository_id", request.repository_id)

            if not query_text:
                continue

            # Load index for this query's repository
            q_idx = IndexStore.get(repo_id) if repo_id else idx
            if q_idx is None or not q_idx.chunks:
                per_query.append({
                    "query_id": q.get("query_id"),
                    "query": query_text,
                    "first_relevant_rank": None,
                    "precision_5": 0.0,
                    "precision_10": 0.0,
                    "latency_ms": 0,
                    "error": "No index available",
                })
                continue

            start = time.time()
            try:
                results = _retrieve_for_variant(
                    request.system_variant, q_idx, query_text, top_k=10
                )
                latency_ms = int((time.time() - start) * 1000)

                # Find first relevant rank
                first_relevant_rank = None
                relevant_count_5 = 0
                relevant_count_10 = 0

                for rank, item in enumerate(results, start=1):
                    chunk = item.get("chunk", {})
                    is_relevant = _chunk_is_relevant(chunk, relevant_paths, relevant_symbols)
                    if is_relevant:
                        if first_relevant_rank is None:
                            first_relevant_rank = rank
                        if rank <= 5:
                            relevant_count_5 += 1
                        if rank <= 10:
                            relevant_count_10 += 1

                per_query.append({
                    "query_id": q.get("query_id"),
                    "query": query_text,
                    "first_relevant_rank": first_relevant_rank,
                    "precision_5": relevant_count_5 / 5,
                    "precision_10": relevant_count_10 / 10,
                    "latency_ms": latency_ms,
                    "error": None,
                })

            except Exception as e:
                per_query.append({
                    "query_id": q.get("query_id"),
                    "query": query_text,
                    "first_relevant_rank": None,
                    "precision_5": 0.0,
                    "precision_10": 0.0,
                    "latency_ms": 0,
                    "error": str(e),
                })

        metrics = _compute_metrics(per_query)

        # Save results
        result_file = EVAL_RESULTS_DIR / f"{request.run_id}.json"
        with open(result_file, "w", encoding="utf-8") as f:
            json.dump({
                "run_id": request.run_id,
                "system_variant": request.system_variant,
                "dataset_name": request.dataset_name,
                "split_id": request.split_id,
                "config": request.config,
                "random_seed": request.random_seed,
                "metrics": metrics,
                "per_query_results": per_query,
            }, f, indent=2)

        # Notify backend
        try:
            requests.post(
                f"{BACKEND_URL}/api/internal/evaluation/{request.run_id}/complete",
                json={"metrics": metrics, "sampleCount": len(per_query)},
                timeout=10,
            )
        except Exception as e:
            print(f"[Eval] Could not notify backend: {e}")

        print(f"[Eval] Run {request.run_id} complete: {metrics}")

    except Exception as e:
        import traceback
        print(f"[Eval] Run {request.run_id} FAILED: {e}")
        traceback.print_exc()
        try:
            requests.post(
                f"{BACKEND_URL}/api/internal/evaluation/{request.run_id}/fail",
                json={"error": str(e)},
                timeout=5,
            )
        except Exception:
            pass


@router.post("/evaluate")
async def start_evaluation(request: EvalRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_evaluation, request)
    return {"message": "Evaluation started", "run_id": request.run_id}
