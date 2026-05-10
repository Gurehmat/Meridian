from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

model = SentenceTransformer(MODEL_NAME)


def embed_text(text: str) -> list[float]:
    embedding = model.encode(text)
    return embedding.astype(float).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    embeddings = model.encode(texts)
    return [embedding.astype(float).tolist() for embedding in embeddings]
