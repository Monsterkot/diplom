"""Add book visibility

Revision ID: 20260421_005
Revises: 20260421_004
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260421_005"
down_revision: Union[str, None] = "20260421_004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "books",
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"),
    )
    op.create_index(op.f("ix_books_visibility"), "books", ["visibility"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_books_visibility"), table_name="books")
    op.drop_column("books", "visibility")
