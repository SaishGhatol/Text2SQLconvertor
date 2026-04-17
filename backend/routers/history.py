from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user
from services.history_service import get_history, get_analytics_summary
from models.user import User

router = APIRouter()


@router.get("/")
async def history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    records = await get_history(db, current_user.id, limit)
    return [
        {
            "id": r.id,
            "question": r.question,
            "sql": r.generated_sql,
            "was_corrected": bool(r.was_corrected),
            "execution_time_ms": r.execution_time_ms,
            "row_count": r.row_count,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
