"""Device push tokens.

One row per device, not per user: a neighbour may use a phone and a tablet, and
both should receive alerts. The token is the natural key — Expo reissues the same
token for a reinstall on the same device, so registration is an upsert on `token`
rather than an insert, which stops the table growing on every app launch.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class PushToken(Base):
    __tablename__ = "push_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Expo push token, e.g. "ExponentPushToken[xxxxxxxx]".
    token = Column(String(255), nullable=False, unique=True, index=True)
    platform = Column(String(16), nullable=True)
    device_name = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Refreshed on every registration so stale devices can be pruned later.
    last_seen_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", back_populates="push_tokens")
