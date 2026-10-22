"""
Repository metadata router — files, source viewer, symbols, relationships.
"""
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from core.index_store import IndexStore

router = APIRouter()


@router.get("/repository/{repository_id}/files")
async def list_files(repository_id: str):
    idx = IndexStore.get(repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found.")

    # Deduplicate file paths
    files = list({c["relative_file_path"] for c in idx.chunks})
    files.sort()

    return {"files": files, "total": len(files)}


@router.get("/repository/{repository_id}/source")
async def get_source(
    repository_id: str,
    path: str = Query(...),
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
):
    idx = IndexStore.get(repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found.")

    # Find chunks for this file
    matching = [c for c in idx.chunks if c["relative_file_path"] == path]
    if not matching:
        raise HTTPException(status_code=404, detail=f"File not found in index: {path}")

    # Merge all chunks for the file, sorted by start line
    matching.sort(key=lambda c: c["start_line"])

    # If line range specified, filter chunks
    if start_line is not None and end_line is not None:
        matching = [
            c for c in matching
            if c["start_line"] <= end_line and c["end_line"] >= start_line
        ]

    return {
        "filePath": path,
        "language": matching[0]["language"] if matching else "",
        "chunks": [
            {
                "chunkId": c["chunk_id"],
                "startLine": c["start_line"],
                "endLine": c["end_line"],
                "symbolName": c["symbol_name"],
                "symbolType": c["symbol_type"],
                "sourceCode": c["source_code"],
            }
            for c in matching
        ],
    }


@router.get("/repository/{repository_id}/symbols")
async def list_symbols(
    repository_id: str,
    language: Optional[str] = None,
    symbol_type: Optional[str] = None,
    path: Optional[str] = None,
):
    idx = IndexStore.get(repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found.")

    symbols = []
    for c in idx.chunks:
        if not c.get("symbol_name"):
            continue
        if language and c.get("language") != language:
            continue
        if symbol_type and c.get("symbol_type") != symbol_type:
            continue
        if path and path.lower() not in c.get("relative_file_path", "").lower():
            continue

        symbols.append({
            "name": c["symbol_name"],
            "type": c["symbol_type"],
            "filePath": c["relative_file_path"],
            "startLine": c["start_line"],
            "endLine": c["end_line"],
            "language": c["language"],
            "containingClass": c.get("containing_class"),
        })

    return {"symbols": symbols, "total": len(symbols)}


@router.get("/repository/{repository_id}/relationships")
async def get_relationships(
    repository_id: str,
    path: Optional[str] = None,
):
    idx = IndexStore.get(repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found.")

    if path:
        rel = idx.relationship_index.get(path, {})
        return {"filePath": path, "relationships": rel}

    return {"relationships": idx.relationship_index}


@router.get("/repository/{repository_id}/metadata")
async def get_metadata(repository_id: str):
    idx = IndexStore.get(repository_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="Repository index not found.")
    return {"metadata": idx.metadata}
