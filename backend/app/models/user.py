from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Boolean
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
    avatar_url = Column(String(512), nullable=True)
    password_hash = Column(String, nullable=False)
    profile_setup_required = Column(Boolean, nullable=False, default=False, server_default="false")
    role = Column(SQLEnum(UserRole), nullable=True)  # Can be null until user selects role
    status = Column(SQLEnum(UserStatus), default=UserStatus.PENDING_VERIFICATION, nullable=False)
    compound_id = Column(Integer, ForeignKey("compounds.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    compound = relationship("Compound", back_populates="users", foreign_keys=[compound_id])
    verification_documents = relationship(
        "VerificationDocument",
        foreign_keys="VerificationDocument.user_id",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="owner", cascade="all, delete-orphan")
    saved_listings = relationship("SavedListing", back_populates="user", cascade="all, delete-orphan")
    saved_posts = relationship("SavedPost", back_populates="user", cascade="all, delete-orphan")
    conversations_as_user1 = relationship("Conversation", foreign_keys="Conversation.user1_id", back_populates="user1", cascade="all, delete-orphan")
    conversations_as_user2 = relationship("Conversation", foreign_keys="Conversation.user2_id", back_populates="user2", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="reviewer", cascade="all, delete-orphan")
    service_provider_profile = relationship(
        "ServiceProviderProfile", 
        foreign_keys="ServiceProviderProfile.user_id",
        back_populates="user", 
        uselist=False, 
        cascade="all, delete-orphan"
    )
    moderator_profile = relationship(
        "CompoundModeratorProfile", 
        foreign_keys="CompoundModeratorProfile.user_id",
        back_populates="user", 
        uselist=False, 
        cascade="all, delete-orphan"
    )
    compound_memberships = relationship(
        "UserCompoundMembership",
        back_populates="user",
        cascade="all, delete-orphan",
    )

