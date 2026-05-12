import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request

router = APIRouter()


def get_db(request: Request) -> Any:
    db = getattr(request.app.state, "db", None)

    if db is None:
        raise HTTPException(status_code=503, detail="Database is not configured")

    return db


def serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    serialized = dict(document)

    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
        serialized["id"] = serialized["_id"]

    for key, value in list(serialized.items()):
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()

    return serialized


@router.get("/timeline/{user_id}")
async def get_timeline(user_id: str, request: Request) -> list[dict[str, Any]]:
    db = get_db(request)
    # Most recent belief shifts first (descending by created_at).
    cursor = db.belief_shifts.find({"user_id": user_id}).sort("created_at", -1)
    return [serialize_document(document) async for document in cursor]


@router.get("/timeline/{user_id}/{concept_name}")
async def get_concept_timeline(
    user_id: str,
    concept_name: str,
    request: Request,
) -> list[dict[str, Any]]:
    db = get_db(request)
    # Chronological order for a single concept (ascending by created_at).
    cursor = db.belief_shifts.find(
        {
            "user_id": user_id,
            "concept_name": {"$regex": f"^{re.escape(concept_name)}$", "$options": "i"},
        }
    ).sort("created_at", 1)
    return [serialize_document(document) async for document in cursor]
