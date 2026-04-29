"""
Query Router — handles datasource connections, persistent connection profiles,
schema extraction, AI query runs, SQL Editor execution, and schema explorer data.
"""

import os
from typing import List, Optional

import sqlalchemy
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.rate_limit import enforce_rate_limit
from core.security import get_current_user
from models.user import User
from services.audit_service import log_audit_event
from services.connection_profile_service import (
    build_profile_payload,
    create_connection_profile,
    delete_connection_profile,
    get_connection_profile,
    list_connection_profiles,
    mark_profile_used,
    serialize_connection_profile,
)
from services.history_service import save_query
from services.query_service import ALLOWED_ROW_LIMITS, execute_raw_sql, run_full_pipeline
from services.schema_service import (
    build_schema_profile,
    extract_schema,
    generate_schema_questions,
    get_all_table_previews,
    get_schema_summary,
)

router = APIRouter()

# Active in-memory engines for current sessions. Saved profiles persist metadata and encrypted credentials.
_engines: dict[str, object] = {}
_schemas: dict[str, str] = {}
_db_types: dict[str, str] = {}
_active_profile_ids: dict[str, int | None] = {}


class ConnectRequest(BaseModel):
    db_type: str
    sqlite_path: Optional[str] = "project_data.db"
    host: Optional[str] = "localhost"
    port: Optional[int] = None
    database: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None

    class Config:
        extra = "allow"


class ConnectionProfileRequest(ConnectRequest):
    profile_name: str = Field(min_length=2, max_length=120)
    is_favorite: bool = False


class QueryRequest(BaseModel):
    question: str
    conversation_history: Optional[List[dict]] = []
    row_limit: int = Field(default=100, description="Maximum rows to return: 10/50/100/500/1000")


class RawQueryRequest(BaseModel):
    sql: str
    question: Optional[str] = "Edited SQL execution"
    row_limit: int = Field(default=100, description="Maximum rows to return: 10/50/100/500/1000")


def _safe_row_limit(value: int) -> int:
    return value if value in ALLOWED_ROW_LIMITS else 100


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _validate_connection_payload(body: ConnectRequest) -> dict:
    db_type = (body.db_type or "").strip()
    if db_type not in {"SQLite", "MySQL", "PostgreSQL"}:
        raise HTTPException(status_code=400, detail=f"Unsupported database type: {db_type}")

    payload = {
        "db_type": db_type,
        "sqlite_path": (body.sqlite_path or "").strip() or None,
        "host": (body.host or "").strip() or None,
        "port": body.port,
        "database": (body.database or "").strip() or None,
        "user": (body.user or "").strip() or None,
        "password": body.password or None,
    }

    if db_type == "SQLite":
        if not payload["sqlite_path"]:
            raise HTTPException(status_code=422, detail="SQLite path is required.")
        if not os.path.exists(payload["sqlite_path"]):
            raise HTTPException(status_code=400, detail="SQLite file does not exist.")
    else:
        if not payload["host"] or not payload["database"] or not payload["user"]:
            raise HTTPException(status_code=422, detail="Host, database, and user are required for this datasource.")
        if db_type == "MySQL":
            payload["port"] = payload["port"] or 3306
        elif db_type == "PostgreSQL":
            payload["port"] = payload["port"] or 5432

    return payload


def _build_connection_string(payload: dict) -> str:
    if payload["db_type"] == "SQLite":
        return f"sqlite:///{payload['sqlite_path']}"
    if payload["db_type"] == "MySQL":
        return f"mysql+pymysql://{payload['user']}:{payload['password']}@{payload['host']}:{payload['port']}/{payload['database']}"
    return f"postgresql+psycopg2://{payload['user']}:{payload['password']}@{payload['host']}:{payload['port']}/{payload['database']}"


def _build_engine(payload: dict):
    conn_str = _build_connection_string(payload)
    if payload["db_type"] == "SQLite":
        return sqlalchemy.create_engine(conn_str, pool_pre_ping=True, connect_args={"check_same_thread": False})
    return sqlalchemy.create_engine(conn_str, pool_pre_ping=True, pool_recycle=1800)


def _clear_active_connection(uid: str):
    engine = _engines.pop(uid, None)
    if engine:
        engine.dispose()
    _schemas.pop(uid, None)
    _db_types.pop(uid, None)
    _active_profile_ids.pop(uid, None)


def _set_active_connection(uid: str, engine, schema: str, db_type: str, profile_id: int | None = None):
    _clear_active_connection(uid)
    _engines[uid] = engine
    _schemas[uid] = schema
    _db_types[uid] = db_type
    _active_profile_ids[uid] = profile_id


def _connect_and_profile(payload: dict):
    engine = _build_engine(payload)
    schema = extract_schema(engine)
    schema_tree = get_schema_summary(schema)
    schema_profile = build_schema_profile(engine)
    suggested_questions = generate_schema_questions(schema_profile)
    return engine, schema, schema_tree, schema_profile, suggested_questions


@router.post("/connect")
async def connect_database(
    body: ConnectRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        payload = _validate_connection_payload(body)
        engine, schema, schema_tree, schema_profile, suggested_questions = _connect_and_profile(payload)

        uid = str(current_user.id)
        _set_active_connection(uid, engine, schema, payload["db_type"])
        await log_audit_event(
            db,
            action="datasource.connect",
            user_id=current_user.id,
            resource_type="datasource",
            details={"db_type": payload["db_type"], "database": payload.get("database"), "sqlite_path": payload.get("sqlite_path")},
            ip_address=_client_ip(request),
        )

        return {
            "status": "connected",
            "db_type": payload["db_type"],
            "schema_text": schema,
            "schema_tree": schema_tree,
            "table_count": len(schema_tree),
            "schema_profile": schema_profile,
            "suggested_questions": suggested_questions,
            "active_profile_id": None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        await log_audit_event(
            db,
            action="datasource.connect",
            status="error",
            user_id=current_user.id,
            resource_type="datasource",
            details={"db_type": body.db_type},
            ip_address=_client_ip(request),
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/disconnect")
async def disconnect_database(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = str(current_user.id)
    _clear_active_connection(uid)
    await log_audit_event(
        db,
        action="datasource.disconnect",
        user_id=current_user.id,
        resource_type="datasource",
        ip_address=_client_ip(request),
    )
    return {"status": "disconnected"}


@router.get("/profiles")
async def get_profiles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profiles = await list_connection_profiles(db, current_user.id)
    return {
        "profiles": [serialize_connection_profile(profile) for profile in profiles],
        "active_profile_id": _active_profile_ids.get(str(current_user.id)),
    }


@router.post("/profiles", status_code=201)
async def save_profile(
    body: ConnectionProfileRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payload = _validate_connection_payload(body)
    profile = await create_connection_profile(
        db=db,
        user_id=current_user.id,
        profile_name=body.profile_name.strip(),
        db_type=payload["db_type"],
        sqlite_path=payload["sqlite_path"],
        host=payload["host"],
        port=payload["port"],
        database=payload["database"],
        user=payload["user"],
        password=payload["password"],
        is_favorite=body.is_favorite,
    )
    await log_audit_event(
        db,
        action="datasource.profile.create",
        user_id=current_user.id,
        resource_type="connection_profile",
        resource_id=str(profile.id),
        details={"profile_name": profile.profile_name, "db_type": profile.db_type},
        ip_address=_client_ip(request),
    )
    return {"profile": serialize_connection_profile(profile)}


@router.delete("/profiles/{profile_id}")
async def remove_profile(
    profile_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_connection_profile(db, profile_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection profile not found.")
    await log_audit_event(
        db,
        action="datasource.profile.delete",
        user_id=current_user.id,
        resource_type="connection_profile",
        resource_id=str(profile_id),
        ip_address=_client_ip(request),
    )
    if _active_profile_ids.get(str(current_user.id)) == profile_id:
        _active_profile_ids[str(current_user.id)] = None
    return {"status": "deleted"}


@router.post("/profiles/{profile_id}/connect")
async def connect_saved_profile(
    profile_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_connection_profile(db, profile_id, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Connection profile not found.")

    payload = _validate_connection_payload(ConnectRequest(**build_profile_payload(profile)))
    try:
        engine, schema, schema_tree, schema_profile, suggested_questions = _connect_and_profile(payload)
        uid = str(current_user.id)
        _set_active_connection(uid, engine, schema, payload["db_type"], profile.id)
        await mark_profile_used(db, profile)
        await log_audit_event(
            db,
            action="datasource.profile.connect",
            user_id=current_user.id,
            resource_type="connection_profile",
            resource_id=str(profile.id),
            details={"profile_name": profile.profile_name, "db_type": profile.db_type},
            ip_address=_client_ip(request),
        )
        return {
            "status": "connected",
            "db_type": payload["db_type"],
            "schema_text": schema,
            "schema_tree": schema_tree,
            "table_count": len(schema_tree),
            "schema_profile": schema_profile,
            "suggested_questions": suggested_questions,
            "active_profile_id": profile.id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        await log_audit_event(
            db,
            action="datasource.profile.connect",
            status="error",
            user_id=current_user.id,
            resource_type="connection_profile",
            resource_id=str(profile.id),
            details={"profile_name": profile.profile_name, "db_type": profile.db_type},
            ip_address=_client_ip(request),
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/run")
async def run_query(
    body: QueryRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enforce_rate_limit(request, f"query-run:{current_user.id}", settings.QUERY_RATE_LIMIT_PER_MINUTE, 60)

    uid = str(current_user.id)
    engine = _engines.get(uid)
    schema = _schemas.get(uid)

    if not engine or not schema:
        raise HTTPException(status_code=400, detail="No database connected. Please connect a database first.")
    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty.")
    if len(body.question.strip()) > settings.QUERY_MAX_TEXT_LENGTH:
        raise HTTPException(status_code=422, detail=f"Question exceeds max length of {settings.QUERY_MAX_TEXT_LENGTH} characters.")

    row_limit = _safe_row_limit(body.row_limit)
    result = await run_full_pipeline(
        engine=engine,
        schema=schema,
        question=body.question,
        db_type=_db_types.get(uid, "connected"),
        conversation_history=body.conversation_history,
        user_id=current_user.id,
        row_limit=row_limit,
    )

    await save_query(
        db=db,
        user_id=current_user.id,
        question=body.question,
        sql=result.get("sql", ""),
        was_corrected=result.get("was_corrected", False),
        execution_time_ms=result.get("execution_time_ms", 0),
        row_count=result.get("row_count", 0),
        db_type=_db_types.get(uid, "connected"),
        status="error" if "error" in result else "success",
    )
    await log_audit_event(
        db,
        action="query.run",
        status="error" if "error" in result else "success",
        user_id=current_user.id,
        resource_type="query",
        resource_id=str(_active_profile_ids.get(uid) or "manual"),
        details={"db_type": _db_types.get(uid, "connected"), "row_limit": row_limit},
        ip_address=_client_ip(request),
    )
    return result


@router.post("/execute-raw")
async def execute_raw_query(
    body: RawQueryRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enforce_rate_limit(request, f"query-raw:{current_user.id}", settings.QUERY_RATE_LIMIT_PER_MINUTE, 60)

    uid = str(current_user.id)
    engine = _engines.get(uid)
    schema = _schemas.get(uid)

    if not engine or not schema:
        raise HTTPException(status_code=400, detail="No database connected. Please connect a database first.")
    if not body.sql.strip():
        raise HTTPException(status_code=422, detail="SQL cannot be empty.")
    if len(body.sql.strip()) > 10000:
        raise HTTPException(status_code=422, detail="SQL exceeds max length of 10000 characters.")

    result = await execute_raw_sql(
        engine=engine,
        schema=schema,
        sql=body.sql,
        row_limit=_safe_row_limit(body.row_limit),
        question=body.question or "Edited SQL execution",
    )

    await save_query(
        db=db,
        user_id=current_user.id,
        question=body.question or "Edited SQL execution",
        sql=result.get("sql", body.sql),
        was_corrected=False,
        execution_time_ms=result.get("execution_time_ms", 0),
        row_count=result.get("row_count", 0),
        db_type=_db_types.get(uid, "connected"),
        status="error" if "error" in result else "success",
    )
    await log_audit_event(
        db,
        action="query.execute_raw",
        status="error" if "error" in result else "success",
        user_id=current_user.id,
        resource_type="query",
        resource_id=str(_active_profile_ids.get(uid) or "manual"),
        details={"db_type": _db_types.get(uid, "connected"), "row_limit": _safe_row_limit(body.row_limit)},
        ip_address=_client_ip(request),
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
        "active_profile_id": _active_profile_ids.get(uid),
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
    return {"previews": get_all_table_previews(engine, safe_limit), "limit": safe_limit}
