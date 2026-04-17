from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from models.history import QueryHistory
from core.config import settings


async def save_query(db: AsyncSession, user_id: int, question: str, sql: str,
                     was_corrected: bool, execution_time_ms: float,
                     row_count: int, db_type: str, status: str = "success"):
    record = QueryHistory(
        user_id=user_id, question=question, generated_sql=sql,
        was_corrected=int(was_corrected), execution_time_ms=execution_time_ms,
        row_count=row_count, db_type=db_type, status=status,
    )
    db.add(record)
    await db.commit()
    return record


async def get_history(db: AsyncSession, user_id: int, limit: int = 20) -> list:
    result = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.user_id == user_id)
        .order_by(QueryHistory.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def get_analytics_summary(db: AsyncSession, user_id: int) -> dict:
    total_q = await db.execute(
        select(func.count()).select_from(QueryHistory).where(QueryHistory.user_id == user_id)
    )
    success_q = await db.execute(
        select(func.count()).select_from(QueryHistory)
        .where(QueryHistory.user_id == user_id, QueryHistory.status == "success")
    )
    avg_time = await db.execute(
        select(func.avg(QueryHistory.execution_time_ms))
        .where(QueryHistory.user_id == user_id)
    )
    corrected_q = await db.execute(
        select(func.count()).select_from(QueryHistory)
        .where(QueryHistory.user_id == user_id, QueryHistory.was_corrected == 1)
    )
    recent_records = await db.execute(
        select(QueryHistory)
        .where(QueryHistory.user_id == user_id)
        .order_by(desc(QueryHistory.created_at))
        .limit(8)
    )
    recent = recent_records.scalars().all()

    status_breakdown = {"success": 0, "error": 0}
    db_breakdown: dict[str, int] = {}
    for item in recent:
        status_breakdown[item.status] = status_breakdown.get(item.status, 0) + 1
        key = item.db_type or "unknown"
        db_breakdown[key] = db_breakdown.get(key, 0) + 1

    return {
        "total_queries": total_q.scalar() or 0,
        "successful_queries": success_q.scalar() or 0,
        "avg_execution_ms": round(avg_time.scalar() or 0, 2),
        "auto_corrected": corrected_q.scalar() or 0,
        "recent_activity": [
            {
                "question": item.question,
                "status": item.status,
                "execution_time_ms": item.execution_time_ms or 0,
                "row_count": item.row_count or 0,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in recent
        ],
        "status_breakdown": status_breakdown,
        "db_breakdown": db_breakdown,
    }
