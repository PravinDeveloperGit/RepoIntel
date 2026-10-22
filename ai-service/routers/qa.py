"""
Q&A router — retrieve evidence and generate grounded answers.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.bm25_retriever import bm25_search
from core.vector_retriever import vector_search, embed_texts
from core.rank_fusion import reciprocal_rank_fusion
from core.reranker import rerank
from core.qa_engine import answer_question
from core.index_store import IndexStore

router = APIRouter()


class QARequest(BaseModel):
    question: str
    repository_id: str
    top_k: int = Field(default=8, ge=1, le=20)


@router.post("/qa")
async def answer(request: QARequest):
    idx = IndexStore.get(request.repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found.")

    if not idx.chunks:
        return {
            "answer": "Insufficient evidence: the repository has no indexed code.",
            "citations": [],
            "evidenceChunkIds": [],
            "evidenceSufficient": False,
        }

    # Retrieve evidence
    bm25_results = []
    vector_results = []
    query_embedding = None

    if idx.bm25_index:
        bm25_results = bm25_search(idx.bm25_index, idx.chunks, request.question, top_k=request.top_k * 2)

    if idx.faiss_index and idx.faiss_index.ntotal > 0:
        vector_results = vector_search(idx.faiss_index, idx.chunks, request.question, top_k=request.top_k * 2)
        query_embedding = embed_texts([request.question])[0]

    # Fuse and rerank
    candidates = reciprocal_rank_fusion(bm25_results, vector_results, top_k=request.top_k * 2)
    ranked = rerank(request.question, candidates, query_embedding, top_k=request.top_k)

    evidence_chunks = [item["chunk"] for item in ranked]

    # Generate answer
    answer_text, citations, evidence_sufficient = answer_question(request.question, evidence_chunks)

    evidence_chunk_ids = [item["chunk_id"] for item in ranked]

    return {
        "answer": answer_text,
        "citations": citations,
        "evidenceChunkIds": evidence_chunk_ids,
        "evidenceSufficient": evidence_sufficient,
    }
