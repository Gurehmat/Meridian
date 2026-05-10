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


@router.get("/contradictions/{user_id}")
async def get_contradictions(user_id: str, request: Request) -> list[dict[str, Any]]:
    db = get_db(request)
    cursor = db.contradictions.find({"user_id": user_id}).sort("created_at", -1)
    return [serialize_document(document) async for document in cursor]


@router.get("/connections/{user_id}")
async def get_connections(user_id: str, request: Request) -> list[dict[str, Any]]:
    db = get_db(request)
    cursor = db.connections.find({"user_id": user_id}).sort("created_at", -1)
    return [serialize_document(document) async for document in cursor]
