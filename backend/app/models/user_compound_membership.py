from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class UserCompoundMembership(Base):
    """Tracks compounds a resident is verified for (multi-neighbourhood access)."""

    __tablename__ = "user_compound_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "compound_id", name="uq_user_compound_membership"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    compound_id = Column(Integer, ForeignKey("compounds.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="compound_memberships")
    compound = relationship("Compound")
