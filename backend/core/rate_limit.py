from collections import defaultdict, deque
import time

from fastapi import HTTPException, Request, status


_buckets: dict[str, deque[float]] = defaultdict(deque)


def _identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request, key: str, limit: int, window_seconds: int):
    now = time.monotonic()
    bucket = _buckets[f"{key}:{_identifier(request)}"]

    while bucket and now - bucket[0] > window_seconds:
        bucket.popleft()

    if len(bucket) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {key}. Try again later.",
        )

    bucket.append(now)
