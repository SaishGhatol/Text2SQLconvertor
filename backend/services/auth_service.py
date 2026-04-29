import re

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token, hash_password, verify_password
from models.user import User


USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]{3,40}$")


def _normalize_username(username: str) -> str:
    normalized = (username or "").strip()
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=422,
            detail="Username must be 3-40 characters and only contain letters, numbers, dot, underscore, or dash.",
        )
    return normalized


def _normalize_email(email: str | None) -> str | None:
    if email is None:
        return None
    normalized = email.strip().lower()
    return normalized or None


def _validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters long.")
    if password.lower() == password or password.upper() == password:
        raise HTTPException(status_code=422, detail="Password must include both uppercase and lowercase characters.")
    if not any(char.isdigit() for char in password):
        raise HTTPException(status_code=422, detail="Password must include at least one digit.")


async def get_user_by_username(db: AsyncSession, username: str):
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, username: str, password: str, email: str | None = None, role: str = "user"):
    normalized_username = _normalize_username(username)
    normalized_email = _normalize_email(email)
    _validate_password_strength(password)

    conditions = [User.username == normalized_username]
    if normalized_email:
        conditions.append(User.email == normalized_email)

    result = await db.execute(select(User).where(or_(*conditions)))
    existing = result.scalar_one_or_none()
    if existing:
        if existing.username == normalized_username:
            raise HTTPException(status_code=400, detail="Username already exists")
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str):
    normalized_username = (username or "").strip()
    user = await get_user_by_username(db, normalized_username)
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return create_access_token({"sub": user.username, "role": user.role, "uid": user.id})
