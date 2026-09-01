from datetime import timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """SQLite has no timezone-aware datetime column type — it stores the
    wall-clock value as text and hands back a NAIVE datetime on every read,
    silently dropping the tzinfo a `datetime.now(timezone.utc)` write went in
    with. Every stored value here is UTC by convention (see the `default=`
    on every column using this type), so this type re-attaches `tzinfo=utc`
    on the way out — otherwise the API serializes timestamps with no
    timezone marker at all, and a browser parses "2026-08-31T08:46:23" as
    LOCAL time, silently shifting it by the viewer's UTC offset."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
