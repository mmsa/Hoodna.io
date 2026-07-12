"""Import every ORM model so ``Base.metadata`` is complete.

Import this module anywhere complete SQLAlchemy metadata is required, such as
Alembic autogeneration and metadata-focused tests.
"""

from app.models import (  # noqa: F401
    business,
    compound,
    compound_moderator,
    digest,
    feature_flag,
    launch_accounts,
    listing,
    message,
    moderation,
    notification,
    post,
    report,
    review,
    saved_listing,
    saved_post,
    service_category,
    service_provider,
    telemetry,
    user,
    user_compound_membership,
    verification,
)
