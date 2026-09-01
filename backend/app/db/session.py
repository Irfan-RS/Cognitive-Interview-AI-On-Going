from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

is_sqlite = settings.database_url.startswith("sqlite")

# check_same_thread=False: needed for FastAPI's threaded request handling.
# timeout: wait for a held write lock instead of immediately raising
# "database is locked" when two requests overlap (analysis/report calls are slow
# enough that this genuinely happens during a normal interview).
connect_args = {"check_same_thread": False, "timeout": 30} if is_sqlite else {}

engine = create_engine(settings.resolved_database_url, connect_args=connect_args)


if is_sqlite:

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        # WAL lets reads proceed concurrently with a write, instead of readers and
        # the writer blocking each other outright under the default rollback journal.
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
