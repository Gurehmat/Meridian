# Meridian

Map your mind. Find what conflicts.

Meridian is an AI-powered personal knowledge graph. Dump in anything (text, articles, ideas, notes) and it automatically extracts concepts, builds a visual interactive graph, and finds contradictions and unexpected connections across everything you have ever added.

## What Makes It Different

Most AI tools forget what you said last week. Meridian remembers everything and actively argues with it. It finds where your beliefs conflict, where ideas from completely different domains secretly connect, and shows your entire thinking as a visual, explorable graph.

## How It Works

1. Paste text or notes into the input panel
2. Gemini 2.5 Flash extracts key concepts and relationships as structured data
3. MiniLM (all-MiniLM-L6-v2) generates 384-dimensional embeddings for each concept
4. MongoDB Atlas Vector Search finds semantically similar concepts across your entire knowledge base
5. Gemini analyzes similar pairs for contradictions ("You believe X but also Y") and unexpected connections ("Your BJJ concept connects to this Stoic principle because...")
6. An interactive force-directed graph visualizes all your concepts, relationships, contradictions, and connections

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, react-force-graph-2d, deployed on Vercel

**Backend:** Python, FastAPI, Dockerized for Google Cloud Run

**AI/ML:**
- Google Gemini 2.5 Flash for concept extraction, contradiction detection, and connection surfacing
- sentence-transformers/all-MiniLM-L6-v2 (HuggingFace) for generating 384-dim embeddings locally in the Python backend

**Database:** MongoDB Atlas with Atlas Vector Search (cosine similarity, 384 dimensions)

## Cloud Technologies Used

- Google Cloud Run (backend hosting)
- Google Gemini API (AI reasoning)
- MongoDB Atlas + Vector Search (database + semantic search)
- Vercel (frontend hosting)

## Setup

### Frontend
```bash
cd client
npm install
npm run dev
```

### Backend
```bash
cd server
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### Environment Variables

**server/.env**
```
MONGODB_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_gemini_api_key
```

**client/.env**
```
VITE_API_URL=http://localhost:8080
```

### MongoDB Atlas Vector Search Index

Create a vector search index named `embedding_index` on the `concepts` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```

## Architecture

```
User Input -> FastAPI /ingest -> Gemini (concept extraction) -> MiniLM (embeddings)
-> MongoDB Atlas (storage) -> Vector Search (find similar) -> Gemini (contradiction/connection detection)
-> React frontend (force-directed graph visualization)
```

## Built For

GDG Hacks 2026, University of Guelph