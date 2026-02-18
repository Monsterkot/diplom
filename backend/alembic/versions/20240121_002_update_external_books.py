"""Update external_books table with new fields

Revision ID: 20240121_002
Revises: 20240120_001
Create Date: 2024-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '20240121_002'
down_revision: Union[str, None] = '20240120_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old indexes
    op.drop_index('ix_external_books_source_external_id', table_name='external_books')
    op.drop_index('ix_external_books_title_author', table_name='external_books')

    # Rename author to authors and change type to ARRAY
    op.drop_column('external_books', 'author')
    op.add_column('external_books', sa.Column('authors', postgresql.ARRAY(sa.String(255)), nullable=True))

    # Add new columns
    op.add_column('external_books', sa.Column('published_date', sa.String(50), nullable=True))
    op.add_column('external_books', sa.Column('categories', postgresql.ARRAY(sa.String(100)), nullable=True))
    op.add_column('external_books', sa.Column('isbn_10', sa.String(20), nullable=True))
    op.add_column('external_books', sa.Column('isbn_13', sa.String(20), nullable=True))
    op.add_column('external_books', sa.Column('publisher', sa.String(255), nullable=True))
    op.add_column('external_books', sa.Column('page_count', sa.Integer(), nullable=True))
    op.add_column('external_books', sa.Column('average_rating', sa.Float(), nullable=True))
    op.add_column('external_books', sa.Column('ratings_count', sa.Integer(), nullable=True))
    op.add_column('external_books', sa.Column('preview_link', sa.String(1000), nullable=True))
    op.add_column('external_books', sa.Column('info_link', sa.String(1000), nullable=True))
    op.add_column('external_books', sa.Column('is_imported', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('external_books', sa.Column('imported_book_id', sa.Integer(), nullable=True))
    op.add_column('external_books', sa.Column('imported_by_id', sa.Integer(), nullable=True))
    op.add_column('external_books', sa.Column('imported_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('external_books', sa.Column('last_fetched_at', sa.DateTime(timezone=True), nullable=True))

    # Rename read_url to download_url if exists, or just ensure download_url exists
    # First check if read_url exists
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [c['name'] for c in inspector.get_columns('external_books')]

    if 'read_url' in columns:
        op.drop_column('external_books', 'read_url')

    if 'download_url' not in columns:
        op.add_column('external_books', sa.Column('download_url', sa.String(1000), nullable=True))

    # Add foreign keys
    op.create_foreign_key(
        'fk_external_books_imported_book_id',
        'external_books', 'books',
        ['imported_book_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_external_books_imported_by_id',
        'external_books', 'users',
        ['imported_by_id'], ['id'],
        ondelete='SET NULL'
    )

    # Create new indexes
    op.create_index('ix_external_books_source_external_id', 'external_books', ['source', 'external_id'], unique=True)
    op.create_index('ix_external_books_title', 'external_books', ['title'])
    op.create_index('ix_external_books_isbn', 'external_books', ['isbn_10', 'isbn_13'])


def downgrade() -> None:
    # Drop new indexes
    op.drop_index('ix_external_books_isbn', table_name='external_books')
    op.drop_index('ix_external_books_title', table_name='external_books')
    op.drop_index('ix_external_books_source_external_id', table_name='external_books')

    # Drop foreign keys
    op.drop_constraint('fk_external_books_imported_by_id', 'external_books', type_='foreignkey')
    op.drop_constraint('fk_external_books_imported_book_id', 'external_books', type_='foreignkey')

    # Remove new columns
    op.drop_column('external_books', 'last_fetched_at')
    op.drop_column('external_books', 'imported_at')
    op.drop_column('external_books', 'imported_by_id')
    op.drop_column('external_books', 'imported_book_id')
    op.drop_column('external_books', 'is_imported')
    op.drop_column('external_books', 'info_link')
    op.drop_column('external_books', 'preview_link')
    op.drop_column('external_books', 'ratings_count')
    op.drop_column('external_books', 'average_rating')
    op.drop_column('external_books', 'page_count')
    op.drop_column('external_books', 'publisher')
    op.drop_column('external_books', 'isbn_13')
    op.drop_column('external_books', 'isbn_10')
    op.drop_column('external_books', 'categories')
    op.drop_column('external_books', 'published_date')

    # Revert authors back to author
    op.drop_column('external_books', 'authors')
    op.add_column('external_books', sa.Column('author', sa.String(255), nullable=True))

    # Add back read_url
    op.add_column('external_books', sa.Column('read_url', sa.String(1000), nullable=True))

    # Recreate old indexes
    op.create_index('ix_external_books_title_author', 'external_books', ['title', 'author'])
    op.create_index('ix_external_books_source_external_id', 'external_books', ['source', 'external_id'], unique=True)
