from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import decrypt_secret, encrypt_secret
from models.connection_profile import ConnectionProfile


def serialize_connection_profile(profile: ConnectionProfile) -> dict:
    return {
        "id": profile.id,
        "profile_name": profile.profile_name,
        "db_type": profile.db_type,
        "sqlite_path": profile.sqlite_path,
        "host": profile.host,
        "port": profile.port,
        "database": profile.database_name,
        "user": profile.username,
        "is_favorite": bool(profile.is_favorite),
        "last_used_at": profile.last_used_at.isoformat() if profile.last_used_at else None,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


async def list_connection_profiles(db: AsyncSession, user_id: int) -> list[ConnectionProfile]:
    result = await db.execute(
        select(ConnectionProfile)
        .where(ConnectionProfile.user_id == user_id)
        .order_by(ConnectionProfile.is_favorite.desc(), ConnectionProfile.profile_name.asc())
    )
    return result.scalars().all()


async def get_connection_profile(db: AsyncSession, profile_id: int, user_id: int) -> ConnectionProfile | None:
    result = await db.execute(
        select(ConnectionProfile)
        .where(ConnectionProfile.id == profile_id, ConnectionProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_connection_profile(
    db: AsyncSession,
    user_id: int,
    profile_name: str,
    db_type: str,
    sqlite_path: str | None = None,
    host: str | None = None,
    port: int | None = None,
    database: str | None = None,
    user: str | None = None,
    password: str | None = None,
    is_favorite: bool = False,
) -> ConnectionProfile:
    profiles = await list_connection_profiles(db, user_id)
    if len(profiles) >= settings.MAX_CONNECTION_PROFILES_PER_USER:
        raise HTTPException(status_code=400, detail="Maximum saved connection profiles reached.")

    duplicate = next((profile for profile in profiles if profile.profile_name.lower() == profile_name.lower()), None)
    if duplicate:
        raise HTTPException(status_code=400, detail="A connection profile with this name already exists.")

    profile = ConnectionProfile(
        user_id=user_id,
        profile_name=profile_name.strip(),
        db_type=db_type.strip(),
        sqlite_path=sqlite_path,
        host=host,
        port=port,
        database_name=database,
        username=user,
        encrypted_password=encrypt_secret(password),
        is_favorite=is_favorite,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def delete_connection_profile(db: AsyncSession, profile_id: int, user_id: int) -> bool:
    profile = await get_connection_profile(db, profile_id, user_id)
    if not profile:
        return False
    await db.execute(delete(ConnectionProfile).where(ConnectionProfile.id == profile_id, ConnectionProfile.user_id == user_id))
    await db.commit()
    return True


def build_profile_payload(profile: ConnectionProfile) -> dict:
    return {
        "db_type": profile.db_type,
        "sqlite_path": profile.sqlite_path,
        "host": profile.host,
        "port": profile.port,
        "database": profile.database_name,
        "user": profile.username,
        "password": decrypt_secret(profile.encrypted_password),
    }


async def mark_profile_used(db: AsyncSession, profile: ConnectionProfile):
    profile.last_used_at = datetime.now(timezone.utc)
    await db.commit()
