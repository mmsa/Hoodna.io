"""repair verification document compound_id from LLM extraction

Revision ID: 018
Revises: 017
Create Date: 2026-07-12

Re-assigns compound_id on approved documents using LLM-extracted compound names.
Fixes documents that were backfilled with the user's current compound instead of
the compound they were actually verified for (e.g. Palm Hills).
"""
from alembic import context, op
import sqlalchemy as sa


revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def _compound_name_from_llm(info) -> str | None:
    if not info or not isinstance(info, dict):
        return None
    for key in ("compound_name", "compound_name_in_address"):
        value = info.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    address = info.get("address")
    if isinstance(address, dict):
        compound = address.get("compound")
        if isinstance(compound, str) and compound.strip():
            return compound.strip()
    property_address = info.get("property_address")
    if isinstance(property_address, dict):
        compound = property_address.get("compound")
        if isinstance(compound, str) and compound.strip():
            return compound.strip()
    return None


def upgrade() -> None:
    # This repair inspects JSON values row by row and therefore cannot be
    # rendered as deterministic offline SQL.
    if context.is_offline_mode():
        return

    conn = op.get_bind()

    docs = conn.execute(
        sa.text(
            """
            SELECT id, compound_id, llm_extracted_info
            FROM verification_documents
            WHERE status = 'APPROVED'
              AND llm_extracted_info IS NOT NULL
            """
        )
    ).fetchall()

    for doc_id, current_compound_id, llm_info in docs:
        name = _compound_name_from_llm(llm_info)
        if not name:
            continue
        match = conn.execute(
            sa.text(
                """
                SELECT id FROM compounds
                WHERE name ILIKE :pattern
                ORDER BY LENGTH(name) ASC
                LIMIT 1
                """
            ),
            {"pattern": f"{name}%"},
        ).fetchone()
        if not match:
            continue
        inferred_id = match[0]
        if inferred_id != current_compound_id:
            conn.execute(
                sa.text(
                    """
                    UPDATE verification_documents
                    SET compound_id = :compound_id
                    WHERE id = :doc_id
                    """
                ),
                {"compound_id": inferred_id, "doc_id": doc_id},
            )

    # Ensure membership rows exist for repaired document compounds
    conn.execute(
        sa.text(
            """
            INSERT INTO user_compound_memberships (user_id, compound_id)
            SELECT DISTINCT vd.user_id, vd.compound_id
            FROM verification_documents vd
            JOIN users u ON u.id = vd.user_id
            WHERE vd.status = 'APPROVED'
              AND vd.compound_id IS NOT NULL
              AND u.status = 'APPROVED'
            ON CONFLICT (user_id, compound_id) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    pass
