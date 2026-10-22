"""
Repository context extractor.
Extracts structural relationships (imports, function calls, class membership)
and expands retrieval results with bounded related context.
"""
import re
from typing import List, Dict, Set, Optional
from collections import defaultdict


# ── Relationship extraction ───────────────────────────────────

def extract_file_relationships(chunks: List[dict]) -> Dict[str, dict]:
    """
    Build a file-level relationship index from indexed chunks.
    Returns: {file_path → {imports, exports, functions, classes, called_by}}
    """
    index: Dict[str, dict] = defaultdict(lambda: {
        "imports": set(),
        "exports": set(),
        "functions": [],
        "classes": [],
        "called_by": set(),   # files that import this file
    })

    for chunk in chunks:
        path = chunk.get("relative_file_path", "")
        symbol = chunk.get("symbol_name")
        symbol_type = chunk.get("symbol_type", "")
        imports = chunk.get("imports", [])
        exports = chunk.get("exports", [])

        if symbol:
            if symbol_type == "function":
                index[path]["functions"].append(symbol)
            elif symbol_type == "class":
                index[path]["classes"].append(symbol)

        for imp in imports:
            index[path]["imports"].add(imp)

        for exp in exports:
            index[path]["exports"].add(exp)

    # Build called_by relationships
    for path, data in index.items():
        for imported_module in data["imports"]:
            # Fuzzy match: if a file path contains the module name
            for other_path in index:
                if imported_module.replace(".", "/") in other_path:
                    index[other_path]["called_by"].add(path)

    # Convert sets to lists for JSON serialization
    return {
        path: {
            "imports": list(data["imports"]),
            "exports": list(data["exports"]),
            "functions": list(set(data["functions"])),
            "classes": list(set(data["classes"])),
            "called_by": list(data["called_by"]),
        }
        for path, data in index.items()
    }


# ── Context expansion ─────────────────────────────────────────

def expand_context(
    top_chunks: List[Dict],
    all_chunks: List[dict],
    relationship_index: Dict[str, dict],
    max_extra: int = 3,
) -> List[Dict]:
    """
    Given top-ranked chunks, add a bounded number of related chunks
    (same file, imported files, calling files).

    Returns: top_chunks + added context chunks (deduplicated).
    """
    if not top_chunks or not all_chunks:
        return top_chunks

    included_ids: Set[str] = {item["chunk_id"] for item in top_chunks}
    top_files: Set[str] = {
        item["chunk"].get("relative_file_path", "") for item in top_chunks
    }

    # Build chunk lookup by file path
    file_to_chunks: Dict[str, List[dict]] = defaultdict(list)
    for chunk in all_chunks:
        file_to_chunks[chunk.get("relative_file_path", "")].append(chunk)

    # Collect related files
    related_files: Set[str] = set()
    for file_path in top_files:
        rel = relationship_index.get(file_path, {})
        for imp in rel.get("imports", [])[:3]:
            for other_path in file_to_chunks:
                if imp.replace(".", "/") in other_path:
                    related_files.add(other_path)
        for caller in rel.get("called_by", [])[:2]:
            related_files.add(caller)

    # Remove already-included files
    related_files -= top_files

    added = []
    for rel_file in list(related_files)[:max_extra]:
        related_chunks = file_to_chunks.get(rel_file, [])
        if not related_chunks:
            continue

        # Pick the first chunk from the related file
        for chunk in related_chunks[:1]:
            if chunk["chunk_id"] not in included_ids:
                added.append({
                    "chunk_id": chunk["chunk_id"],
                    "chunk": chunk,
                    "context_type": "related_file",
                    "context_reason": f"Imported by or imports from: {list(top_files)[0] if top_files else ''}",
                    "rerank_score": 0.0,
                    "final_rank": None,
                    "retrieval_source": "context_expansion",
                })
                included_ids.add(chunk["chunk_id"])
                if len(added) >= max_extra:
                    break
        if len(added) >= max_extra:
            break

    return top_chunks + added
