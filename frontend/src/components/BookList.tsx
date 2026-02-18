import { ChevronLeft, ChevronRight, BookOpen, Loader2 } from 'lucide-react'
import BookCard from './BookCard'
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
  deletingBookId,
}: BookListProps) {
  const currentPage = Math.floor(skip / limit) + 1
  const totalPages = Math.ceil(total / limit)
  const hasMore = skip + books.length < total
  const hasPrevious = skip > 0

  const goToPage = (page: number) => {
    const newSkip = (page - 1) * limit
    onPageChange(newSkip)
  }

  const goToNextPage = () => {
    if (hasMore) {
      onPageChange(skip + limit)
    }
  }

  const goToPreviousPage = () => {
    if (hasPrevious) {
      onPageChange(Math.max(0, skip - limit))
    }
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const showPages = 5 // Number of pages to show

    if (totalPages <= showPages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Загрузка книг...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ошибка загрузки</h3>
        <p className="text-gray-600 text-center max-w-md">{error}</p>
      </div>
    )
  }

  // Empty state
  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BookOpen className="h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Книги не найдены</h3>
        <p className="text-gray-600">Попробуйте изменить параметры поиска или фильтры</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Показано {skip + 1}-{Math.min(skip + books.length, total)} из {total} книг
        </p>
      </div>

      {/* Book grid/list */}
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
            isDeleting={deletingBookId === book.id}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-1">
          {/* Previous button */}
          <button
            onClick={goToPreviousPage}
            disabled={!hasPrevious}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Page numbers */}
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

          {/* Next button */}
          <button
            onClick={goToNextPage}
            disabled={!hasMore}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Следующая страница"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </nav>
      )}
    </div>
  )
}

export default BookList
