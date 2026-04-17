"""
Query Service — orchestrates AI generation, validation, execution,
retry logic (self-healing), caching, and history persistence.
"""

import time
import logging
import sqlalchemy
import pandas as pd
from sqlalchemy import text
from typing import Optional
import re

from services.ai_service import generate_sql, fix_sql, explain_sql, suggest_insights
from core.config import settings
from core import cache

logger = logging.getLogger(__name__)

FORBIDDEN = {"drop","delete","update","alter","truncate","insert","create","replace","grant","revoke"}


def validate_sql(sql: str) -> tuple[bool, str]:
    lower = sql.lower().strip()
    if not lower.startswith("select"):
        return False, "Only SELECT queries are permitted."
    for kw in FORBIDDEN:
        pattern = r'\b' + kw + r'\b'
        import re
        if re.search(pattern, lower):
            return False, f"Forbidden SQL keyword detected: {kw.upper()}"
    return True, "OK"


def execute_query(engine, sql: str) -> tuple[pd.DataFrame, float]:
    start = time.perf_counter()
    with engine.connect() as conn:
        df = pd.read_sql(text(sql), conn)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    return df, elapsed_ms


def analyze_sql(sql: str, row_count: int, columns: list[str]) -> dict:
    normalized = " ".join(sql.lower().split())
    tables = []
    for pattern in (r"\bfrom\s+([a-zA-Z_][\w]*)", r"\bjoin\s+([a-zA-Z_][\w]*)"):
        tables.extend(re.findall(pattern, normalized))

    clauses = {
        "has_join": " join " in normalized,
        "has_group_by": " group by " in normalized,
        "has_order_by": " order by " in normalized,
        "has_where": " where " in normalized,
        "has_limit": " limit " in normalized,
        "has_aggregate": any(fn in normalized for fn in ("count(", "sum(", "avg(", "min(", "max(")),
        "has_subquery": normalized.count("select") > 1,
    }

    complexity_score = 1
    complexity_score += 2 if clauses["has_join"] else 0
    complexity_score += 2 if clauses["has_group_by"] else 0
    complexity_score += 1 if clauses["has_order_by"] else 0
    complexity_score += 1 if clauses["has_where"] else 0
    complexity_score += 2 if clauses["has_subquery"] else 0
    complexity_score += 1 if clauses["has_aggregate"] else 0
    complexity_score = min(complexity_score, 10)

    if complexity_score >= 8:
        complexity_label = "Advanced"
    elif complexity_score >= 5:
        complexity_label = "Intermediate"
    else:
        complexity_label = "Basic"

    return {
        "tables": sorted(set(tables)),
        "clauses": clauses,
        "complexity_score": complexity_score,
        "complexity_label": complexity_label,
        "result_shape": {
            "row_count": row_count,
            "column_count": len(columns),
        },
    }


async def run_full_pipeline(
    engine,
    schema: str,
    question: str,
    db_type: str,
    conversation_history: list[dict] = None,
    user_id: int = None,
) -> dict:
    """
    Full pipeline:
    1. Check cache
    2. Generate SQL
    3. Validate
    4. Execute (with retry up to MAX_QUERY_RETRIES)
    5. Explain + Insights
    6. Cache result
    """
    # Cache check
    cached = cache.get_cached(schema, question, ttl=settings.QUERY_CACHE_TTL)
    if cached:
        logger.info(f"Cache HIT for question: {question[:60]}")
        cached["from_cache"] = True
        return cached

    was_corrected = False
    last_error = None
    sql = await generate_sql(schema, question, conversation_history)

    ok, msg = validate_sql(sql)
    if not ok:
        return {"error": msg, "sql": sql}

    df = None
    execution_time_ms = 0.0

    for attempt in range(1, settings.MAX_QUERY_RETRIES + 1):
        try:
            df, execution_time_ms = execute_query(engine, sql)
            break
        except Exception as e:
            last_error = str(e)
            logger.warning(f"SQL execution failed (attempt {attempt}): {e}")
            if attempt < settings.MAX_QUERY_RETRIES:
                sql = await fix_sql(schema, sql, last_error, attempt)
                ok, msg = validate_sql(sql)
                if not ok:
                    return {"error": msg, "sql": sql}
                was_corrected = True
            else:
                return {"error": f"Query failed after {settings.MAX_QUERY_RETRIES} attempts: {last_error}", "sql": sql}

    # Prepare result
    rows = df.to_dict(orient="records")
    columns = list(df.columns)
    results_preview = df.head(5).to_string(index=False)

    explanation = await explain_sql(question, sql, schema)
    insights = await suggest_insights(schema, question, results_preview)
    sql_analysis = analyze_sql(sql, len(rows), columns)

    result = {
        "sql": sql,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "execution_time_ms": execution_time_ms,
        "was_corrected": was_corrected,
        "explanation": explanation,
        "insights": insights,
        "sql_analysis": sql_analysis,
        "from_cache": False,
    }

    cache.set_cache(schema, question, result)
    return result
