"""
Query Service — orchestrates AI generation, validation, execution,
retry logic (self-healing), caching, SQL Editor mode, row limits,
and result analysis.
"""

import time
import logging
import pandas as pd
from sqlalchemy import text
import re
from pandas.api.types import is_bool_dtype, is_datetime64_any_dtype, is_numeric_dtype

from services.ai_service import generate_sql, fix_sql, explain_sql, suggest_insights
from core.config import settings
from core import cache

logger = logging.getLogger(__name__)

FORBIDDEN = {"drop", "delete", "update", "alter", "truncate", "insert", "create", "replace", "grant", "revoke", "attach", "detach"}
ALLOWED_ROW_LIMITS = {10, 50, 100, 500, 1000}


def normalize_sql(sql: str) -> str:
    """Trim common AI markdown wrappers and trailing semicolons."""
    cleaned = (sql or "").strip()
    cleaned = re.sub(r"^```(?:sql)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned.rstrip("; ").strip()


def validate_sql(sql: str) -> tuple[bool, str]:
    cleaned = normalize_sql(sql)
    lower = cleaned.lower().strip()
    if not lower:
        return False, "SQL cannot be empty."
    if not (lower.startswith("select") or lower.startswith("with")):
        return False, "Only read-only SELECT queries are permitted."
    if ";" in lower:
        return False, "Multiple SQL statements are not permitted."
    for kw in FORBIDDEN:
        if re.search(r"\b" + kw + r"\b", lower):
            return False, f"Forbidden SQL keyword detected: {kw.upper()}"
    return True, "OK"


def has_limit_clause(sql: str) -> bool:
    return bool(re.search(r"\blimit\s+\d+\b", sql.lower()))


def apply_row_limit(sql: str, row_limit: int | None = None) -> str:
    safe_limit = row_limit if row_limit in ALLOWED_ROW_LIMITS else 100
    cleaned = normalize_sql(sql)
    if has_limit_clause(cleaned):
        return cleaned
    return f"{cleaned} LIMIT {safe_limit}"


def execute_query(engine, sql: str, row_limit: int | None = None) -> tuple[pd.DataFrame, float, str]:
    executable_sql = apply_row_limit(sql, row_limit)
    start = time.perf_counter()
    with engine.connect() as conn:
        result = conn.execute(text(executable_sql))
        rows = result.mappings().all()
        df = pd.DataFrame(rows, columns=list(result.keys()))
    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    return df, elapsed_ms, executable_sql


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

    complexity_label = "Advanced" if complexity_score >= 8 else "Intermediate" if complexity_score >= 5 else "Basic"

    return {
        "tables": sorted(set(tables)),
        "clauses": clauses,
        "complexity_score": complexity_score,
        "complexity_label": complexity_label,
        "result_shape": {"row_count": row_count, "column_count": len(columns)},
    }


def _to_python_scalar(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def serialize_rows(df: pd.DataFrame) -> list[dict]:
    records: list[dict] = []
    for row in df.to_dict(orient="records"):
        records.append({key: _to_python_scalar(value) for key, value in row.items()})
    return records


def analyze_result_set(df: pd.DataFrame) -> dict:
    row_count = len(df)
    column_count = len(df.columns)
    if column_count == 0:
        return {
            "summary": {"row_count": row_count, "column_count": 0, "numeric_column_count": 0, "categorical_column_count": 0, "datetime_column_count": 0, "null_cell_count": 0, "completeness_pct": 100.0},
            "columns": [],
            "numeric_summaries": [],
            "highlights": ["The query returned no columns."],
        }

    null_cell_count = int(df.isna().sum().sum())
    total_cells = max(row_count * column_count, 1)
    numeric_column_count = categorical_column_count = datetime_column_count = 0
    column_profiles = []
    numeric_summaries = []

    for column in df.columns:
        series = df[column]
        non_null = series.dropna()
        null_count = int(series.isna().sum())
        unique_count = int(non_null.nunique()) if not non_null.empty else 0
        sample_values = [_to_python_scalar(value) for value in non_null.head(3).tolist()]
        role = "text"
        profile = {"name": column, "role": role, "null_count": null_count, "null_pct": round((null_count / row_count) * 100, 2) if row_count else 0.0, "unique_count": unique_count, "sample_values": sample_values}

        if is_bool_dtype(series):
            role = "boolean"
            categorical_column_count += 1
        elif is_datetime64_any_dtype(series):
            role = "datetime"
            datetime_column_count += 1
            if not non_null.empty:
                profile["min"] = _to_python_scalar(non_null.min())
                profile["max"] = _to_python_scalar(non_null.max())
        elif is_numeric_dtype(series):
            role = "numeric"
            numeric_column_count += 1
            if not non_null.empty:
                min_value = _to_python_scalar(non_null.min())
                max_value = _to_python_scalar(non_null.max())
                mean_value = _to_python_scalar(round(float(non_null.mean()), 4))
                median_value = _to_python_scalar(round(float(non_null.median()), 4))
                profile.update({"min": min_value, "max": max_value, "mean": mean_value, "median": median_value})
                numeric_summaries.append({"name": column, "min": min_value, "max": max_value, "mean": mean_value, "median": median_value})
        else:
            is_category_like = unique_count > 0 and unique_count <= min(20, max(3, row_count // 2))
            role = "category" if is_category_like else "text"
            categorical_column_count += 1 if is_category_like else 0

        profile["role"] = role
        column_profiles.append(profile)

    completeness_pct = round(((total_cells - null_cell_count) / total_cells) * 100, 2)
    keyish_columns = [profile["name"] for profile in column_profiles if profile["unique_count"] == row_count and row_count > 0]

    highlights = [
        f"The result contains {row_count} rows across {column_count} columns.",
        f"Overall completeness is {completeness_pct}% with {null_cell_count} null cells detected.",
    ]
    if keyish_columns:
        highlights.append(f"Potential identifier columns: {', '.join(keyish_columns[:3])}.")
    if numeric_summaries:
        first_numeric = numeric_summaries[0]
        highlights.append(f"{first_numeric['name']} ranges from {first_numeric['min']} to {first_numeric['max']} with an average of {first_numeric['mean']}.")

    return {
        "summary": {"row_count": row_count, "column_count": column_count, "numeric_column_count": numeric_column_count, "categorical_column_count": categorical_column_count, "datetime_column_count": datetime_column_count, "null_cell_count": null_cell_count, "completeness_pct": completeness_pct},
        "columns": column_profiles,
        "numeric_summaries": numeric_summaries[:6],
        "highlights": highlights,
    }


def build_result_payload(df: pd.DataFrame, sql: str, execution_time_ms: float, explanation: str, insights: str, was_corrected: bool = False, from_cache: bool = False, raw_sql: bool = False) -> dict:
    rows = serialize_rows(df)
    columns = list(df.columns)
    return {
        "sql": sql,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "execution_time_ms": execution_time_ms,
        "was_corrected": was_corrected,
        "explanation": explanation,
        "insights": insights,
        "sql_analysis": analyze_sql(sql, len(rows), columns),
        "result_analysis": analyze_result_set(df),
        "from_cache": from_cache,
        "raw_sql": raw_sql,
    }


async def run_full_pipeline(engine, schema: str, question: str, db_type: str, conversation_history: list[dict] = None, user_id: int = None, row_limit: int | None = 100) -> dict:
    cached = cache.get_cached(schema, f"{question}|limit={row_limit}", ttl=settings.QUERY_CACHE_TTL)
    if cached:
        logger.info(f"Cache HIT for question: {question[:60]}")
        cached["from_cache"] = True
        return cached

    was_corrected = False
    last_error = None
    sql = normalize_sql(await generate_sql(schema, question, conversation_history))

    ok, msg = validate_sql(sql)
    if not ok:
        return {"error": msg, "sql": sql}

    df = None
    execution_time_ms = 0.0

    for attempt in range(1, settings.MAX_QUERY_RETRIES + 1):
        try:
            df, execution_time_ms, sql = execute_query(engine, sql, row_limit)
            break
        except Exception as e:
            last_error = str(e)
            logger.warning(f"SQL execution failed (attempt {attempt}): {e}")
            if attempt < settings.MAX_QUERY_RETRIES:
                sql = normalize_sql(await fix_sql(schema, sql, last_error, attempt))
                ok, msg = validate_sql(sql)
                if not ok:
                    return {"error": msg, "sql": sql}
                was_corrected = True
            else:
                return {"error": f"Query failed after {settings.MAX_QUERY_RETRIES} attempts: {last_error}", "sql": sql}

    results_preview = df.head(5).to_string(index=False)
    explanation = await explain_sql(question, sql, schema)
    insights = await suggest_insights(schema, question, results_preview)
    result = build_result_payload(df, sql, execution_time_ms, explanation, insights, was_corrected=was_corrected)
    cache.set_cache(schema, f"{question}|limit={row_limit}", result)
    return result


async def execute_raw_sql(engine, schema: str, sql: str, row_limit: int | None = 100, question: str = "Edited SQL execution") -> dict:
    cleaned_sql = normalize_sql(sql)
    ok, msg = validate_sql(cleaned_sql)
    if not ok:
        return {"error": msg, "sql": cleaned_sql}

    try:
        df, execution_time_ms, executable_sql = execute_query(engine, cleaned_sql, row_limit)
    except Exception as e:
        logger.warning(f"Raw SQL execution failed: {e}")
        return {"error": str(e), "sql": cleaned_sql}

    return build_result_payload(
        df,
        executable_sql,
        execution_time_ms,
        "Executed from SQL Editor mode. The query was validated as read-only before running.",
        "You can adjust the SQL, change the row limit, export the result, or create a chart from the returned columns.",
        raw_sql=True,
    )
