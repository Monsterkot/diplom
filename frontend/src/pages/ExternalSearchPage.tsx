import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Loader2,
  BookOpen,
  Star,
  ExternalLink,
  Download,
  Check,
  AlertCircle,
  Globe,
  Library,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { externalApi, getErrorMessage } from '../services/api'
import type {
  ExternalSource,
  ExternalBookSearchResult,
  MultiSourceSearchResponse,
} from '../types'
import BookPreviewModal from '../components/BookPreviewModal'

const SOURCE_LABELS: Record<ExternalSource, string> = {
  google_books: 'Google Books',
  open_library: 'Open Library',
}

const SOURCE_COLORS: Record<ExternalSource, string> = {
  google_books: 'bg-blue-100 text-blue-700',
  open_library: 'bg-green-100 text-green-700',
}

function ExternalSearchPage() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<ExternalSource | 'all'>('all')
  const [selectedBook, setSelectedBook] = useState<ExternalBookSearchResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  // Fetch available sources
  const { data: sourcesData } = useQuery({
    queryKey: ['external-sources'],
    queryFn: async () => {
      const response = await externalApi.getSources()
      return response.data
    },
  })

  // Search query
  const {
    data: searchData,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: ['external-search', searchQuery, selectedSource, currentPage],
    queryFn: async () => {
      if (!searchQuery) return null
      const response = await externalApi.search({
        q: searchQuery,
        source: selectedSource === 'all' ? undefined : selectedSource,
        limit,
        page: currentPage,
      })
      return response.data
    },
    enabled: !!searchQuery,
  })

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (book: ExternalBookSearchResult) => {
      const response = await externalApi.importBook({
        source: book.source,
        externalId: book.externalId,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-search'] })
    },
  })

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(query.trim())
    setCurrentPage(1) // Reset to first page on new search
  }, [query])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBookClick = (book: ExternalBookSearchResult) => {
    setSelectedBook(book)
    setIsModalOpen(true)
  }

  const handleImport = async (book: ExternalBookSearchResult) => {
    try {
      await importMutation.mutateAsync(book)
    } catch (error) {
      console.error('Import failed:', error)
    }
  }

  // Flatten results from all sources
  const allResults: ExternalBookSearchResult[] = []
  if (searchData?.results) {
    Object.values(searchData.results).forEach((response) => {
      allResults.push(...response.items)
    })
  }

  // Use totalItems from backend for pagination
  const totalItems = searchData?.totalItems || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            External Book Search
          </h1>
          <p className="text-gray-600 mt-1">
            Search and import books from Google Books and Open Library
          </p>
        </div>

        {/* Source info */}
        <div className="flex flex-wrap gap-2">
          {sourcesData?.sources.map((source) => (
            <div
              key={source.id}
              className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                source.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  source.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                }`}
              />
              {source.name}
            </div>
          ))}
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for books by title, author, or ISBN..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as ExternalSource | 'all')}
              className="px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Sources</option>
              <option value="google_books">Google Books</option>
              <option value="open_library">Open Library</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}
            Search
          </button>
        </div>

        {/* Search tips */}
        <div className="mt-3 text-sm text-gray-500">
          Tip: Use <code className="bg-gray-100 px-1 rounded">intitle:</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">inauthor:</code>, or{' '}
          <code className="bg-gray-100 px-1 rounded">isbn:</code> for specific searches
        </div>
      </form>

      {/* Error State */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Search failed</h3>
            <p className="text-red-600 text-sm">{getErrorMessage(searchError)}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {searchData && (
        <div className="space-y-4">
          {/* Results summary */}
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              Found <span className="font-semibold">{searchData.totalItems.toLocaleString()}</span> results
              {' '}in {searchData.totalSearchTimeMs}ms
            </p>
          </div>

          {/* Results grid */}
          {allResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allResults.map((book) => (
                <ExternalBookCard
                  key={`${book.source}-${book.externalId}`}
                  book={book}
                  onViewDetails={() => handleBookClick(book)}
                  onImport={() => handleImport(book)}
                  isImporting={
                    importMutation.isPending &&
                    importMutation.variables?.externalId === book.externalId
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No results found for "{searchQuery}"</p>
              <p className="text-gray-500 text-sm mt-1">Try different keywords or check your spelling</p>
            </div>
          )}

          {/* Pagination */}
          {totalItems > limit && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              limit={limit}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}

      {/* Initial State */}
      {!searchQuery && !searchData && (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-700 mb-2">Search External Libraries</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter a search term above to find books from Google Books and Open Library.
            You can import them to your local library for offline access.
          </p>
        </div>
      )}

      {/* Book Preview Modal */}
      {selectedBook && (
        <BookPreviewModal
          book={selectedBook}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedBook(null)
          }}
          onImport={() => handleImport(selectedBook)}
          isImporting={importMutation.isPending}
        />
      )}
    </div>
  )
}

// External Book Card Component
interface ExternalBookCardProps {
  book: ExternalBookSearchResult
  onViewDetails: () => void
  onImport: () => void
  isImporting: boolean
}

function ExternalBookCard({ book, onViewDetails, onImport, isImporting }: ExternalBookCardProps) {
  return (
    <div className="bg-white rounded-lg border hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-28 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
          {book.thumbnailUrl ? (
            <img
              src={book.thumbnailUrl}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-gray-300" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-grow min-w-0">
          <h3
            className="font-medium text-gray-900 line-clamp-2 cursor-pointer hover:text-blue-600"
            onClick={onViewDetails}
          >
            {book.title}
          </h3>

          {book.authors.length > 0 && (
            <p className="text-sm text-gray-600 mt-1 truncate">
              {book.authors.join(', ')}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs ${SOURCE_COLORS[book.source]}`}>
              {SOURCE_LABELS[book.source]}
            </span>

            {book.averageRating && (
              <span className="flex items-center gap-1 text-xs text-yellow-600">
                <Star className="h-3 w-3 fill-current" />
                {book.averageRating.toFixed(1)}
              </span>
            )}

            {book.publishedDate && (
              <span className="text-xs text-gray-500">
                {book.publishedDate.substring(0, 4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
        <button
          onClick={onViewDetails}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <ExternalLink className="h-4 w-4" />
          Details
        </button>

        {book.isImported ? (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" />
            Imported
          </span>
        ) : (
          <button
            onClick={onImport}
            disabled={isImporting}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        )}
      </div>
    </div>
  )
}

// Pagination Component
interface PaginationProps {
  currentPage: number
  totalItems: number
  limit: number
  onPageChange: (page: number) => void
}

function Pagination({ currentPage, totalItems, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / limit)
  
  // Generate page numbers to display
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisible = 7 // Max pages to show including ellipses
    
    if (totalPages <= maxVisible) {
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
  
  const pages = getPageNumbers()
  
  return (
    <nav className="flex items-center justify-center gap-1 py-4">
      {/* Previous button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Предыдущая страница"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      
      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
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
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Следующая страница"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </nav>
  )
}

export default ExternalSearchPage
