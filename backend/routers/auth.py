from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
from core.database import get_db
from services.auth_service import create_user, authenticate_user

router = APIRouter()


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=4)
    email: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


@router.post("/signup", status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, body.username, body.password, body.email)
    return {"message": "Account created", "username": user.username}


@router.post("/token", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    from services.auth_service import get_user_by_username
    token = await authenticate_user(db, form.username, form.password)
    user = await get_user_by_username(db, form.username)
    return TokenResponse(access_token=token, username=user.username, role=user.role)


@router.get("/me")
async def me():
    return {"message": "Authenticated"}