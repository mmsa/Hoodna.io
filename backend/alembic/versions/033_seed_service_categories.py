"""seed service categories

Revision ID: 033
Revises: 032
Create Date: 2026-07-17
"""

from alembic import op


revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO service_categories
            (name, description, icon, display_order, is_active)
        SELECT seed.name, seed.description, seed.icon, seed.display_order, TRUE
        FROM (VALUES
            ('Plumbing', 'Plumbing services and repairs', '🔧', 1, TRUE),
            ('Electrical', 'Electrical work and repairs', '⚡', 2, TRUE),
            ('Cleaning', 'House cleaning and maintenance', '🧹', 3, TRUE),
            ('Painting', 'Interior and exterior painting', '🎨', 4, TRUE),
            ('Carpentry', 'Woodwork and furniture', '🪚', 5, TRUE),
            ('AC & HVAC', 'Air conditioning and heating', '❄️', 6, TRUE),
            ('Landscaping', 'Garden and landscaping services', '🌳', 7, TRUE),
            ('Security', 'Security systems and services', '🔒', 8, TRUE),
            ('Moving', 'Moving and relocation services', '📦', 9, TRUE),
            ('Catering', 'Food and catering services', '🍽️', 10, TRUE),
            ('Photography', 'Photography and videography', '📸', 11, TRUE),
            ('Tutoring', 'Education and tutoring', '📚', 12, TRUE),
            ('Pet Care', 'Pet sitting and grooming', '🐾', 13, TRUE),
            ('Beauty & Salon', 'Hair, beauty, and salon services', '💇', 14, TRUE),
            ('Fitness & Training', 'Personal training and fitness', '💪', 15, TRUE),
            ('IT & Tech Support', 'Computer and tech support', '💻', 16, TRUE),
            ('Legal Services', 'Legal consultation and services', '⚖️', 17, TRUE),
            ('Accounting', 'Accounting and financial services', '💰', 18, TRUE),
            ('Personal Services', 'Personal care and grooming services', '💆', 19, TRUE),
            ('Laundry Services', 'Laundry, dry cleaning, and ironing services', '👔', 20, TRUE),
            ('Other', 'Other services', '🔧', 99, TRUE)
        ) AS seed(name, description, icon, display_order, is_active)
        WHERE NOT EXISTS (
            SELECT 1
            FROM service_categories existing
            WHERE existing.name = seed.name
        )
        """
    )


def downgrade() -> None:
    # Keep reference rows because provider profiles may already reference them.
    pass
