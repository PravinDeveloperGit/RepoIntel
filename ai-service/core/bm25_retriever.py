"""
BM25 retrieval engine.
Indexes code chunks using rank_bm25 with a code-aware tokenizer.
"""
import re
from typing import List, Dict, Optional

from rank_bm25 import BM25Okapi
from core.chunk import CodeChunk


def _code_tokenize(text: str) -> List[str]:
    """
    Tokenize code for BM25:
    - Split camelCase: myFunction → my Function
    - Split snake_case: my_function → my function
    - Split on punctuation boundaries
    - Lowercase
    """
    # Split camelCase
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    text = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', text)
    # Replace common code separators with spaces
    text = re.sub(r'[_\.\-/\\()\[\]{}<>,:;=+*&|!@#$%^~`\'"]', ' ', text)
    # Collapse whitespace
    tokens = text.lower().split()
    # Remove purely numeric tokens and very short tokens
    tokens = [t for t in tokens if len(t) > 1 and not t.isdigit()]
    return tokens


def build_bm25_corpus(chunks: List[CodeChunk]) -> List[List[str]]:
    """Build the tokenized corpus for BM25 indexing."""
    corpus = []
    for chunk in chunks:
        # Combine multiple fields with different weights by repetition
        text_parts = []
        # Symbol name has highest weight (repeat 3×)
        if chunk.symbol_name:
            text_parts.extend([chunk.symbol_name] * 3)
        # File path (repeat 2×)
        text_parts.extend([chunk.relative_file_path] * 2)
        # Imports
        text_parts.extend(chunk.imports)
        # Source code
        text_parts.append(chunk.source_code)
        # Containing class
        if chunk.containing_class:
            text_parts.extend([chunk.containing_class] * 2)

        combined = " ".join(text_parts)
        corpus.append(_code_tokenize(combined))
    return corpus


def build_bm25_index(chunks: List[CodeChunk]) -> BM25Okapi:
    corpus = build_bm25_corpus(chunks)
    if not corpus:
        # Return empty index
        return BM25Okapi([[]])
    return BM25Okapi(corpus)


def bm25_search(
    bm25_index: BM25Okapi,
    chunks: List[dict],
    query: str,
    top_k: int = 20,
    language_filter: Optional[str] = None,
    path_filter: Optional[str] = None,
    symbol_type_filter: Optional[str] = None,
) -> List[Dict]:
    """
    Run BM25 search and return top_k results with normalized scores.
    Returns list of {chunk_id, score, rank, chunk}.
    """
    if not chunks:
        return []

    tokens = _code_tokenize(query)
    if not tokens:
        return []

    scores = bm25_index.get_scores(tokens)

    # Build ranked results
    indexed = [
        (i, float(scores[i]), chunks[i])
        for i in range(len(chunks))
        if scores[i] > 0
    ]

    # Apply filters
    filtered = []
    for i, score, chunk in indexed:
        if language_filter and chunk.get("language") != language_filter:
            continue
        if path_filter and path_filter.lower() not in chunk.get("relative_file_path", "").lower():
            continue
        if symbol_type_filter and chunk.get("symbol_type") != symbol_type_filter:
            continue
        filtered.append((i, score, chunk))

    # Sort by score desc
    filtered.sort(key=lambda x: x[1], reverse=True)
    top = filtered[:top_k]

    # Normalize scores to [0, 1]
    if top:
        max_score = max(s for _, s, _ in top)
        if max_score > 0:
            results = [
                {
                    "chunk_id": chunk["chunk_id"],
                    "score": score / max_score,
                    "raw_score": score,
                    "rank": rank + 1,
                    "chunk": chunk,
                    "retrieval_source": "bm25",
                }
                for rank, (_, score, chunk) in enumerate(top)
            ]
        else:
            results = []
    else:
        results = []

    return results
