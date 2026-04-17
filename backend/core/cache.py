"""
Simple in-memory TTL cache for SQL query results.
Production: swap for Redis.
"""

import time
import hashlib
import json
from typing import Any, Optional

_cache: dict[str, tuple[Any, float]] = {}


def _make_key(schema: str, question: str) -> str:
    raw = f"{schema}::{question.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached(schema: str, question: str, ttl: int = 300) -> Optional[dict]:
    key = _make_key(schema, question)
    if key in _cache:
        value, timestamp = _cache[key]
        if time.time() - timestamp < ttl:
            return value
        del _cache[key]
    return None


def set_cache(schema: str, question: str, result: dict):
    key = _make_key(schema, question)
    _cache[key] = (result, time.time())


def invalidate_cache(schema: str, question: str):
    key = _make_key(schema, question)
    _cache.pop(key, None)


def clear_all():
    _cache.clear()
