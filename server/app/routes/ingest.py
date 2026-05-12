import re
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.models import InputModel, TextIngestRequest
from app.services.embedder import embed_text
from app.services.extractor import chunk_text, extract_text_from_pdf
from app.services.gemini import analyze_belief_shift, analyze_concept_pair, extract_concepts
from app.services.graph_ops import (
    find_similar_concepts,
    store_belief_shift,
    store_concept,
    store_connection,
    store_contradiction,
    store_edge,
)

router = APIRouter()


def _require_nonempty_user_id(user_id: str | None) -> str | None:
    if user_id is None or not str(user_id).strip():
        return None

    return str(user_id).strip()


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


def _normalized_description(description: str) -> str:
    return " ".join(description.split()).strip().lower()


async def _ingest_content(
    db: Any,
    content: str,
    content_type: str,
    user_id: str,
    log_prefix: str,
) -> dict[str, Any]:
    input_model = InputModel(
        content=content,
        content_type=content_type,
        user_id=user_id,
    )
    input_result = await db.inputs.insert_one(input_model.model_dump())
    source_id = str(input_result.inserted_id)
    print(f"[{log_prefix}] Created input source_id={source_id}")

    concepts_added = 0
    concepts_extracted = 0
    contradictions_found = 0
    connections_found = 0

    for chunk_index, chunk in enumerate(chunk_text(content), start=1):
        print(f"[{log_prefix}] Processing chunk #{chunk_index} (length={len(chunk)})")
        extracted = await extract_concepts(chunk)
        concepts = extracted["concepts"]
        relationships = extracted["relationships"]
        print(
            f"[{log_prefix}] Chunk #{chunk_index} extracted {len(concepts)} concepts and {len(relationships)} relationships"
        )

        for concept_index, concept in enumerate(concepts, start=1):
            name = _concept_name(concept)
            description = _concept_description(concept)

            if not name:
                print(
                    f"[{log_prefix}] Skipping concept #{concept_index} in chunk #{chunk_index}: empty name"
                )
                continue

            concepts_extracted += 1

            existing_concept = await db.concepts.find_one(
                {"user_id": user_id, "name": {"$regex": _exact_name_pattern(name)}}
            )

            if existing_concept:
                concept_id = str(existing_concept["_id"])
                existing_name = str(existing_concept.get("name", name)).strip() or name
                previous_description = str(existing_concept.get("description", "")).strip()
                current_description = previous_description
                embedding = existing_concept.get("embedding", [])
                print(
                    f"[{log_prefix}] Reusing existing concept name='{name}' id={concept_id}"
                )

                if _normalized_description(previous_description) != _normalized_description(description):
                    try:
                        shift_analysis = await analyze_belief_shift(
                            existing_name,
                            previous_description,
                            description,
                        )
                        print(
                            f"[{log_prefix}] Gemini belief shift analysis for '{existing_name}': {shift_analysis}"
                        )

                        if shift_analysis.get("has_shifted"):
                            shift_explanation = str(
                                shift_analysis.get("shift_explanation", "")
                            ).strip()
                            await store_belief_shift(
                                db,
                                existing_name,
                                previous_description,
                                description,
                                shift_explanation,
                                source_id,
                                user_id,
                            )
                            embedding = embed_text(f"{existing_name}\n{description}")
                            await db.concepts.find_one_and_update(
                                {"_id": existing_concept["_id"], "user_id": user_id},
                                {
                                    "$set": {
                                        "description": description,
                                        "embedding": embedding,
                                    }
                                },
                                upsert=False,
                            )
                            current_description = description
                            print(
                                f"[{log_prefix}] Stored belief shift and updated concept name='{existing_name}' id={concept_id}"
                            )
                    except Exception as exc:
                        print(
                            f"[{log_prefix}] Belief shift analysis failed for concept='{existing_name}' id={concept_id}: {exc}"
                        )

                description = current_description
            else:
                embedding = embed_text(f"{name}\n{description}")
                concept_id = await store_concept(db, concept, embedding, source_id, user_id)
                concepts_added += 1
                print(
                    f"[{log_prefix}] Stored concept name='{name}' id={concept_id} source_input_id={source_id}"
                )

            if not embedding:
                print(
                    f"[{log_prefix}] Skipping similarity search for concept='{name}': missing embedding"
                )
                continue

            similar_concepts = await find_similar_concepts(
                db,
                embedding,
                user_id,
                exclude_source_input_id=source_id,
                query_concept_name=name,
                top_k=3,
            )

            print(
                f"[{log_prefix}] Found {len(similar_concepts)} similar concepts for new concept '{name}'"
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
                        f"[{log_prefix}] Skipping same-name comparison for concept='{name}'"
                    )
                    continue

                if similar_source == source_id:
                    print(
                        f"[{log_prefix}] Skipping similar concept '{similar_name}' from current ingestion source_id={source_id}"
                    )
                    continue

                print(
                    f"[{log_prefix}] Checking pair "
                    f"'{name}' vs '{similar_name}' (score={similar_score}, source_input_id={similar_source})"
                )

                try:
                    analysis = await analyze_concept_pair(
                        name,
                        description,
                        similar_name,
                        similar_description,
                    )
                    print(
                        f"[{log_prefix}] Gemini pair analysis for '{name}' vs '{similar_name}': {analysis}"
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
                            user_id,
                        )
                        contradictions_found += 1
                        print(
                            f"[{log_prefix}] Stored contradiction for '{name}' vs '{similar_name}'"
                        )

                    if analysis.get("connection_exists"):
                        await store_connection(
                            db,
                            name,
                            similar_name,
                            str(analysis["connection_explanation"]),
                            user_id,
                        )
                        connections_found += 1
                        print(
                            f"[{log_prefix}] Stored connection for '{name}' vs '{similar_name}'"
                        )
                except Exception as exc:
                    print(
                        f"[{log_prefix}] Gemini comparison failed for '{name}' vs '{similar_name}': {exc}"
                    )

        for relationship_index, relationship in enumerate(relationships, start=1):
            from_concept = str(relationship.get("from", "")).strip()
            to_concept = str(relationship.get("to", "")).strip()

            if not from_concept or not to_concept:
                print(
                    f"[{log_prefix}] Skipping relationship #{relationship_index} in chunk #{chunk_index}: missing endpoint"
                )
                continue

            await store_edge(db, from_concept, to_concept, relationship, user_id)
            print(
                f"[{log_prefix}] Stored edge {from_concept} -> {to_concept} (chunk #{chunk_index})"
            )

    print(
        f"[{log_prefix}] Completed ingestion "
        f"source_id={source_id} concepts_added={concepts_added} "
        f"contradictions_found={contradictions_found} connections_found={connections_found}"
    )

    return {
        "status": "ok",
        "concepts_added": concepts_added,
        "concepts_extracted": concepts_extracted,
        "contradictions_found": contradictions_found,
        "connections_found": connections_found,
    }


@router.post("/ingest/text", response_model=None)
async def ingest_text(
    payload: TextIngestRequest, request: Request
) -> Any:
    db = get_db(request)
    uid = _require_nonempty_user_id(payload.user_id)
    if uid is None:
        return JSONResponse(status_code=400, content={"error": "user_id is required"})
    print(f"[ingest_text] Starting ingestion for user_id={uid}")
    return await _ingest_content(db, payload.content, "text", uid, "ingest_text")


@router.post("/ingest/pdf", response_model=None)
async def ingest_pdf(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Form(...),
) -> Any:
    db = get_db(request)
    uid = _require_nonempty_user_id(user_id)
    if uid is None:
        return JSONResponse(status_code=400, content={"error": "user_id is required"})
    filename = file.filename or "uploaded.pdf"

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF file.")

    print(f"[ingest_pdf] Starting ingestion for user_id={uid} filename={filename}")
    file_bytes = await file.read()

    try:
        extracted_text = extract_text_from_pdf(file_bytes).strip()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read this PDF.") from exc

    if not extracted_text:
        raise HTTPException(status_code=400, detail="No text could be extracted from this PDF.")

    source_content = f"Filename: {filename}\n\n{extracted_text}"
    return await _ingest_content(db, source_content, "pdf", uid, "ingest_pdf")
