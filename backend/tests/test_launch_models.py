import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, configure_mappers

import app.models.all  # noqa: F401
from app.db.base import Base
from app.models.moderation import AuditLog


LAUNCH_TABLES = {
    "referral_invites",
    "user_preferences",
    "account_deletion_requests",
    "independent_businesses",
    "business_claims",
    "business_memberships",
    "moderation_actions",
    "audit_logs",
    "feature_flags",
    "feature_flag_overrides",
    "analytics_events",
    "client_error_reports",
    "digest_runs",
    "digest_deliveries",
}


def test_launch_tables_are_registered_and_mappers_configure():
    configure_mappers()
    assert LAUNCH_TABLES.issubset(Base.metadata.tables)


def test_launch_uniqueness_and_delete_policies():
    metadata = Base.metadata

    assert metadata.tables["referral_invites"].c.code.unique
    assert metadata.tables["referral_invites"].c.accepted_user_id.unique
    assert metadata.tables["user_preferences"].c.user_id.unique
    assert metadata.tables["account_deletion_requests"].c.user_id.unique
    assert metadata.tables["digest_runs"].c.idempotency_key.unique

    referral_fks = {
        fk.parent.name: fk.ondelete
        for fk in metadata.tables["referral_invites"].foreign_keys
    }
    assert referral_fks == {
        "inviter_id": "SET NULL",
        "accepted_user_id": "SET NULL",
    }

    membership_fks = {
        fk.parent.name: fk.ondelete
        for fk in metadata.tables["business_memberships"].foreign_keys
    }
    assert membership_fks == {"business_id": "CASCADE", "user_id": "CASCADE"}


def test_audit_logs_reject_orm_mutation():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        audit_log = AuditLog(event_type="schema.test")
        session.add(audit_log)
        session.commit()

        audit_log.event_type = "schema.changed"
        with pytest.raises(ValueError, match="append-only"):
            session.commit()
