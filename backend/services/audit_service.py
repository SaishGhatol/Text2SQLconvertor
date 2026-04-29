import json

from sqlalchemy.ext.asyncio import AsyncSession

from models.audit_log import AuditLog


async def log_audit_event(
    db: AsyncSession,
    action: str,
    status: str = "success",
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
):
    record = AuditLog(
        user_id=user_id,
        action=action,
        status=status,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details or {}, ensure_ascii=True),
        ip_address=ip_address,
    )
    db.add(record)
    await db.commit()
    return record
