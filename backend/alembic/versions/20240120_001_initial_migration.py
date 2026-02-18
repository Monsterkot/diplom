"""Initial migration - Create all tables

Revision ID: 001
Revises:
Create Date: 2024-01-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Create users table ###
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # ### Create books table ###
    op.create_table(
        'books',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('isbn', sa.String(length=20), nullable=True),
        sa.Column('publisher', sa.String(length=255), nullable=True),
        sa.Column('published_year', sa.Integer(), nullable=True),
        sa.Column('language', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('cover_path', sa.String(length=500), nullable=True),
        sa.Column('uploaded_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_books_id'), 'books', ['id'], unique=False)
    op.create_index(op.f('ix_books_title'), 'books', ['title'], unique=False)
    op.create_index(op.f('ix_books_author'), 'books', ['author'], unique=False)
    op.create_index(op.f('ix_books_isbn'), 'books', ['isbn'], unique=True)
    op.create_index(op.f('ix_books_category'), 'books', ['category'], unique=False)
    op.create_index(op.f('ix_books_uploaded_by_id'), 'books', ['uploaded_by_id'], unique=False)
    op.create_index('ix_books_title_author', 'books', ['title', 'author'], unique=False)
    op.create_index('ix_books_created_at', 'books', ['created_at'], unique=False)

    # ### Create external_books table ###
    op.create_table(
        'external_books',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('external_id', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_url', sa.String(length=1000), nullable=True),
        sa.Column('published_year', sa.Integer(), nullable=True),
        sa.Column('language', sa.String(length=50), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('read_url', sa.String(length=1000), nullable=True),
        sa.Column('download_url', sa.String(length=1000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_external_books_id'), 'external_books', ['id'], unique=False)
    op.create_index(op.f('ix_external_books_source'), 'external_books', ['source'], unique=False)
    op.create_index(op.f('ix_external_books_external_id'), 'external_books', ['external_id'], unique=False)
    op.create_index(op.f('ix_external_books_title'), 'external_books', ['title'], unique=False)
    op.create_index(op.f('ix_external_books_author'), 'external_books', ['author'], unique=False)
    op.create_index('ix_external_books_source_external_id', 'external_books', ['source', 'external_id'], unique=True)
    op.create_index('ix_external_books_title_author', 'external_books', ['title', 'author'], unique=False)


def downgrade() -> None:
    # ### Drop external_books table ###
    op.drop_index('ix_external_books_title_author', table_name='external_books')
    op.drop_index('ix_external_books_source_external_id', table_name='external_books')
    op.drop_index(op.f('ix_external_books_author'), table_name='external_books')
    op.drop_index(op.f('ix_external_books_title'), table_name='external_books')
    op.drop_index(op.f('ix_external_books_external_id'), table_name='external_books')
    op.drop_index(op.f('ix_external_books_source'), table_name='external_books')
    op.drop_index(op.f('ix_external_books_id'), table_name='external_books')
    op.drop_table('external_books')

    # ### Drop books table ###
    op.drop_index('ix_books_created_at', table_name='books')
    op.drop_index('ix_books_title_author', table_name='books')
    op.drop_index(op.f('ix_books_uploaded_by_id'), table_name='books')
    op.drop_index(op.f('ix_books_category'), table_name='books')
    op.drop_index(op.f('ix_books_isbn'), table_name='books')
    op.drop_index(op.f('ix_books_author'), table_name='books')
    op.drop_index(op.f('ix_books_title'), table_name='books')
    op.drop_index(op.f('ix_books_id'), table_name='books')
    op.drop_table('books')

    # ### Drop users table ###
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')
