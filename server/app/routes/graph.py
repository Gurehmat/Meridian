from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Request

from app.services.graph_ops import get_all_nodes_and_edges

router = APIRouter()
USER_COLLECTIONS = (
    "concepts",
    "edges",
    "inputs",
    "contradictions",
    "connections",
    "belief_shifts",
)


def get_db(request: Request) -> Any:
    db = getattr(request.app.state, "db", None)

    if db is None:
        raise HTTPException(status_code=503, detail="Database is not configured")

    return db


def object_id_from_string(document_id: str) -> ObjectId:
    try:
        return ObjectId(document_id)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc


async def delete_concept_artifacts(
    db: Any,
    user_id: str,
    concept_names: list[str],
    source_input_id: str | None = None,
) -> int:
    deleted_count = 0

    if concept_names:
        edge_result = await db.edges.delete_many(
            {
                "user_id": user_id,
                "$or": [
                    {"from_concept": {"$in": concept_names}},
                    {"to_concept": {"$in": concept_names}},
                ],
            }
        )
        deleted_count += edge_result.deleted_count

        contradiction_result = await db.contradictions.delete_many(
            {
                "user_id": user_id,
                "$or": [
                    {"concept_a": {"$in": concept_names}},
                    {"concept_b": {"$in": concept_names}},
                ],
            }
        )
        deleted_count += contradiction_result.deleted_count

        connection_result = await db.connections.delete_many(
            {
                "user_id": user_id,
                "$or": [
                    {"concept_a": {"$in": concept_names}},
                    {"concept_b": {"$in": concept_names}},
                ],
            }
        )
        deleted_count += connection_result.deleted_count

    belief_filters: list[dict[str, Any]] = []

    if concept_names:
        belief_filters.append({"concept_name": {"$in": concept_names}})
    if source_input_id:
        belief_filters.append({"source_input_id": source_input_id})

    if belief_filters:
        belief_result = await db.belief_shifts.delete_many(
            {"user_id": user_id, "$or": belief_filters}
        )
        deleted_count += belief_result.deleted_count

    return deleted_count


def serialize_entry(document: dict[str, Any], concept_counts: dict[str, int]) -> dict[str, Any]:
    entry_id = str(document.get("_id", ""))
    created_at = document.get("created_at")

    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()

    return {
        "id": entry_id,
        "content": document.get("content", ""),
        "content_type": document.get("content_type", ""),
        "created_at": created_at,
        "concept_count": concept_counts.get(entry_id, 0),
    }


@router.get("/entries/{user_id}")
async def get_entries(user_id: str, request: Request) -> list[dict[str, Any]]:
    db = get_db(request)
    cursor = db.inputs.find({"user_id": user_id}).sort("created_at", -1)
    inputs = [document async for document in cursor]
    input_ids = [str(document.get("_id", "")) for document in inputs]

    concept_counts: dict[str, int] = {}

    if input_ids:
        count_cursor = db.concepts.aggregate(
            [
                {
                    "$match": {
                        "user_id": user_id,
                        "source_input_id": {"$in": input_ids},
                    }
                },
                {"$group": {"_id": "$source_input_id", "count": {"$sum": 1}}},
            ]
        )
        concept_counts = {
            str(document.get("_id", "")): int(document.get("count", 0))
            async for document in count_cursor
        }

    return [serialize_entry(document, concept_counts) for document in inputs]


@router.get("/graph/{user_id}")
async def get_graph(user_id: str, request: Request) -> dict[str, list[dict[str, Any]]]:
    db = get_db(request)
    return await get_all_nodes_and_edges(db, user_id)


@router.delete("/graph/{user_id}", response_model=None)
async def clear_graph(user_id: str, request: Request) -> Any:
    db = get_db(request)
    deleted_count = 0

    for collection_name in USER_COLLECTIONS:
        result = await db[collection_name].delete_many({"user_id": user_id})
        deleted_count += result.deleted_count

    return {"status": "ok", "deleted_count": deleted_count}


@router.delete("/concept/{concept_id}", response_model=None)
async def delete_concept(
    concept_id: str,
    user_id: str,
    request: Request,
) -> Any:
    db = get_db(request)
    object_id = object_id_from_string(concept_id)
    concept = await db.concepts.find_one({"_id": object_id})

    if concept is None:
        raise HTTPException(status_code=404, detail="Concept not found")

    if str(concept.get("user_id", "")) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    concept_name = str(concept.get("name", "")).strip()
    deleted_count = 0

    concept_result = await db.concepts.delete_one({"_id": object_id, "user_id": user_id})
    deleted_count += concept_result.deleted_count
    deleted_count += await delete_concept_artifacts(
        db,
        user_id,
        [concept_name] if concept_name else [],
    )

    return {"status": "ok", "deleted_count": deleted_count}


@router.delete("/input/{input_id}", response_model=None)
async def delete_input(
    input_id: str,
    user_id: str,
    request: Request,
) -> Any:
    db = get_db(request)
    object_id = object_id_from_string(input_id)
    source_input = await db.inputs.find_one({"_id": object_id})

    if source_input is None:
        raise HTTPException(status_code=404, detail="Input not found")

    if str(source_input.get("user_id", "")) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    concept_cursor = db.concepts.find({"user_id": user_id, "source_input_id": input_id})
    concepts = [concept async for concept in concept_cursor]
    concept_names = [
        concept_name
        for concept_name in (str(concept.get("name", "")).strip() for concept in concepts)
        if concept_name
    ]
    deleted_count = 0

    input_result = await db.inputs.delete_one({"_id": object_id, "user_id": user_id})
    deleted_count += input_result.deleted_count

    concept_result = await db.concepts.delete_many(
        {"user_id": user_id, "source_input_id": input_id}
    )
    deleted_count += concept_result.deleted_count
    deleted_count += await delete_concept_artifacts(
        db,
        user_id,
        concept_names,
        source_input_id=input_id,
    )

    return {"status": "ok", "deleted_count": deleted_count}
