"""
Core chunk data model — the fundamental unit of indexed code.
"""
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class CodeChunk:
    chunk_id: str
    repository_id: str
    relative_file_path: str
    language: str
    start_line: int
    end_line: int
    symbol_name: Optional[str]
    symbol_type: Optional[str]  # function, class, method, module, snippet
    source_code: str
    imports: List[str] = field(default_factory=list)
    containing_class: Optional[str] = None
    file_summary: Optional[str] = None
    content_hash: str = ""
    embedding_model: str = ""
    parser_status: str = "ok"  # ok | fallback | error
    # Relationship extras
    calls: List[str] = field(default_factory=list)  # function names called
    exports: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "repository_id": self.repository_id,
            "relative_file_path": self.relative_file_path,
            "language": self.language,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "symbol_name": self.symbol_name,
            "symbol_type": self.symbol_type,
            "source_code": self.source_code,
            "imports": self.imports,
            "containing_class": self.containing_class,
            "file_summary": self.file_summary,
            "content_hash": self.content_hash,
            "embedding_model": self.embedding_model,
            "parser_status": self.parser_status,
            "calls": self.calls,
            "exports": self.exports,
        }
