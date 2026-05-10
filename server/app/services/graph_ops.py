from typing import Any

from app.models import ConceptModel, ConnectionModel, ContradictionModel, EdgeModel


def _serialize_document(document: dict[str, Any]) -> dict[str, Any]:
    serialized = dict(document)

    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
        serialized["id"] = serialized["_id"]

    return serialized


async def store_concept(
    db: Any,
    concept: dict[str, Any],
    embedding: list[float],
    source_id: str,
    user_id: str,
) -> str:
    concept_model = ConceptModel(
        name=str(concept.get("name", "")).strip(),
        description=str(concept.get("description", "")).strip(),
        embedding=embedding,
        source_input_id=source_id,
        user_id=user_id,
    )
    result = await db.concepts.insert_one(concept_model.model_dump())
    return str(result.inserted_id)


async def store_edge(
    db: Any,
    from_concept: str,
    to_concept: str,
    relationship: dict[str, Any] | str,
    user_id: str,
) -> str:
    if isinstance(relationship, dict):
        relationship_type = str(relationship.get("relationship_type", "related"))
        description = str(relationship.get("description", ""))
    else:
        relationship_type = relationship
        description = ""

    edge_model = EdgeModel(
        from_concept=from_concept,
        to_concept=to_concept,
        relationship_type=relationship_type,
        description=description,
        user_id=user_id,
    )
    result = await db.edges.insert_one(edge_model.model_dump())
    return str(result.inserted_id)


async def store_contradiction(
    db: Any,
    concept_a: str,
    concept_b: str,
    explanation: str,
    user_id: str,
) -> str:
    contradiction_model = ContradictionModel(
        concept_a=concept_a,
        concept_b=concept_b,
        explanation=explanation,
        user_id=user_id,
    )
    result = await db.contradictions.insert_one(contradiction_model.model_dump())
    return str(result.inserted_id)


async def store_connection(
    db: Any,
    concept_a: str,
    concept_b: str,
    explanation: str,
    user_id: str,
) -> str:
    connection_model = ConnectionModel(
        concept_a=concept_a,
        concept_b=concept_b,
        explanation=explanation,
        user_id=user_id,
    )
    result = await db.connections.insert_one(connection_model.model_dump())
    return str(result.inserted_id)


async def find_similar_concepts(
    db: Any,
    embedding: list[float],
    user_id: str,
    exclude_source_input_id: str | None = None,
    query_concept_name: str | None = None,
    top_k: int = 10,
) -> list[dict[str, Any]]:
    pipeline = [
        {
            "$vectorSearch": {
                "index": "embedding_index",
                "path": "embedding",
                "queryVector": embedding,
                "numCandidates": 200,
                "limit": top_k * 5,
            }
        },
        {
            "$project": {
                "name": 1,
                "description": 1,
                "embedding": 1,
                "user_id": 1,
                "source_input_id": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    try:
        cursor = db.concepts.aggregate(pipeline)
        results = [_serialize_document(document) async for document in cursor]
        filtered_results: list[dict[str, Any]] = []
        normalized_query_name = (query_concept_name or "").strip().lower()

        for result in results:
            score = result.get("score", 0)
            concept_name = str(result.get("name", "")).strip()
            print(
                f"[graph_ops.find_similar_concepts] Candidate concept='{concept_name}' score={score}"
            )

            if str(result.get("user_id", "")) != user_id:
                continue
            if exclude_source_input_id and str(result.get("source_input_id", "")) == exclude_source_input_id:
                continue
            if normalized_query_name and concept_name.lower() == normalized_query_name:
                print(
                    f"[graph_ops.find_similar_concepts] Skipping concept='{concept_name}' with same name as query"
                )
                continue
            try:
                score_value = float(score)
            except (TypeError, ValueError):
                print(
                    f"[graph_ops.find_similar_concepts] Skipping concept='{concept_name}' with missing score"
                )
                continue
            if score_value < 0.5:
                print(
                    f"[graph_ops.find_similar_concepts] Skipping concept='{concept_name}' with low score={score_value}"
                )
                continue
            filtered_results.append(result)

        return filtered_results[:top_k]
    except Exception as exc:
        print(f"[graph_ops.find_similar_concepts] Vector search failed: {exc}")
        print(f"[graph_ops.find_similar_concepts] Pipeline: {pipeline}")
        return []


async def get_all_nodes_and_edges(db: Any, user_id: str) -> dict[str, list[dict[str, Any]]]:
    concept_cursor = db.concepts.find({"user_id": user_id})
    edge_cursor = db.edges.find({"user_id": user_id})

    concepts = [_serialize_document(document) async for document in concept_cursor]
    edges = [_serialize_document(document) async for document in edge_cursor]

    nodes = [
        {
            "id": concept["id"],
            "name": concept.get("name", ""),
            "description": concept.get("description", ""),
            "source_input_id": concept.get("source_input_id", ""),
        }
        for concept in concepts
    ]
    links = [
        {
            "id": edge["id"],
            "source": edge.get("from_concept", ""),
            "target": edge.get("to_concept", ""),
            "relationship_type": edge.get("relationship_type", ""),
            "description": edge.get("description", ""),
        }
        for edge in edges
    ]

    return {"nodes": nodes, "links": links}
