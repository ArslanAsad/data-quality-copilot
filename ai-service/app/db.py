"""
Database connection and session management.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager
from app.config import get_settings

_settings = get_settings()
engine = create_engine(
    _settings["database_url"],
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@contextmanager
def get_db():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def fetch_table_data(table_name: str) -> list[dict]:
    """Fetch all rows from a dynamically named table as list of dicts."""
    with get_db() as session:
        result = session.execute(text(f'SELECT * FROM "{table_name}"'))
        columns = result.keys()
        rows = [dict(zip(columns, row)) for row in result.fetchall()]
    return rows
