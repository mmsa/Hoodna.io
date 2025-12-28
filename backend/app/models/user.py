from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import UserRole, UserStatus


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    status = Column(SQLEnum(UserStatus), default=UserStatus.PENDING_VERIFICATION, nullable=False)
    compound_id = Column(Integer, ForeignKey("compounds.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    compound = relationship("Compound", back_populates="users")
    verification_documents = relationship(
        "VerificationDocument",
        foreign_keys="VerificationDocument.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="owner", cascade="all, delete-orphan")

