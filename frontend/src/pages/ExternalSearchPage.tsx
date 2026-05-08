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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { externalApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import type { ExternalSource, ExternalBookSearchResult } from '../types'
import BookPreviewModal from '../components/BookPreviewModal'

const SOURCE_COLORS: Record<ExternalSource, string> = {
  google_books: 'bg-blue-100 text-blue-700',
}

function ExternalSearchPage() {
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBook, setSelectedBook] = useState<ExternalBookSearchResult | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 20

  const getAvailabilityLabel = (book: ExternalBookSearchResult) => {
    if (book.canDownload) {
      return t('external.fileAvailable', {
        formats: book.downloadFormats.length ? `: ${book.downloadFormats.join(', ')}` : '',
      })
    }
    if (book.buyLink) return t('external.paidCardOnly')
    if (book.previewLink || book.webReaderLink) return t('external.previewCardOnly')
    return t('external.cardOnly')
  }

  const getImportLabel = (book: ExternalBookSearchResult) =>
    book.canDownload ? t('external.addCardWithFile') : t('external.addCard')

  const { data: sourcesData } = useQuery({
    queryKey: ['external-sources'],
    queryFn: async () => {
      const response = await externalApi.getSources()
      return response.data
    },
  })

  const {
    data: searchData,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: ['external-search', searchQuery, currentPage],
    queryFn: async () => {
      if (!searchQuery) return null
      const response = await externalApi.search({ q: searchQuery, limit, page: currentPage })
      return response.data
    },
    enabled: !!searchQuery,
  })

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
    setCurrentPage(1)
  }, [query])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
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

  const allResults: ExternalBookSearchResult[] = []
  if (searchData?.results) {
    Object.values(searchData.results).forEach((response) => allResults.push(...response.items))
  }

  const totalItems = searchData?.totalItems || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            {t('external.title')}
          </h1>
          <p className="text-gray-600 mt-1">{t('external.subtitle')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {sourcesData?.sources.map((source) => (
            <div
              key={source.id}
              className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                source.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${source.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
              {source.name}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSearch} className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('external.placeholder')}
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            {t('external.searchButton')}
          </button>
        </div>

        <div className="mt-3 text-sm text-gray-500">
          {t('external.tip')} <code className="bg-gray-100 px-1 rounded">intitle:</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">inauthor:</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">isbn:</code> {t('external.tipSuffix')}
        </div>
      </form>

      {searchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">{t('external.searchFailed')}</h3>
            <p className="text-red-600 text-sm">{getErrorMessage(searchError)}</p>
          </div>
        </div>
      )}

      {searchData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-600">
              {t('external.found', {
                count: searchData.totalItems.toLocaleString(),
                time: searchData.totalSearchTimeMs,
              })}
            </p>
          </div>

          {allResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allResults.map((book) => (
                <ExternalBookCard
                  key={`${book.source}-${book.externalId}`}
                  book={book}
                  onViewDetails={() => handleBookClick(book)}
                  onImport={() => handleImport(book)}
                  isImporting={importMutation.isPending && importMutation.variables?.externalId === book.externalId}
                  getAvailabilityLabel={getAvailabilityLabel}
                  getImportLabel={getImportLabel}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">{t('external.noResults', { query: searchQuery })}</p>
              <p className="text-gray-500 text-sm mt-1">{t('external.tryDifferent')}</p>
            </div>
          )}

          {totalItems > limit && (
            <Pagination currentPage={currentPage} totalItems={totalItems} limit={limit} onPageChange={handlePageChange} />
          )}
        </div>
      )}

      {!searchQuery && !searchData && (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-700 mb-2">{t('external.initialTitle')}</h2>
          <p className="text-gray-500 max-w-md mx-auto">{t('external.initialText')}</p>
        </div>
      )}

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

interface ExternalBookCardProps {
  book: ExternalBookSearchResult
  onViewDetails: () => void
  onImport: () => void
  isImporting: boolean
  getAvailabilityLabel: (book: ExternalBookSearchResult) => string
  getImportLabel: (book: ExternalBookSearchResult) => string
}

function ExternalBookCard({
  book,
  onViewDetails,
  onImport,
  isImporting,
  getAvailabilityLabel,
  getImportLabel,
}: ExternalBookCardProps) {
  const { t } = useLanguage()

  return (
    <div className="bg-white rounded-lg border hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="w-20 h-28 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
          {book.thumbnailUrl ? (
            <img src={book.thumbnailUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-gray-300" />
            </div>
          )}
        </div>

        <div className="flex-grow min-w-0">
          <h3 className="font-medium text-gray-900 line-clamp-2 cursor-pointer hover:text-blue-600" onClick={onViewDetails}>
            {book.title}
          </h3>

          {book.authors.length > 0 && <p className="text-sm text-gray-600 mt-1 truncate">{book.authors.join(', ')}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs ${SOURCE_COLORS[book.source]}`}>
              {t('common.googleBooks')}
            </span>

            {book.averageRating && (
              <span className="flex items-center gap-1 text-xs text-yellow-600">
                <Star className="h-3 w-3 fill-current" />
                {book.averageRating.toFixed(1)}
              </span>
            )}

            {book.publishedDate && <span className="text-xs text-gray-500">{book.publishedDate.substring(0, 4)}</span>}

            <span className={`px-2 py-0.5 rounded text-xs ${book.canDownload ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {getAvailabilityLabel(book)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
        <button onClick={onViewDetails} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <ExternalLink className="h-4 w-4" />
          {t('external.details')}
        </button>

        {book.isImported ? (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" />
            {t('common.imported')}
          </span>
        ) : (
          <button
            onClick={onImport}
            disabled={isImporting}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isImporting ? t('external.importing') : getImportLabel(book)}
          </button>
        )}
      </div>
    </div>
  )
}

interface PaginationProps {
  currentPage: number
  totalItems: number
  limit: number
  onPageChange: (page: number) => void
}

function Pagination({ currentPage, totalItems, limit, onPageChange }: PaginationProps) {
  const { t } = useLanguage()
  const totalPages = Math.ceil(totalItems / limit)
  const pages: (number | 'ellipsis')[] = []
  const maxVisible = 7

  if (totalPages <= maxVisible) {
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

  return (
    <nav className="flex items-center justify-center gap-1 py-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={t('library.previousPage')}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                page === currentPage ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50 text-gray-700'
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={t('library.nextPage')}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </nav>
  )
}

export default ExternalSearchPage
