from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.services.graph_ops import get_all_nodes_and_edges

router = APIRouter()
USER_COLLECTIONS = ("concepts", "edges", "inputs", "contradictions", "connections")


def get_db(request: Request) -> Any:
    db = getattr(request.app.state, "db", None)

    if db is None:
        raise HTTPException(status_code=503, detail="Database is not configured")

    return db


@router.get("/graph/{user_id}")
async def get_graph(user_id: str, request: Request) -> dict[str, list[dict[str, Any]]]:
    db = get_db(request)
    return await get_all_nodes_and_edges(db, user_id)


@router.delete("/graph/{user_id}")
async def clear_graph(user_id: str, request: Request) -> dict[str, int | str]:
    db = get_db(request)
    deleted_count = 0

    for collection_name in USER_COLLECTIONS:
        result = await db[collection_name].delete_many({"user_id": user_id})
        deleted_count += result.deleted_count

    return {"status": "ok", "deleted_count": deleted_count}
