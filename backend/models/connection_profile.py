from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from core.database import Base


class ConnectionProfile(Base):
    __tablename__ = "connection_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    profile_name = Column(String(120), nullable=False)
    db_type = Column(String(30), nullable=False)
    sqlite_path = Column(String(500), nullable=True)
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    encrypted_password = Column(String(1000), nullable=True)
    is_favorite = Column(Boolean, default=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
