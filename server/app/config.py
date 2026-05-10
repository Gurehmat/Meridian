import os

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DATABASE_NAME = "meridian"
