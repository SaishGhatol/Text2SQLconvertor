"""
Schema extraction, profiling, and schema-driven prompt suggestions.
Supports SQLite, MySQL, PostgreSQL via SQLAlchemy.
"""

import sqlalchemy
from sqlalchemy import select, func, MetaData, Table


def extract_schema(engine) -> str:
    inspector = sqlalchemy.inspect(engine)
    tables = inspector.get_table_names()
    parts = []

    for table in tables:
        parts.append(f"Table: {table}")
        columns = inspector.get_columns(table)
        pk = inspector.get_pk_constraint(table)
        fks = inspector.get_foreign_keys(table)
        indices = inspector.get_indexes(table)

        for col in columns:
            nullable = "" if col.get("nullable", True) else " NOT NULL"
            default = f" DEFAULT {col['default']}" if col.get("default") else ""
            parts.append(f"  - {col['name']} {col['type']}{nullable}{default}")

        if pk and pk.get("constrained_columns"):
            parts.append(f"  PK: {', '.join(pk['constrained_columns'])}")

        for fk in fks:
            cols = ", ".join(fk.get("constrained_columns", []))
            ref_table = fk.get("referred_table", "")
            ref_cols = ", ".join(fk.get("referred_columns", []))
            parts.append(f"  FK: {cols} → {ref_table}({ref_cols})")

        for idx in indices:
            if not idx.get("unique"):
                parts.append(f"  INDEX: {', '.join(idx['column_names'])}")

        parts.append("")

    return "\n".join(parts)


def get_schema_summary(schema: str) -> dict:
    """Parse schema string back into structured dict for frontend display."""
    tables = {}
    current_table = None
    for line in schema.splitlines():
        if line.startswith("Table: "):
            current_table = line[7:].strip()
            tables[current_table] = []
        elif line.strip().startswith("- ") and current_table:
            tables[current_table].append(line.strip()[2:])
    return tables


def _safe_row_count(engine, table_name: str) -> int | None:
    try:
        with engine.connect() as conn:
            metadata = MetaData()
            table = Table(table_name, metadata, autoload_with=engine)
            return conn.execute(select(func.count()).select_from(table)).scalar()
    except Exception:
        return None


def build_schema_profile(engine) -> dict:
    inspector = sqlalchemy.inspect(engine)
    tables = inspector.get_table_names()

    table_profiles = []
    relationships = []
    total_columns = 0
    numeric_columns = 0
    date_columns = 0
    text_columns = 0

    for table in tables:
        columns = inspector.get_columns(table)
        fks = inspector.get_foreign_keys(table)
        pk = inspector.get_pk_constraint(table)
        row_count = _safe_row_count(engine, table)

        numeric = []
        dates = []
        text_like = []

        for col in columns:
            col_name = col["name"]
            type_str = str(col["type"]).lower()
            total_columns += 1

            if any(token in type_str for token in ("int", "real", "float", "double", "numeric", "decimal")):
                numeric.append(col_name)
                numeric_columns += 1
            elif any(token in type_str for token in ("date", "time", "year")):
                dates.append(col_name)
                date_columns += 1
            else:
                text_like.append(col_name)
                text_columns += 1

        for fk in fks:
            relationships.append({
                "from_table": table,
                "from_columns": fk.get("constrained_columns", []),
                "to_table": fk.get("referred_table", ""),
                "to_columns": fk.get("referred_columns", []),
            })

        table_profiles.append({
            "name": table,
            "row_count": row_count,
            "column_count": len(columns),
            "primary_key": pk.get("constrained_columns", []) if pk else [],
            "numeric_columns": numeric,
            "date_columns": dates,
            "text_columns": text_like[:6],
            "foreign_key_count": len(fks),
        })

    overview = {
        "table_count": len(tables),
        "total_columns": total_columns,
        "relationship_count": len(relationships),
        "numeric_column_count": numeric_columns,
        "date_column_count": date_columns,
        "text_column_count": text_columns,
        "densest_table": max(table_profiles, key=lambda t: t["column_count"], default=None),
        "largest_table": max(
            [t for t in table_profiles if t["row_count"] is not None],
            key=lambda t: t["row_count"],
            default=None,
        ),
    }

    return {
        "overview": overview,
        "tables": table_profiles,
        "relationships": relationships,
    }


def generate_schema_questions(schema_profile: dict) -> list[str]:
    questions: list[str] = []
    tables = schema_profile.get("tables", [])
    largest = schema_profile.get("overview", {}).get("largest_table")

    if largest:
        questions.append(f"Show the top 10 rows from {largest['name']}")

    for table in tables[:4]:
        name = table["name"]
        if table["numeric_columns"]:
            metric = table["numeric_columns"][0]
            questions.append(f"What is the average {metric} in {name}?")
        if table["date_columns"]:
            dt = table["date_columns"][0]
            questions.append(f"Show the monthly trend in {name} using {dt}")
        if table["text_columns"]:
            dim = table["text_columns"][0]
            questions.append(f"Count records in {name} grouped by {dim}")

    deduped: list[str] = []
    seen = set()
    for q in questions:
        if q not in seen:
            deduped.append(q)
            seen.add(q)
    return deduped[:6]


def get_table_preview(engine, table_name: str, limit: int = 5) -> dict:
    metadata = MetaData()
    table = Table(table_name, metadata, autoload_with=engine)

    with engine.connect() as conn:
        rows = conn.execute(select(table).limit(limit)).mappings().all()

    return {
        "table": table_name,
        "columns": [column.name for column in table.columns],
        "rows": [dict(row) for row in rows],
    }


def get_all_table_previews(engine, limit: int = 5) -> dict:
    inspector = sqlalchemy.inspect(engine)
    previews = {}

    for table_name in inspector.get_table_names():
        try:
            previews[table_name] = get_table_preview(engine, table_name, limit)
        except Exception:
            previews[table_name] = {
                "table": table_name,
                "columns": [],
                "rows": [],
            }

    return previews
