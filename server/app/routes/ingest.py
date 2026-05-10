import asyncio
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.models import InputModel, TextIngestRequest
from app.services.embedder import embed_text
from app.services.extractor import chunk_text
from app.services.gemini import analyze_concept_pair, extract_concepts
from app.services.graph_ops import (
    find_similar_concepts,
    store_concept,
    store_connection,
    store_contradiction,
    store_edge,
)

router = APIRouter()


def get_db(request: Request) -> Any:
    db = getattr(request.app.state, "db", None)

    if db is None:
        raise HTTPException(status_code=503, detail="Database is not configured")

    return db


def _concept_name(concept: dict[str, Any]) -> str:
    return str(concept.get("name", "")).strip()


def _concept_description(concept: dict[str, Any]) -> str:
    return str(concept.get("description", "")).strip()


def _exact_name_pattern(name: str) -> re.Pattern[str]:
    return re.compile(f"^{re.escape(name)}$", re.IGNORECASE)


@router.post("/ingest/text")
async def ingest_text(payload: TextIngestRequest, request: Request) -> dict[str, int | str]:
    db = get_db(request)
    print(f"[ingest_text] Starting ingestion for user_id={payload.user_id}")

    input_model = InputModel(
        content=payload.content,
        content_type="text",
        user_id=payload.user_id,
    )
    input_result = await db.inputs.insert_one(input_model.model_dump())
    source_id = str(input_result.inserted_id)
    print(f"[ingest_text] Created input source_id={source_id}")

    concepts_added = 0
    contradictions_found = 0
    connections_found = 0

    for chunk_index, chunk in enumerate(chunk_text(payload.content), start=1):
        print(f"[ingest_text] Processing chunk #{chunk_index} (length={len(chunk)})")
        extracted = await extract_concepts(chunk)
        concepts = extracted["concepts"]
        relationships = extracted["relationships"]
        print(
            f"[ingest_text] Chunk #{chunk_index} extracted {len(concepts)} concepts and {len(relationships)} relationships"
        )

        for concept_index, concept in enumerate(concepts, start=1):
            name = _concept_name(concept)
            description = _concept_description(concept)

            if not name:
                print(
                    f"[ingest_text] Skipping concept #{concept_index} in chunk #{chunk_index}: empty name"
                )
                continue

            existing_concept = await db.concepts.find_one(
                {"user_id": payload.user_id, "name": {"$regex": _exact_name_pattern(name)}}
            )

            if existing_concept:
                concept_id = str(existing_concept["_id"])
                embedding = existing_concept.get("embedding", [])
                print(
                    f"[ingest_text] Reusing existing concept name='{name}' id={concept_id}"
                )
            else:
                embedding = embed_text(f"{name}\n{description}")
                concept_id = await store_concept(db, concept, embedding, source_id, payload.user_id)
                concepts_added += 1
                print(
                    f"[ingest_text] Stored concept name='{name}' id={concept_id} source_input_id={source_id}"
                )

            if not embedding:
                print(
                    f"[ingest_text] Skipping similarity search for concept='{name}': missing embedding"
                )
                continue

            try:
                similar_concepts = await find_similar_concepts(
                    db,
                    embedding,
                    payload.user_id,
                    exclude_source_input_id=source_id,
                    query_concept_name=name,
                    top_k=3,
                )
            except Exception as exc:
                print(
                    f"[ingest_text] find_similar_concepts failed for concept='{name}' id={concept_id}: {exc}"
                )
                similar_concepts = []

            print(
                f"[ingest_text] Found {len(similar_concepts)} similar concepts for new concept '{name}'"
            )

            for similar in similar_concepts:
                similar_name = str(similar.get("name", "")).strip()
                similar_description = str(similar.get("description", "")).strip()
                similar_source = str(similar.get("source_input_id", "")).strip()
                similar_score = similar.get("score")

                if not similar_name:
                    continue

                if similar_name.lower() == name.lower():
                    print(
                        f"[ingest_text] Skipping same-name comparison for concept='{name}'"
                    )
                    continue

                # Guardrail for mixed datasets: skip any concept from the current ingestion.
                if similar_source == source_id:
                    print(
                        f"[ingest_text] Skipping similar concept '{similar_name}' from current ingestion source_id={source_id}"
                    )
                    continue

                print(
                    "[ingest_text] Checking pair "
                    f"'{name}' vs '{similar_name}' (score={similar_score}, source_input_id={similar_source})"
                )

                try:
                    await asyncio.sleep(13)
                    analysis = await analyze_concept_pair(
                        name,
                        description,
                        similar_name,
                        similar_description,
                    )
                    print(
                        f"[ingest_text] Gemini pair analysis for '{name}' vs '{similar_name}': {analysis}"
                    )

                    contradiction_confidence = str(
                        analysis.get("contradiction_confidence", "")
                    ).strip().lower()
                    if analysis.get("is_contradiction") and contradiction_confidence == "high":
                        await store_contradiction(
                            db,
                            name,
                            similar_name,
                            str(analysis["contradiction_explanation"]),
                            payload.user_id,
                        )
                        contradictions_found += 1
                        print(
                            f"[ingest_text] Stored contradiction for '{name}' vs '{similar_name}'"
                        )

                    if analysis.get("connection_exists"):
                        await store_connection(
                            db,
                            name,
                            similar_name,
                            str(analysis["connection_explanation"]),
                            payload.user_id,
                        )
                        connections_found += 1
                        print(
                            f"[ingest_text] Stored connection for '{name}' vs '{similar_name}'"
                        )
                except Exception as exc:
                    print(
                        f"[ingest_text] Gemini comparison failed for '{name}' vs '{similar_name}': {exc}"
                    )

        for relationship_index, relationship in enumerate(relationships, start=1):
            from_concept = str(relationship.get("from", "")).strip()
            to_concept = str(relationship.get("to", "")).strip()

            if not from_concept or not to_concept:
                print(
                    f"[ingest_text] Skipping relationship #{relationship_index} in chunk #{chunk_index}: missing endpoint"
                )
                continue

            await store_edge(db, from_concept, to_concept, relationship, payload.user_id)
            print(
                f"[ingest_text] Stored edge {from_concept} -> {to_concept} (chunk #{chunk_index})"
            )

    print(
        "[ingest_text] Completed ingestion "
        f"source_id={source_id} concepts_added={concepts_added} "
        f"contradictions_found={contradictions_found} connections_found={connections_found}"
    )

    return {
        "status": "ok",
        "concepts_added": concepts_added,
        "contradictions_found": contradictions_found,
        "connections_found": connections_found,
    }
