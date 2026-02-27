"""
Central configuration for the AI Data Quality Service.
All values loaded from environment variables.
"""
import os
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

@lru_cache
def get_settings():
    return {
        "database_url": os.getenv("DATABASE_URL", "postgresql://postgres:4574@localhost:5432/data_quality_copilot"),
        "gemini_api_key": os.getenv("GEMINI_API_KEY"),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "log_level": os.getenv("LOG_LEVEL", "info"),
    }


def get_table_name(table_id: str) -> str:
    """Derive physical table name from table_id. Sanitizes input."""
    safe = "".join(c for c in table_id if c.isalnum() or c == "_")
    if not safe:
        raise ValueError("Invalid table_id")
    return f"_dqc_{safe}"
