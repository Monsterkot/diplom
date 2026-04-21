"""Add user roles, blocked status, and book visibility status

Revision ID: 20260421_003
Revises: 20240121_002
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260421_003"
down_revision: Union[str, None] = "20240121_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
    )
    op.add_column(
        "users",
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    op.execute("UPDATE users SET role = 'admin' WHERE is_superuser = true")

    op.add_column(
        "books",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="published"),
    )
    op.create_index(op.f("ix_books_status"), "books", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_books_status"), table_name="books")
    op.drop_column("books", "status")

    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_column("users", "is_blocked")
    op.drop_column("users", "role")
