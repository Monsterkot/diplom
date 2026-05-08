import { ChevronLeft, ChevronRight, BookOpen, Loader2 } from 'lucide-react'
import BookCard from './BookCard'
import { useLanguage } from '../contexts/LanguageContext'
import type { Book, ViewMode } from '../types'

interface BookListProps {
  books: Book[]
  total: number
  skip: number
  limit: number
  viewMode?: ViewMode
  isLoading?: boolean
  error?: string | null
  onPageChange: (skip: number) => void
  onDeleteBook?: (bookId: number) => Promise<void>
  onEditBook?: (book: Book) => void
  deletingBookId?: number | null
}

function BookList({
  books,
  total,
  skip,
  limit,
  viewMode = 'grid',
  isLoading = false,
  error = null,
  onPageChange,
  onDeleteBook,
  onEditBook,
  deletingBookId,
}: BookListProps) {
  const { t } = useLanguage()
  const currentPage = Math.floor(skip / limit) + 1
  const totalPages = Math.ceil(total / limit)
  const hasMore = skip + books.length < total
  const hasPrevious = skip > 0

  const goToPage = (page: number) => {
    onPageChange((page - 1) * limit)
  }

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const showPages = 5

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('ellipsis')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }

    return pages
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">{t('library.loadingBooks')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('library.loadError')}</h3>
        <p className="text-gray-600 text-center max-w-md">{error}</p>
      </div>
    )
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BookOpen className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('library.notFound')}</h3>
        <p className="text-gray-600">{t('library.tryChangeFilters')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {t('library.showing', {
            from: skip + 1,
            to: Math.min(skip + books.length, total),
            total,
          })}
        </p>
      </div>

      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
            : 'space-y-4'
        }
      >
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            viewMode={viewMode}
            onDelete={onDeleteBook}
            onEdit={onEditBook}
            isDeleting={deletingBookId === book.id}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1">
          <button
            onClick={() => hasPrevious && onPageChange(Math.max(0, skip - limit))}
            disabled={!hasPrevious}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('library.previousPage')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) =>
              page === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'border hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => hasMore && onPageChange(skip + limit)}
            disabled={!hasMore}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('library.nextPage')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </nav>
      )}
    </div>
  )
}

export default BookList
