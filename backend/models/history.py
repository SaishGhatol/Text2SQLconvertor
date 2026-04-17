from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.sql import func
from core.database import Base


class QueryHistory(Base):
    __tablename__ = "query_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=False)
    was_corrected = Column(Integer, default=0)   # 0=no, 1=yes
    execution_time_ms = Column(Float, nullable=True)
    row_count = Column(Integer, nullable=True)
    db_type = Column(String(30), nullable=True)
    status = Column(String(20), default="success")  # success | error
    created_at = Column(DateTime(timezone=True), server_default=func.now())
