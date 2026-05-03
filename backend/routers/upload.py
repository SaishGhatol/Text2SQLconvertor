# from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
# from core.security import get_current_user
# from models.user import User
# from routers.query import _engines, _schemas
# from services.schema_service import extract_schema
# import pandas as pd
# import sqlalchemy
# import io

# router = APIRouter()


# @router.post("/csv")
# async def upload_csv(
#     file: UploadFile = File(...),
#     table_name: str = Form("uploaded_data"),
#     current_user: User = Depends(get_current_user),
# ):
#     uid = str(current_user.id)
#     engine = _engines.get(uid)
#     if not engine:
#         raise HTTPException(status_code=400, detail="Connect a SQLite database first.")

#     content = await file.read()
#     df = pd.read_csv(io.BytesIO(content))
#     df.to_sql(table_name, engine, index=False, if_exists="replace")

#     _schemas[uid] = extract_schema(engine)
#     return {
#         "message": f"CSV imported as table '{table_name}'",
#         "rows": len(df),
#         "columns": len(df.columns),
#         "column_names": list(df.columns),
#     }




from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from core.security import get_current_user
from models.user import User
from routers.query import _engines, _schemas
from services.schema_service import extract_schema
import pandas as pd
import sqlalchemy
import io
import chardet

router = APIRouter()


@router.post("/csv")
async def upload_csv(
    file: UploadFile = File(...),
    table_name: str = Form("uploaded_data"),
    current_user: User = Depends(get_current_user),
):
    uid = str(current_user.id)
    engine = _engines.get(uid)

    if not engine:
        raise HTTPException(status_code=400, detail="Connect a SQLite database first.")

    # 🔹 Read file content
    content = await file.read()

    # 🔹 Detect encoding automatically
    detected = chardet.detect(content)
    encoding = detected["encoding"] or "utf-8"

    try:
        # 🔹 Try reading CSV
        df = pd.read_csv(io.BytesIO(content), encoding=encoding)
    except Exception:
        # 🔹 Fallback (very important)
        df = pd.read_csv(io.BytesIO(content), encoding="latin1")

    # 🔹 Save to database
    df.to_sql(table_name, engine, index=False, if_exists="replace")

    # 🔹 Update schema
    _schemas[uid] = extract_schema(engine)

    return {
        "message": f"CSV imported as table '{table_name}'",
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "encoding_used": encoding,  # useful for debugging
    }