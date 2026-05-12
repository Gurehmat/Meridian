from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import DATABASE_NAME, MONGODB_URI
from app.routes import graph, ingest, insights, timeline

COLLECTIONS = (
    "concepts",
    "edges",
    "inputs",
    "contradictions",
    "connections",
    "belief_shifts",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.mongo_client = None
    app.state.db = None

    if MONGODB_URI:
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        existing_collections = await db.list_collection_names()

        for collection_name in COLLECTIONS:
            if collection_name not in existing_collections:
                await db.create_collection(collection_name)

        app.state.mongo_client = client
        app.state.db = db

    yield

    if app.state.mongo_client is not None:
        app.state.mongo_client.close()


app = FastAPI(title="Meridian API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(graph.router)
app.include_router(insights.router)
app.include_router(timeline.router)


@app.get("/")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
