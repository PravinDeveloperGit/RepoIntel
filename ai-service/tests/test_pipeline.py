"""
AI service unit tests.
Run with: py -3 -m pytest ai-service/tests/ -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from core.chunker import chunk_file, detect_language, _code_tokenize
from core.bm25_retriever import bm25_search, build_bm25_index
from core.rank_fusion import reciprocal_rank_fusion
from core.reranker import rerank, extract_features, compute_rerank_score
from core.context_expander import extract_file_relationships


# ── Chunker tests ─────────────────────────────────────────────

class TestChunker:
    def test_detect_python(self):
        assert detect_language("foo.py") == "python"

    def test_detect_typescript(self):
        assert detect_language("bar.ts") == "typescript"

    def test_detect_javascript(self):
        assert detect_language("baz.js") == "javascript"

    def test_detect_unknown(self):
        assert detect_language("file.xyz") is None

    def test_chunk_python_function(self):
        source = '''
def authenticate_user(email: str, password: str) -> bool:
    """Validate user credentials against the database."""
    user = db.find_by_email(email)
    if not user:
        return False
    return user.check_password(password)
'''
        chunks, status = chunk_file(source, "auth.py", "repo1")
        assert len(chunks) > 0
        assert any(c.symbol_name == "authenticate_user" for c in chunks)

    def test_chunk_javascript_function(self):
        source = '''
function validateToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload;
}
'''
        chunks, status = chunk_file(source, "auth.js", "repo1")
        assert len(chunks) > 0

    def test_fallback_chunking(self):
        """Fallback chunking should still produce chunks."""
        source = "\n".join([f"line {i}" for i in range(100)])
        chunks, status = chunk_file(source, "file.py", "repo1")
        assert len(chunks) > 0
        # Status may be ok (parsed but no symbols) or fallback
        assert status in ("ok", "fallback")

    def test_empty_file(self):
        chunks, status = chunk_file("", "empty.py", "repo1")
        # Empty file can produce 0 chunks or fallback
        assert isinstance(chunks, list)

    def test_line_numbers(self):
        source = '''
def foo():
    pass

def bar():
    return 42
'''
        chunks, _ = chunk_file(source, "test.py", "repo1")
        for chunk in chunks:
            assert chunk.start_line >= 1
            assert chunk.end_line >= chunk.start_line


# ── Tokenizer tests ───────────────────────────────────────────

class TestTokenizer:
    def test_camel_case(self):
        tokens = _code_tokenize("authenticateUser")
        assert "authenticate" in tokens
        assert "user" in tokens

    def test_snake_case(self):
        tokens = _code_tokenize("validate_user_token")
        assert "validate" in tokens
        assert "user" in tokens
        assert "token" in tokens

    def test_removes_short_tokens(self):
        tokens = _code_tokenize("a b c def")
        assert "a" not in tokens
        assert "def" in tokens


# ── BM25 tests ────────────────────────────────────────────────

class TestBM25:
    def _make_chunks(self):
        from core.chunk import CodeChunk
        return [
            CodeChunk(
                chunk_id="c1", repository_id="r1",
                relative_file_path="auth/jwt.py",
                language="python", start_line=1, end_line=10,
                symbol_name="verify_token", symbol_type="function",
                source_code="def verify_token(token): return jwt.decode(token, SECRET)",
                imports=["jwt"],
            ),
            CodeChunk(
                chunk_id="c2", repository_id="r1",
                relative_file_path="models/user.py",
                language="python", start_line=1, end_line=20,
                symbol_name="User", symbol_type="class",
                source_code="class User: pass",
                imports=[],
            ),
            CodeChunk(
                chunk_id="c3", repository_id="r1",
                relative_file_path="routes/auth.py",
                language="python", start_line=1, end_line=30,
                symbol_name="login", symbol_type="function",
                source_code="def login(email, password): authenticate(email, password)",
                imports=[],
            ),
        ]

    def test_bm25_finds_relevant_result(self):
        chunks = self._make_chunks()
        bm25_idx = build_bm25_index(chunks)
        chunk_dicts = [c.to_dict() for c in chunks]

        results = bm25_search(bm25_idx, chunk_dicts, "verify JWT token", top_k=3)
        assert len(results) > 0
        # verify_token should rank highly
        assert any("verify_token" in r["chunk"]["symbol_name"] for r in results[:2] if r["chunk"].get("symbol_name"))

    def test_bm25_empty_query(self):
        from core.chunk import CodeChunk
        chunks = self._make_chunks()
        bm25_idx = build_bm25_index(chunks)
        chunk_dicts = [c.to_dict() for c in chunks]
        results = bm25_search(bm25_idx, chunk_dicts, "", top_k=3)
        assert results == []

    def test_bm25_language_filter(self):
        from core.chunk import CodeChunk
        chunks = self._make_chunks()
        bm25_idx = build_bm25_index(chunks)
        chunk_dicts = [c.to_dict() for c in chunks]

        results = bm25_search(bm25_idx, chunk_dicts, "login", top_k=10, language_filter="javascript")
        # All our chunks are python, so filter should return nothing
        assert results == []


# ── Rank fusion tests ─────────────────────────────────────────

class TestRankFusion:
    def _make_results(self, ids_and_ranks, source="bm25"):
        return [
            {"chunk_id": cid, "rank": rank, "score": 1.0 / rank,
             "raw_score": 1.0, "chunk": {"chunk_id": cid}, "retrieval_source": source}
            for cid, rank in ids_and_ranks
        ]

    def test_rrf_combines_lists(self):
        bm25 = self._make_results([("c1", 1), ("c2", 2), ("c3", 3)], "bm25")
        vec = self._make_results([("c2", 1), ("c1", 2), ("c4", 3)], "vector")
        fused = reciprocal_rank_fusion(bm25, vec, top_k=5)
        assert len(fused) >= 1

    def test_rrf_deduplicates(self):
        bm25 = self._make_results([("c1", 1)], "bm25")
        vec = self._make_results([("c1", 1)], "vector")
        fused = reciprocal_rank_fusion(bm25, vec, top_k=5)
        chunk_ids = [r["chunk_id"] for r in fused]
        assert len(chunk_ids) == len(set(chunk_ids))

    def test_rrf_higher_combined_ranks(self):
        """A chunk ranked highly in both lists should rank higher after fusion."""
        bm25 = self._make_results([("c1", 1), ("c2", 2)], "bm25")
        vec = self._make_results([("c1", 1), ("c2", 2)], "vector")
        fused = reciprocal_rank_fusion(bm25, vec, top_k=5)
        assert fused[0]["chunk_id"] == "c1"

    def test_rrf_empty_input(self):
        result = reciprocal_rank_fusion([], [], top_k=5)
        assert result == []


# ── Reranker tests ────────────────────────────────────────────

class TestReranker:
    def _make_candidate(self, chunk_id, symbol_name, file_path, bm25_rank=1, vector_score=0.8):
        return {
            "chunk_id": chunk_id,
            "bm25_rank": bm25_rank,
            "vector_rank": 1,
            "bm25_score": 0.9,
            "vector_score": vector_score,
            "rrf_score": 0.1,
            "retrieval_source": "hybrid",
            "chunk": {
                "chunk_id": chunk_id,
                "symbol_name": symbol_name,
                "symbol_type": "function",
                "relative_file_path": file_path,
                "source_code": f"def {symbol_name}(): pass",
                "imports": [],
                "language": "python",
            },
        }

    def test_reranker_returns_top_k(self):
        candidates = [
            self._make_candidate("c1", "authenticate_user", "auth.py"),
            self._make_candidate("c2", "create_user", "users.py"),
            self._make_candidate("c3", "validate_email", "validators.py"),
        ]
        ranked = rerank("authenticate user", candidates, top_k=2)
        assert len(ranked) == 2

    def test_reranker_assigns_final_rank(self):
        candidates = [self._make_candidate("c1", "verify_jwt", "auth.py")]
        ranked = rerank("verify jwt token", candidates, top_k=5)
        assert all("final_rank" in r for r in ranked)

    def test_reranker_explanation_present(self):
        candidates = [self._make_candidate("c1", "login", "routes/auth.py")]
        ranked = rerank("login endpoint", candidates, top_k=5)
        assert all("rerank_explanation" in r for r in ranked)

    def test_feature_extraction(self):
        candidate = self._make_candidate("c1", "authenticate_user", "auth/middleware.py")
        features = extract_features("authenticate user", candidate)
        assert "identifier_match" in features
        assert features["identifier_match"] > 0


# ── Relationship extraction tests ─────────────────────────────

class TestRelationships:
    def test_extracts_imports(self):
        chunks = [
            {
                "chunk_id": "c1",
                "relative_file_path": "auth.py",
                "symbol_name": "login",
                "symbol_type": "function",
                "imports": ["models", "utils"],
                "exports": [],
            }
        ]
        rel = extract_file_relationships(chunks)
        assert "auth.py" in rel
        assert "models" in rel["auth.py"]["imports"]

    def test_extracts_functions(self):
        chunks = [
            {
                "chunk_id": "c1",
                "relative_file_path": "auth.py",
                "symbol_name": "login",
                "symbol_type": "function",
                "imports": [],
                "exports": [],
            }
        ]
        rel = extract_file_relationships(chunks)
        assert "login" in rel["auth.py"]["functions"]

    def test_extracts_classes(self):
        chunks = [
            {
                "chunk_id": "c1",
                "relative_file_path": "models.py",
                "symbol_name": "UserModel",
                "symbol_type": "class",
                "imports": [],
                "exports": [],
            }
        ]
        rel = extract_file_relationships(chunks)
        assert "UserModel" in rel["models.py"]["classes"]


# ── Metrics tests ─────────────────────────────────────────────

class TestMetrics:
    """Test the evaluation metric calculations."""

    def _mrr(self, per_query):
        rr = [1.0 / r["first_relevant_rank"] for r in per_query if r["first_relevant_rank"]]
        return sum(rr) / len(per_query) if per_query else 0.0

    def test_mrr_first_position(self):
        q = [{"first_relevant_rank": 1}]
        assert self._mrr(q) == 1.0

    def test_mrr_second_position(self):
        q = [{"first_relevant_rank": 2}]
        assert abs(self._mrr(q) - 0.5) < 0.001

    def test_mrr_no_relevant(self):
        q = [{"first_relevant_rank": None}]
        assert self._mrr(q) == 0.0

    def test_success_at_1(self):
        results = [{"first_relevant_rank": 1}, {"first_relevant_rank": 2}]
        s1 = sum(1 for r in results if r["first_relevant_rank"] == 1) / len(results)
        assert s1 == 0.5

    def test_success_at_5(self):
        results = [{"first_relevant_rank": 5}, {"first_relevant_rank": 6}]
        s5 = sum(1 for r in results if r["first_relevant_rank"] is not None and r["first_relevant_rank"] <= 5) / len(results)
        assert s5 == 0.5
