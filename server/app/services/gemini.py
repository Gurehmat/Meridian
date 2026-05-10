import json
import re
from typing import Any

import google.generativeai as genai

from app.config import GEMINI_API_KEY

MODEL_NAME = "gemini-2.5-flash"

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel(MODEL_NAME)


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)

    if fence_match:
        cleaned = fence_match.group(1).strip()

    object_match = re.search(r"\{.*\}", cleaned, re.DOTALL)

    if object_match:
        cleaned = object_match.group(0)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        snippet = cleaned[:500].replace("\n", " ")
        print(f"[gemini._parse_json_object] JSON parsing failed: {exc}")
        print(f"[gemini._parse_json_object] Raw snippet: {snippet}")
        return {}

    if not isinstance(parsed, dict):
        print("[gemini._parse_json_object] Parsed JSON is not an object.")
        print(f"[gemini._parse_json_object] Parsed type: {type(parsed).__name__}")
        return {}

    return parsed


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "yes", "1"}:
            return True
        if normalized in {"false", "no", "0", ""}:
            return False

    if isinstance(value, (int, float)):
        return value != 0

    return False


async def _generate_json(prompt: str) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        return {}

    try:
        response = await model.generate_content_async(prompt)
        response_text = getattr(response, "text", "") or ""
        if not response_text.strip():
            print("[gemini._generate_json] Gemini returned empty text response.")
        return _parse_json_object(response_text)
    except Exception as exc:
        print(f"[gemini._generate_json] Gemini request failed: {exc}")
        return {}


async def extract_concepts(text: str) -> dict[str, list[dict[str, Any]]]:
    prompt = f"""
You extract concepts and relationships from user notes for a knowledge graph.
Return only valid JSON with this exact shape:
{{
  "concepts": [
    {{"name": "Concept name", "description": "Short description"}}
  ],
  "relationships": [
    {{"from": "Concept name", "to": "Concept name", "relationship_type": "related", "description": "Short explanation"}}
  ]
}}
Rules:
Use concise names.
Use only concepts grounded in the text.
Do not include markdown.

Text:
{text}
"""
    data = await _generate_json(prompt)
    concepts = data.get("concepts", [])
    relationships = data.get("relationships", [])

    return {
        "concepts": concepts if isinstance(concepts, list) else [],
        "relationships": relationships if isinstance(relationships, list) else [],
    }


async def detect_contradiction(
    concept_a_name: str,
    concept_a_desc: str,
    concept_b_name: str,
    concept_b_desc: str,
) -> dict[str, str | bool]:
    prompt = f"""
Decide whether these two concepts contradict each other in a meaningful way.
Return only valid JSON with this exact shape:
{{
  "is_contradiction": true,
  "confidence": "low | medium | high",
  "explanation": "Short explanation"
}}

Concept A:
Name: {concept_a_name}
Description: {concept_a_desc}

Concept B:
Name: {concept_b_name}
Description: {concept_b_desc}
"""
    data = await _generate_json(prompt)

    return {
        "is_contradiction": _as_bool(data.get("is_contradiction", False)),
        "confidence": str(data.get("confidence", "low")),
        "explanation": str(data.get("explanation", "")),
    }


async def find_connection(
    concept_a_name: str,
    concept_a_desc: str,
    concept_b_name: str,
    concept_b_desc: str,
) -> dict[str, str | bool]:
    prompt = f"""
Decide whether these two concepts have a useful unexpected connection.
Return only valid JSON with this exact shape:
{{
  "connection_exists": true,
  "explanation": "Short explanation"
}}

Concept A:
Name: {concept_a_name}
Description: {concept_a_desc}

Concept B:
Name: {concept_b_name}
Description: {concept_b_desc}
"""
    data = await _generate_json(prompt)

    return {
        "connection_exists": _as_bool(data.get("connection_exists", False)),
        "explanation": str(data.get("explanation", "")),
    }


async def analyze_concept_pair(
    concept_a_name: str,
    concept_a_desc: str,
    concept_b_name: str,
    concept_b_desc: str,
) -> dict[str, str | bool]:
    prompt = f"""
Analyze the relationship between these two concepts that a user holds:

Concept A: {concept_a_name} - {concept_a_desc}
Concept B: {concept_b_name} - {concept_b_desc}

Check two things:
1. Do these concepts contradict each other? A contradiction means the user cannot logically hold both positions simultaneously.
2. Is there a surprising, non-obvious connection between them across different domains?

Respond ONLY in this JSON format:
{{
  "is_contradiction": true,
  "contradiction_confidence": "high",
  "contradiction_explanation": "Short explanation",
  "connection_exists": true,
  "connection_explanation": "Short explanation"
}}
"""
    data = await _generate_json(prompt)

    return {
        "is_contradiction": _as_bool(data.get("is_contradiction", False)),
        "contradiction_confidence": str(data.get("contradiction_confidence", "low")),
        "contradiction_explanation": str(data.get("contradiction_explanation", "")),
        "connection_exists": _as_bool(data.get("connection_exists", False)),
        "connection_explanation": str(data.get("connection_explanation", "")),
    }
