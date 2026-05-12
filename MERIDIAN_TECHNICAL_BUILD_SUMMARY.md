# Meridian Technical Build Summary

## Purpose

Meridian is a full-stack application that ingests user notes and PDFs, extracts concepts and relationships, stores them in MongoDB, computes semantic similarity and cross-concept insights, and renders an interactive knowledge graph in the browser.

This document captures how the current codebase is built so another engineer or AI assistant can continue work with implementation-level context.

## Full Tech Stack

### Backend

- Language/runtime: Python 3.11 (pinned in `server/Dockerfile`).
- API framework: FastAPI (`server/app/main.py`).
- ASGI server: Uvicorn (`server/Dockerfile` command, `uvicorn[standard]` in `server/requirements.txt`).
- Database driver: Motor async client with PyMongo types (`server/app/main.py`, route modules, `bson.ObjectId` in `server/app/routes/graph.py`).
- Database: MongoDB (database name `meridian` in `server/app/config.py`).
- Vector search: MongoDB Atlas `$vectorSearch` with index name `embedding_index` (`server/app/services/graph_ops.py`).
- Embeddings: `sentence-transformers/all-MiniLM-L6-v2` (`server/app/services/embedder.py`).
- LLM extraction and reasoning: Google Gemini model `gemini-2.5-flash` (`server/app/services/gemini.py`).
- PDF extraction: PyMuPDF (`fitz`) in `server/app/services/extractor.py`.
- Optional URL text extraction utility: `requests` and BeautifulSoup (`server/app/services/extractor.py`), not currently wired to API routes.
- Env loading: `python-dotenv` (`server/app/config.py`).

### Frontend

- Language/runtime: TypeScript + React.
- React: `19.2.6` (resolved in `client/package-lock.json`).
- React DOM: `19.2.6`.
- Routing: `react-router-dom` `7.15.0`.
- Auth SDK: Firebase JS SDK `12.13.0`.
- Graph rendering: `react-force-graph` `1.48.2`, `react-force-graph-2d` `1.29.1`.
- Build tooling: Vite `8.0.11`, `@vitejs/plugin-react` `6.0.1`.
- TypeScript: `6.0.3`.
- CSS: Tailwind CSS `4.3.0` with `@tailwindcss/postcss` `4.3.0`.
- Linting: ESLint `10.3.0` with `typescript-eslint` `8.59.2`.

### Version Certainty Notes

- Python dependencies in `server/requirements.txt` are unpinned, so exact installed versions depend on install time unless a lock process is added.
- Node dependencies have exact resolved versions in `client/package-lock.json`, which are authoritative for a lockfile install.

## Architecture Overview

### End-to-end flow

1. User signs in with Google via Firebase in the frontend.
2. Frontend sends `user.uid` as `user_id` in API paths, query parameters, or body.
3. User submits text or PDF from the Input tab.
4. Backend stores raw input in MongoDB `inputs`.
5. Backend chunks text, calls Gemini to extract concepts and relationships.
6. Backend embeds each concept via MiniLM and stores or updates concept records.
7. Backend runs Atlas vector search to retrieve semantically similar prior concepts.
8. Backend runs Gemini pair analysis on concept pairs for contradictions and cross-domain connections.
9. Backend stores contradictions, connections, belief shifts, and graph edges.
10. Frontend refreshes graph data and insight feeds (`graph`, `contradictions`, `connections`, `timeline`, `entries`).
11. Graph area merges backend links with insight-derived links and renders interactive force graph visualization.

### Data flow from input to graph visualization

- Input submit action starts in `client/src/components/LeftSidebar.tsx`.
- Ingestion handlers in `client/src/App.tsx` call `ingestText` or `ingestPDF` from `client/src/lib/api.ts`.
- Backend ingest routes in `server/app/routes/ingest.py` orchestrate extraction, storage, similarity, and insight generation.
- Graph payload is returned by `GET /graph/{user_id}` via `server/app/routes/graph.py` and `server/app/services/graph_ops.py`.
- Insights are returned separately by `GET /contradictions/{user_id}` and `GET /connections/{user_id}`.
- `client/src/components/GraphArea.tsx` resolves link endpoints and merges graph links plus contradiction/connection links.
- `react-force-graph-2d` renders nodes and links on canvas with relationship-specific styling and interactions.

## Backend Services and File-by-File Breakdown (`server/app/`)

### Root package files

- `server/app/__init__.py`: package marker, no runtime logic.
- `server/app/config.py`: loads environment variables and exports `MONGODB_URI`, `GEMINI_API_KEY`, and `DATABASE_NAME` (`meridian`).
- `server/app/main.py`:
  - Creates FastAPI app with lifespan hook.
  - Connects to MongoDB if configured.
  - Ensures collections exist: `concepts`, `edges`, `inputs`, `contradictions`, `connections`, `belief_shifts`.
  - Adds permissive CORS middleware (`allow_origins=["*"]`, all methods and headers).
  - Mounts route modules: ingest, graph, insights, timeline.
  - Exposes health endpoint `GET /` returning `{"status": "ok"}`.
- `server/app/models.py`:
  - Pydantic data models for persisted documents and request body.
  - Models: `ConceptModel`, `EdgeModel`, `InputModel`, `ContradictionModel`, `ConnectionModel`, `BeliefShiftModel`, `TextIngestRequest`.
  - Uses UTC timestamps via `utc_now()` for timestamped models.

### Route modules

- `server/app/routes/__init__.py`: package marker, no runtime logic.
- `server/app/routes/ingest.py`:
  - Defines `POST /ingest/text` and `POST /ingest/pdf`.
  - Validates non-empty `user_id`.
  - PDF route validates extension, extracts text from bytes, prepends filename.
  - Core `_ingest_content()` handles pipeline: persist input, chunk text, concept extraction, dedup and belief shift handling, embedding, vector similarity retrieval, contradiction/connection generation, relationship edge storage.
  - Returns ingest summary counts.
- `server/app/routes/graph.py`:
  - Defines `GET /entries/{user_id}`, `GET /graph/{user_id}`, `DELETE /graph/{user_id}`, `DELETE /concept/{concept_id}`, `DELETE /input/{input_id}`.
  - Includes object id parsing, ownership checks, and cascade-like cleanup of related artifacts.
  - `delete_input` removes the input, its concepts, plus related edges, contradictions, connections, and belief shifts.
- `server/app/routes/insights.py`:
  - Defines `GET /contradictions/{user_id}` and `GET /connections/{user_id}`.
  - Serializes `_id` to string `id` and converts datetimes to ISO.
- `server/app/routes/timeline.py`:
  - Defines `GET /timeline/{user_id}` and `GET /timeline/{user_id}/{concept_name}`.
  - Global timeline is newest first.
  - Concept-specific timeline is chronological and case-insensitive exact concept name match.

### Service modules

- `server/app/services/__init__.py`: package marker, no runtime logic.
- `server/app/services/embedder.py`:
  - Loads SentenceTransformer model at import time.
  - `embed_text(text)` and `embed_batch(texts)` return float lists.
- `server/app/services/extractor.py`:
  - `extract_text_from_pdf(file_bytes)` with PyMuPDF.
  - `extract_text_from_url(url)` parses page text after stripping script/style-like elements.
  - `chunk_text(text, chunk_size=500)` uses word windows with overlap.
- `server/app/services/gemini.py`:
  - Configures Gemini client if `GEMINI_API_KEY` exists.
  - Generic JSON generation/parsing helpers with markdown-fence cleanup.
  - `extract_concepts(text)` returns structured concept and relationship arrays.
  - `analyze_concept_pair()` returns contradiction and connection judgment in one call.
  - `analyze_belief_shift()` detects concept understanding evolution.
  - Also defines `detect_contradiction` and `find_connection` helpers, currently not used by routes.
- `server/app/services/graph_ops.py`:
  - Persistence helpers: `store_concept`, `store_edge`, `store_contradiction`, `store_connection`, `store_belief_shift`.
  - Similarity retrieval: `find_similar_concepts` uses Atlas `$vectorSearch`, then filters by user, source input exclusion, same-name exclusion, and score threshold (`>= 0.5`).
  - Graph serialization: `get_all_nodes_and_edges` builds node/link payload for frontend, including synthetic `extracted_from` links from input to concept.

## Frontend Components and File-by-File Breakdown (`client/src/`)

### Entry and shell

- `client/src/main.tsx`:
  - App bootstrap with `StrictMode`.
  - Wraps app in `AuthProvider` and `BrowserRouter`.
  - Routes: `/` to `Landing`, `/app` to `App`.
- `client/src/App.tsx`:
  - Main authenticated workspace container.
  - Redirects unauthenticated users to `/`.
  - Loads graph + insight datasets in parallel on startup and refresh.
  - Handles ingest actions, deletion actions, selected node state, focus requests, tab state, global error state.
  - Composes `Navbar`, `LeftSidebar`, `GraphArea`, and conditional `RightPanel`.
  - Includes error boundaries for app shell and right panel.
- `client/src/Landing.tsx`:
  - Sign-in page.
  - Calls context `signIn` (Google popup), then navigates to `/app`.

### Shared types and API layer

- `client/src/types.ts`:
  - Type definitions for graph entities, insights, belief shifts, entries, ingest response, delete response, and graph focus request.
- `client/src/lib/api.ts`:
  - `API_BASE_URL` from `VITE_API_URL` fallback `http://127.0.0.1:8080`.
  - JSON helper `requestJson` for most endpoints.
  - Exports fetchers and mutators for graph, insights, timeline, entries, delete concept/input, ingest text/PDF.
- `client/src/lib/firebase.ts`:
  - Initializes Firebase app using `VITE_FIREBASE_*` variables.
  - Exports `auth`, `signInWithGoogle`, `signOut`, `onAuthChange`.

### Auth context

- `client/src/contexts/AuthContextValue.ts`:
  - Defines auth context shape and context object.
- `client/src/contexts/AuthContext.tsx`:
  - Subscribes to auth state changes.
  - Provides `{ user, loading, signIn, signOut }`.
  - Renders `null` while initial auth state is unresolved.
- `client/src/contexts/useAuth.ts`:
  - Hook wrapper around context with provider guard error.

### UI components

- `client/src/components/Navbar.tsx`:
  - Top bar branding.
  - Node search with local substring matching and result list.
  - Placeholder notification and settings buttons.
  - User avatar menu and sign out action.
- `client/src/components/LeftSidebar.tsx`:
  - Tabbed sidebar: Insights, Input, Timeline, Entries.
  - Text ingest and PDF ingest UI with drag-and-drop support.
  - Renders contradiction and connection cards.
  - Renders timeline cards from belief shifts.
  - Renders entries with concept counts and node focus integration.
- `client/src/components/GraphArea.tsx`:
  - Canvas force graph rendering via `react-force-graph-2d`.
  - Merges server-provided links with generated contradiction and connection links.
  - Resolves endpoints by id or concept name.
  - Handles loading, empty state CTA, zoom controls, hover effects, focus-to-node behavior, and custom node/link drawing.
- `client/src/components/RightPanel.tsx`:
  - Node details panel.
  - For input nodes: original text, extracted concept links, timestamp.
  - For concept nodes: description, source input, related contradictions, related connections, belief history.
  - Delete confirmation workflow and delete error handling.

### Styling and static assets

- `client/src/index.css`: global font import and base page styles.
- `client/src/assets/react.svg`: static asset, not currently referenced by app code.
- `client/src/assets/vite.svg`: static asset, not currently referenced by app code.
- `client/src/assets/hero.png`: static asset, not currently referenced by app code.

## Database Schema (MongoDB)

Database name: `meridian`.

Collections are created at backend startup if missing.

### `inputs`

- `_id`: ObjectId (Mongo generated)
- `content`: string
- `content_type`: string (`text` or `pdf`)
- `user_id`: string
- `created_at`: datetime (UTC)

### `concepts`

- `_id`: ObjectId
- `name`: string
- `description`: string
- `embedding`: array of float
- `source_input_id`: string (stringified input ObjectId)
- `user_id`: string
- `created_at`: datetime (UTC)

### `edges`

- `_id`: ObjectId
- `from_concept`: string
- `to_concept`: string
- `relationship_type`: string
- `description`: string
- `user_id`: string

### `contradictions`

- `_id`: ObjectId
- `concept_a`: string
- `concept_b`: string
- `explanation`: string
- `user_id`: string
- `created_at`: datetime (UTC)
- `resolved`: boolean (default `false`)

### `connections`

- `_id`: ObjectId
- `concept_a`: string
- `concept_b`: string
- `explanation`: string
- `user_id`: string
- `created_at`: datetime (UTC)

### `belief_shifts`

- `_id`: ObjectId
- `concept_name`: string
- `previous_description`: string
- `new_description`: string
- `shift_explanation`: string
- `source_input_id`: string
- `user_id`: string
- `created_at`: datetime (UTC)

### Vector index requirement

- `find_similar_concepts` requires Atlas vector index `embedding_index` on field `embedding`.
- Index creation is not automated in code and must exist in environment.

## AI and ML Pipeline Details

### 1) Concept extraction

- Input text is chunked into overlapping word windows (`chunk_size=500`, overlap `max(25, chunk_size // 10)`).
- For each chunk, backend calls `extract_concepts` in `gemini.py`.
- Gemini prompt enforces JSON schema:
  - `concepts`: `[{ name, description }]`
  - `relationships`: `[{ from, to, relationship_type, description }]`
- If Gemini key is absent or response parse fails, extraction returns empty arrays.

### 2) Concept deduplication and update path

- Dedup key is case-insensitive exact concept name match per user.
- Query pattern is regex anchored to full name (`^name$`, ignore case).
- If concept exists:
  - Compare normalized descriptions (whitespace-collapsed, lowercase).
  - If changed, run belief shift analysis.
  - If `has_shifted`, store belief shift and update concept description plus embedding.
- If concept is new:
  - Create embedding from `name + newline + description`.
  - Insert concept document.

### 3) Embedding generation

- Model: `sentence-transformers/all-MiniLM-L6-v2`.
- Embedding is generated locally in process.
- Stored on each concept document as float array.

### 4) Vector similarity search

- For each ingested concept with embedding, backend runs `$vectorSearch`:
  - index: `embedding_index`
  - path: `embedding`
  - `numCandidates: 200`
  - initial `limit: top_k * 5` where default ingest call uses `top_k=3`.
- Post-filter conditions:
  - Same `user_id` only.
  - Exclude concepts from same `source_input_id`.
  - Exclude same concept name as query.
  - Require similarity score `>= 0.5`.
- Keep first `top_k` filtered results.

### 5) Contradiction detection and connection surfacing

- For each similar concept pair, backend runs `analyze_concept_pair` in Gemini.
- Single response includes:
  - `is_contradiction`
  - `contradiction_confidence`
  - `contradiction_explanation`
  - `connection_exists`
  - `connection_explanation`
- Contradiction is stored only when:
  - `is_contradiction == true`
  - `contradiction_confidence == "high"` (case-insensitive compare after lowercase normalization)
- Connection is stored whenever `connection_exists == true`.

### 6) Relationship edge storage

- Each extracted relationship with non-empty `from` and `to` is inserted into `edges`.
- No deduplication is applied at write time.

### 7) Graph assembly for client

- Backend `get_all_nodes_and_edges` returns:
  - Input nodes (type `input`)
  - Concept nodes (type `concept`)
  - Relationship links (from `edges`)
  - Synthetic extraction links (`extracted_from`) from input id to concept id.
- Frontend `GraphArea` then merges this with contradiction and connection links derived from separate insight arrays.

## API Endpoints

All routes are mounted at root with no prefix.

### `GET /`

- Purpose: health check.
- Params: none.
- Response:
  - `200`: `{ "status": "ok" }`

### `POST /ingest/text`

- Purpose: ingest free text.
- Request body:
  - `content: string`
  - `user_id: string`
- Responses:
  - `200`: `{ "status": "ok", "concepts_added": number, "concepts_extracted": number, "contradictions_found": number, "connections_found": number }`
  - `400`: `{ "error": "user_id is required" }` when missing or blank user id.
  - `503`: DB not configured.

### `POST /ingest/pdf`

- Purpose: ingest uploaded PDF.
- Request:
  - multipart form field `file` (PDF only)
  - form field `user_id: string`
- Responses:
  - `200`: same shape as text ingest.
  - `400`: invalid file extension, unreadable PDF, empty extracted text, or missing user id.
  - `503`: DB not configured.

### `GET /entries/{user_id}`

- Purpose: list ingested entries with concept counts.
- Path params:
  - `user_id: string`
- Response:
  - `200`: `Entry[]` where each entry has:
    - `id: string`
    - `content: string`
    - `content_type: string`
    - `created_at: string | null`
    - `concept_count: number`

### `GET /graph/{user_id}`

- Purpose: return graph nodes and links.
- Path params:
  - `user_id: string`
- Response:
  - `200`: `{ "nodes": GraphNode[], "links": GraphLink[] }`
  - Node types include `input` and `concept`.
  - Link types include stored relationship types plus `extracted_from`.

### `DELETE /graph/{user_id}`

- Purpose: clear all user data across all user-scoped collections.
- Path params:
  - `user_id: string`
- Response:
  - `200`: `{ "status": "ok", "deleted_count": number }`

### `DELETE /concept/{concept_id}?user_id=...`

- Purpose: delete one concept and related artifacts.
- Path params:
  - `concept_id: string` (must parse to ObjectId)
- Query params:
  - `user_id: string`
- Responses:
  - `200`: `{ "status": "ok", "deleted_count": number }`
  - `400`: invalid concept id format.
  - `403`: concept belongs to different user.
  - `404`: concept not found.

### `DELETE /input/{input_id}?user_id=...`

- Purpose: delete one input, its concepts, and related artifacts.
- Path params:
  - `input_id: string`
- Query params:
  - `user_id: string`
- Responses:
  - `200`: `{ "status": "ok", "deleted_count": number }`
  - `400`: invalid input id format.
  - `403`: input belongs to different user.
  - `404`: input not found.

### `GET /contradictions/{user_id}`

- Purpose: list contradiction insights for user.
- Path params:
  - `user_id: string`
- Response:
  - `200`: array of contradiction documents, sorted by `created_at` descending, includes stringified `_id` and `id`.

### `GET /connections/{user_id}`

- Purpose: list connection insights for user.
- Path params:
  - `user_id: string`
- Response:
  - `200`: array of connection documents, sorted by `created_at` descending, includes stringified `_id` and `id`.

### `GET /timeline/{user_id}`

- Purpose: list belief shift history for user.
- Path params:
  - `user_id: string`
- Response:
  - `200`: array of belief shift documents sorted by `created_at` descending.

### `GET /timeline/{user_id}/{concept_name}`

- Purpose: list belief shift history for one concept.
- Path params:
  - `user_id: string`
  - `concept_name: string`
- Matching:
  - case-insensitive exact concept name regex.
- Response:
  - `200`: array of belief shift documents sorted by `created_at` ascending.

## Key Algorithms

### Deduplication logic

- Implemented in `server/app/routes/ingest.py`.
- Concept dedup is user-scoped and name-based only.
- Name match is case-insensitive full-string regex.
- Description differences do not create new concept docs, they may trigger belief shift updates.

### Belief shift detection

- Triggered only when existing and incoming descriptions differ after normalization.
- Gemini `analyze_belief_shift` decides if meaningfully shifted.
- If shifted:
  - store a `belief_shifts` record
  - update concept description and embedding.

### Graph link merging

- Backend returns persisted relationship links and synthetic `extracted_from` links.
- Frontend adds contradiction and connection links by matching concept names to existing concept nodes.
- Links with unresolved endpoints are dropped from rendered model.
- Duplicate links are not explicitly deduplicated in merge path.

### Node sizing behavior

- In `client/src/components/GraphArea.tsx`, node radius is fixed by node type:
  - Input nodes base radius: `7`
  - Concept nodes base radius: `5`
  - Hover adds `+1`.
- Node size is not based on degree, recency, concept count, or confidence score.

## Authentication Flow and User Scoping

### Frontend sign-in flow

1. Firebase app initializes in `client/src/lib/firebase.ts`.
2. `AuthProvider` subscribes via `onAuthStateChanged`.
3. Landing page triggers Google popup sign-in (`signInWithPopup`).
4. On success, user is navigated to `/app`.
5. `App` requires `user` from context, else redirects to `/`.

### Request scoping

- Frontend passes `user.uid` as `user_id` to backend calls:
  - Path params for read routes.
  - Query params for delete routes.
  - Body/form fields for ingest routes.
- Backend filters by `user_id` in Mongo queries and write operations.

### Important security characteristic

- Current API client does not send Firebase ID tokens in headers.
- Backend currently trusts supplied `user_id` rather than verifying Firebase auth tokens.
- Data isolation is implemented by query filtering, not cryptographic authentication enforcement.

## Known Limitations and Tradeoffs

- Python dependency versions are not pinned in backend requirements.
- CORS is fully permissive in backend (`*` origin, all methods/headers).
- Concept identity uses name-only dedup; synonyms and paraphrases can become separate nodes.
- Edges are inserted without deduplication, so repeated ingestion can create duplicate semantic edges.
- Contradictions require Gemini confidence exactly `high`, which can under-report uncertain but useful conflicts.
- Frontend graph merge can include duplicates if similar links exist in multiple sources.
- Node sizing is static and does not communicate importance metrics.
- `AuthProvider` returns `null` during initial loading, so users see a blank shell before auth state resolves.
- Backend does not create the Atlas vector index automatically.
- If `GEMINI_API_KEY` is missing, extraction and reasoning return empty or default data.
- If MongoDB is not configured, data routes fail with `503`.
- `GraphArea` contains debug logging calls that may be noisy in production.
- Some static assets in `client/src/assets` are currently unused.

## Feature List (User Perspective)

- Sign in with Google.
- Ingest plain text notes.
- Upload and ingest PDF documents, including drag-and-drop.
- Visualize a graph of source inputs and extracted concepts.
- View concept relationships and extraction links.
- Discover contradictions between concepts.
- Discover non-obvious cross-concept connections.
- Track belief shifts over time in timeline views.
- Browse ingested entries with per-entry concept counts.
- Search nodes by name from the top navbar.
- Click graph nodes to inspect detailed context in the right panel.
- Navigate from concept to source input and from input to extracted concepts.
- Delete a concept or delete an input with associated concept cleanup.
- Zoom, pan, fit, and interactively explore the graph.

## Operational Notes for Future Development

- Consider adding backend token verification with Firebase Admin SDK for authenticated API boundaries.
- Consider pinning backend dependency versions and adding lock/constraints for reproducible builds.
- Consider adding explicit link deduplication and richer node sizing metrics.
- Consider improving API error payload propagation in frontend (`requestJson` currently throws status-only errors).
