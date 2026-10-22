"""
Syntax-aware chunker using tree-sitter for Python, JavaScript, and TypeScript.
Falls back to line-based chunking when parsing fails.
"""
import re
import hashlib
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

from core.chunk import CodeChunk

# ── Language detection ────────────────────────────────────────
EXTENSION_TO_LANG = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".cpp": "cpp",
    ".c": "c",
    ".cs": "csharp",
    ".php": "php",
    ".swift": "swift",
    ".kt": "kotlin",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sh": "bash",
}

SUPPORTED_LANGUAGES = {"python", "javascript", "typescript"}

MAX_CHUNK_CHARS = 3000   # ~750 tokens at 4 chars/token
MIN_CHUNK_CHARS = 30


def detect_language(file_path: str) -> Optional[str]:
    ext = Path(file_path).suffix.lower()
    return EXTENSION_TO_LANG.get(ext)


def _content_hash(source: str) -> str:
    return hashlib.md5(source.encode("utf-8")).hexdigest()


# ── Tree-sitter parser (lazy import) ─────────────────────────
def _try_treesitter_parse(source: str, language: str):
    """Returns (tree, parser) or (None, None) if unavailable."""
    try:
        import tree_sitter_python as tspython
        import tree_sitter_javascript as tsjavascript
        import tree_sitter_typescript as tstypescript
        from tree_sitter import Language, Parser

        lang_map = {
            "python": tspython.language(),
            "javascript": tsjavascript.language(),
            "typescript": tstypescript.language_typescript(),
        }
        if language not in lang_map:
            return None, None

        lang = Language(lang_map[language])
        parser = Parser(lang)
        tree = parser.parse(bytes(source, "utf-8"))
        return tree, parser
    except ImportError:
        return None, None
    except Exception:
        return None, None


# ── Import extraction ─────────────────────────────────────────
def _extract_imports_regex(source: str, language: str) -> List[str]:
    imports = []
    if language == "python":
        for m in re.finditer(r'^(?:import|from)\s+(\S+)', source, re.MULTILINE):
            imports.append(m.group(1).split(".")[0])
    elif language in ("javascript", "typescript"):
        for m in re.finditer(
            r'''(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))''',
            source,
        ):
            imports.append(m.group(1) or m.group(2))
    return list(set(imports))


def _extract_calls_regex(source: str) -> List[str]:
    """Very rough function-call extraction."""
    calls = list(set(re.findall(r'\b([a-zA-Z_]\w*)\s*\(', source)))
    # Filter out common keywords
    builtins = {"if", "for", "while", "with", "return", "print", "len", "range"}
    return [c for c in calls if c not in builtins][:20]


# ── Tree-sitter AST chunking ──────────────────────────────────
def _node_text(node, source_bytes: bytes) -> str:
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _chunk_from_node(
    node,
    source_bytes: bytes,
    repository_id: str,
    file_path: str,
    language: str,
    containing_class: Optional[str] = None,
) -> Optional[CodeChunk]:
    text = _node_text(node, source_bytes)
    if len(text) < MIN_CHUNK_CHARS:
        return None

    # Truncate very large chunks
    if len(text) > MAX_CHUNK_CHARS:
        text = text[:MAX_CHUNK_CHARS]

    symbol_name = None
    symbol_type = None

    if node.type in ("function_definition", "async_function_definition"):
        symbol_type = "function"
        for child in node.children:
            if child.type == "identifier":
                symbol_name = _node_text(child, source_bytes)
                break
    elif node.type in ("class_definition", "class_declaration"):
        symbol_type = "class"
        for child in node.children:
            if child.type == "identifier":
                symbol_name = _node_text(child, source_bytes)
                break
    elif node.type in (
        "function_declaration",
        "arrow_function",
        "method_definition",
        "lexical_declaration",
    ):
        symbol_type = "function"
        for child in node.children:
            if child.type in ("identifier", "property_identifier"):
                symbol_name = _node_text(child, source_bytes)
                break

    imports = _extract_imports_regex(text, language)
    calls = _extract_calls_regex(text)

    return CodeChunk(
        chunk_id=str(uuid.uuid4()),
        repository_id=repository_id,
        relative_file_path=file_path,
        language=language,
        start_line=node.start_point[0] + 1,
        end_line=node.end_point[0] + 1,
        symbol_name=symbol_name,
        symbol_type=symbol_type or "snippet",
        source_code=text,
        imports=imports,
        containing_class=containing_class,
        content_hash=_content_hash(text),
        parser_status="ok",
        calls=calls,
    )


CHUNK_NODE_TYPES = {
    "python": {
        "function_definition",
        "async_function_definition",
        "class_definition",
    },
    "javascript": {
        "function_declaration",
        "arrow_function",
        "class_declaration",
        "method_definition",
        "lexical_declaration",
        "export_statement",
    },
    "typescript": {
        "function_declaration",
        "arrow_function",
        "class_declaration",
        "method_definition",
        "interface_declaration",
        "type_alias_declaration",
        "export_statement",
        "lexical_declaration",
    },
}


def _treesitter_chunks(
    tree,
    source_bytes: bytes,
    repository_id: str,
    file_path: str,
    language: str,
) -> List[CodeChunk]:
    chunks = []
    target_types = CHUNK_NODE_TYPES.get(language, set())

    def visit(node, containing_class=None):
        if node.type in target_types:
            chunk = _chunk_from_node(
                node, source_bytes, repository_id, file_path, language, containing_class
            )
            if chunk:
                chunks.append(chunk)
            # Track class context for nested methods
            new_class = containing_class
            if node.type in ("class_definition", "class_declaration"):
                new_class = chunk.symbol_name if chunk else containing_class
            for child in node.children:
                visit(child, new_class)
        else:
            for child in node.children:
                visit(child, containing_class)

    visit(tree.root_node)
    return chunks


# ── Fallback line-based chunker ───────────────────────────────
def _fallback_chunks(
    source: str,
    repository_id: str,
    file_path: str,
    language: str,
) -> List[CodeChunk]:
    lines = source.splitlines()
    chunks = []
    chunk_size = 40  # lines
    overlap = 5

    i = 0
    while i < len(lines):
        end = min(i + chunk_size, len(lines))
        block = "\n".join(lines[i:end])
        if len(block.strip()) >= MIN_CHUNK_CHARS:
            imports = _extract_imports_regex(block, language)
            calls = _extract_calls_regex(block)
            chunks.append(
                CodeChunk(
                    chunk_id=str(uuid.uuid4()),
                    repository_id=repository_id,
                    relative_file_path=file_path,
                    language=language,
                    start_line=i + 1,
                    end_line=end,
                    symbol_name=None,
                    symbol_type="snippet",
                    source_code=block,
                    imports=imports,
                    content_hash=_content_hash(block),
                    parser_status="fallback",
                    calls=calls,
                )
            )
        i += chunk_size - overlap

    return chunks


# ── Public API ────────────────────────────────────────────────
def chunk_file(
    source: str,
    file_path: str,
    repository_id: str,
    embedding_model: str = "",
) -> Tuple[List[CodeChunk], str]:
    """
    Returns (chunks, parser_status).
    parser_status: 'ok' | 'fallback' | 'unsupported'
    """
    language = detect_language(file_path)
    if not language:
        return [], "unsupported"

    if language not in SUPPORTED_LANGUAGES:
        # Text fallback for unsupported but allowed languages
        chunks = _fallback_chunks(source, repository_id, file_path, language)
        return chunks, "fallback"

    source_bytes = source.encode("utf-8")
    tree, _ = _try_treesitter_parse(source, language)

    if tree is not None:
        chunks = _treesitter_chunks(tree, source_bytes, repository_id, file_path, language)
        if not chunks:
            # File parsed but had no top-level symbols — use fallback
            chunks = _fallback_chunks(source, repository_id, file_path, language)
            status = "fallback"
        else:
            status = "ok"
    else:
        chunks = _fallback_chunks(source, repository_id, file_path, language)
        status = "fallback"

    for chunk in chunks:
        chunk.embedding_model = embedding_model

    return chunks, status
