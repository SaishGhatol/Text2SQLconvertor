from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from core.security import get_current_user
from services.ai_service import explain_sql
from models.user import User

router = APIRouter()


class ExplainRequest(BaseModel):
    question: str
    sql: str
    schema_text: str   # renamed from 'schema' to avoid BaseModel conflict


@router.post("/explain")
async def explain(body: ExplainRequest, current_user: User = Depends(get_current_user)):
    explanation = await explain_sql(body.question, body.sql, body.schema_text)
    return {"explanation": explanation}