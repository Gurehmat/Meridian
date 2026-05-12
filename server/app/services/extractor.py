import fitz
import requests
from bs4 import BeautifulSoup


def extract_text_from_pdf(file_bytes: bytes) -> str:
    document = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        return "\n".join(page.get_text("text") for page in document)
    finally:
        document.close()


def extract_text_from_url(url: str) -> str:
    response = requests.get(url, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    for element in soup(["script", "style", "noscript", "svg"]):
        element.decompose()

    content_root = soup.find("main") or soup.find("article") or soup.body or soup
    text = content_root.get_text(separator=" ", strip=True)
    return " ".join(text.split())


def chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    words = text.split()

    if not words:
        return []

    overlap = max(25, chunk_size // 10)
    chunks: list[str] = []
    start = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))

        if end == len(words):
            break

        start = max(end - overlap, start + 1)

    return chunks
