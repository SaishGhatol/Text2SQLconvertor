"""
Query Router — handles DB connection, schema extraction, and full query pipeline.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
import sqlalchemy

from core.database import get_db
from core.security import get_current_user
from services.query_service import run_full_pipeline
from services.schema_service import (
    extract_schema,
    get_schema_summary,
    build_schema_profile,
    generate_schema_questions,
    get_all_table_previews,
)
from services.history_service import save_query
from models.user import User

router = APIRouter()

# In-memory per-session engine store (production: use session tokens + DB)
_engines: dict[str, object] = {}
_schemas: dict[str, str] = {}

class ConnectRequest(BaseModel):
    db_type: str
    sqlite_path: Optional[str] = "project_data.db"
    host: Optional[str] = "localhost"
    port: Optional[int] = None
    database: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None

    class Config:
        extra = "allow"   # ignore any extra fields from frontend

class QueryRequest(BaseModel):
    question: str
    conversation_history: Optional[List[dict]] = []

@router.post("/connect")
async def connect_database(
    body: ConnectRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        db_type = body.db_type.strip()
        if db_type == "SQLite":
            conn_str = f"sqlite:///{body.sqlite_path}"
        elif db_type == "MySQL":
            port = body.port or 3306
            conn_str = f"mysql+pymysql://{body.user}:{body.password}@{body.host}:{port}/{body.database}"
        elif db_type == "PostgreSQL":
            port = body.port or 5432
            conn_str = f"postgresql+psycopg2://{body.user}:{body.password}@{body.host}:{port}/{body.database}"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported database type: {db_type}")

        engine = sqlalchemy.create_engine(conn_str, pool_pre_ping=True)
        schema = extract_schema(engine)
        schema_tree = get_schema_summary(schema)
        schema_profile = build_schema_profile(engine)
        suggested_questions = generate_schema_questions(schema_profile)

        _engines[str(current_user.id)] = engine
        _schemas[str(current_user.id)] = schema

        return {
            "status": "connected",
            "db_type": db_type,
            "schema_text": schema,
            "schema_tree": schema_tree,
            "table_count": len(schema_tree),
            "schema_profile": schema_profile,
            "suggested_questions": suggested_questions,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
@router.post("/run")
async def run_query(
    body: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = str(current_user.id)
    engine = _engines.get(uid)
    schema = _schemas.get(uid)

    if not engine or not schema:
        raise HTTPException(status_code=400, detail="No database connected. Please connect a database first.")

    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    result = await run_full_pipeline(
        engine=engine,
        schema=schema,
        question=body.question,
        db_type="SQLite",
        conversation_history=body.conversation_history,
        user_id=current_user.id,
    )

    if "error" not in result:
        await save_query(
            db=db,
            user_id=current_user.id,
            question=body.question,
            sql=result["sql"],
            was_corrected=result.get("was_corrected", False),
            execution_time_ms=result.get("execution_time_ms", 0),
            row_count=result.get("row_count", 0),
            db_type="connected",
            status="success",
        )
    else:
        await save_query(
            db=db,
            user_id=current_user.id,
            question=body.question,
            sql=result.get("sql", ""),
            was_corrected=False,
            execution_time_ms=0,
            row_count=0,
            db_type="connected",
            status="error",
        )

    return result


@router.get("/schema")
async def get_schema(current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    schema = _schemas.get(uid)
    engine = _engines.get(uid)
    if not schema:
        raise HTTPException(status_code=404, detail="No schema loaded. Connect a database first.")
    schema_profile = build_schema_profile(engine) if engine else None
    suggested_questions = generate_schema_questions(schema_profile) if schema_profile else []
    return {
        "schema_text": schema,
        "schema_tree": get_schema_summary(schema),
        "schema_profile": schema_profile,
        "suggested_questions": suggested_questions,
    }


@router.get("/table-previews")
async def get_table_previews(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
):
    uid = str(current_user.id)
    engine = _engines.get(uid)
    schema = _schemas.get(uid)

    if not engine or not schema:
        raise HTTPException(status_code=404, detail="No schema loaded. Connect a database first.")

    safe_limit = max(1, min(limit, 20))
    return {
        "previews": get_all_table_previews(engine, safe_limit),
        "limit": safe_limit,
    }
