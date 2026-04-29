from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.rate_limit import enforce_rate_limit
from core.security import get_current_user
from models.user import User
from services.audit_service import log_audit_event
from services.auth_service import authenticate_user, create_user, get_user_by_username

router = APIRouter()


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=8)
    email: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/signup", status_code=201)
async def signup(body: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    enforce_rate_limit(request, "signup", settings.AUTH_RATE_LIMIT_ATTEMPTS, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS)
    user = await create_user(db, body.username, body.password, body.email)
    await log_audit_event(
        db,
        action="auth.signup",
        user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username},
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Account created", "username": user.username}


@router.post("/token", response_model=TokenResponse)
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    enforce_rate_limit(request, "login", settings.AUTH_RATE_LIMIT_ATTEMPTS, settings.AUTH_RATE_LIMIT_WINDOW_SECONDS)
    try:
        token = await authenticate_user(db, form.username, form.password)
    except Exception:
        await log_audit_event(
            db,
            action="auth.login",
            status="error",
            resource_type="user",
            details={"username": form.username.strip()},
            ip_address=request.client.host if request.client else None,
        )
        raise

    user = await get_user_by_username(db, form.username.strip())
    await log_audit_event(
        db,
        action="auth.login",
        user_id=user.id if user else None,
        resource_type="user",
        resource_id=str(user.id) if user else None,
        details={"username": form.username.strip()},
        ip_address=request.client.host if request and request.client else None,
    )
    return TokenResponse(access_token=token, username=user.username, role=user.role)


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": bool(current_user.is_active),
    }
