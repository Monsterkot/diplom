import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchApi, getErrorMessage } from '../services/api'
import type { SearchHit, SearchFacets, FullSearchResponse } from '../types'
import SearchFilters from '../components/SearchFilters'
import SearchBar from '../components/SearchBar'

// Format file size
const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return 'Неизвестно'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Get file type label
const getFileTypeLabel = (contentType: string | null): string => {
  if (!contentType) return 'Файл'
  if (contentType.includes('pdf')) return 'PDF'
  if (contentType.includes('epub')) return 'EPUB'
  if (contentType.includes('text')) return 'TXT'
  return 'Файл'
}

// Render highlighted text safely
const HighlightedText = ({ html, fallback }: { html: string | null; fallback: string }) => {
  if (!html) return <>{fallback}</>
  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className="search-highlight"
    />
  )
}

// Search result card component
const SearchResultCard = ({ hit, onClick }: { hit: SearchHit; onClick: () => void }) => {
  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex gap-4">
        {/* Cover image */}
        <div className="flex-shrink-0">
          {hit.coverUrl ? (
            <img
              src={hit.coverUrl}
              alt={hit.title}
              className="w-20 h-28 object-cover rounded"
            />
          ) : (
            <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            <HighlightedText html={hit.titleHighlighted} fallback={hit.title} />
          </h3>

          {/* Author */}
          {hit.author && (
            <p className="text-sm text-gray-600 mb-2">
              <HighlightedText html={hit.authorHighlighted} fallback={hit.author} />
            </p>
          )}

          {/* Description or content snippet */}
          {(hit.descriptionHighlighted || hit.contentSnippet || hit.description) && (
            <p className="text-sm text-gray-500 mb-3 line-clamp-2">
              <HighlightedText
                html={hit.contentSnippet || hit.descriptionHighlighted}
                fallback={hit.description || ''}
              />
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-2 text-xs">
            {hit.category && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {hit.category}
              </span>
            )}
            {hit.language && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                {hit.language.toUpperCase()}
              </span>
            )}
            {hit.contentType && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {getFileTypeLabel(hit.contentType)}
              </span>
            )}
            {hit.publishedYear && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                {hit.publishedYear}
              </span>
            )}
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {formatFileSize(hit.fileSize)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Pagination component
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) => {
  const pages = useMemo(() => {
    const result: (number | string)[] = []
    const showPages = 5
    const halfShow = Math.floor(showPages / 2)

    let startPage = Math.max(1, currentPage - halfShow)
    let endPage = Math.min(totalPages, currentPage + halfShow)

    if (currentPage <= halfShow) {
      endPage = Math.min(totalPages, showPages)
    }
    if (currentPage > totalPages - halfShow) {
      startPage = Math.max(1, totalPages - showPages + 1)
    }

    if (startPage > 1) {
      result.push(1)
      if (startPage > 2) result.push('...')
    }

    for (let i = startPage; i <= endPage; i++) {
      result.push(i)
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) result.push('...')
      result.push(totalPages)
    }

    return result
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <nav className="flex justify-center items-center gap-1 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        &larr;
      </button>

      {pages.map((page, index) =>
        typeof page === 'string' ? (
          <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
            {page}
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-2 rounded border ${
              page === currentPage
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        &rarr;
      </button>
    </nav>
  )
}

// Sort options
const SORT_OPTIONS = [
  { value: '', label: 'По релевантности' },
  { value: 'published_year:desc', label: 'Год (новые)' },
  { value: 'published_year:asc', label: 'Год (старые)' },
  { value: 'title:asc', label: 'Название (А-Я)' },
  { value: 'title:desc', label: 'Название (Я-А)' },
]

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // State
  const [results, setResults] = useState<FullSearchResponse | null>(null)
  const [facets, setFacets] = useState<SearchFacets>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get current search params
  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const category = searchParams.get('category') || undefined
  const author = searchParams.get('author') || undefined
  const language = searchParams.get('language') || undefined
  const contentType = searchParams.get('type') || undefined
  const yearFrom = searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom')!, 10) : undefined
  const yearTo = searchParams.get('yearTo') ? parseInt(searchParams.get('yearTo')!, 10) : undefined
  const sort = searchParams.get('sort') || ''

  // Perform search
  const performSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await searchApi.search({
        q: query,
        page,
        limit: 20,
        category,
        author,
        language,
        contentType,
        yearFrom,
        yearTo,
        sort: sort || undefined,
      })

      setResults(response.data)
      setFacets(response.data.facets)
    } catch (err) {
      setError(getErrorMessage(err))
      setResults(null)
    } finally {
      setIsLoading(false)
    }
  }, [query, page, category, author, language, contentType, yearFrom, yearTo, sort])

  // Search on params change
  useEffect(() => {
    performSearch()
  }, [performSearch])

  // Update search params
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const newParams = new URLSearchParams(searchParams)

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value)
        } else {
          newParams.delete(key)
        }
      })

      // Reset to page 1 when filters change (except for page changes)
      if (!('page' in updates)) {
        newParams.set('page', '1')
      }

      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
  )

  // Handle search submit
  const handleSearch = (newQuery: string) => {
    updateParams({ q: newQuery, page: undefined })
  }

  // Handle filter change
  const handleFilterChange = (filterType: string, value: string | undefined) => {
    updateParams({ [filterType]: value })
  }

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    updateParams({ sort: newSort || undefined })
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    updateParams({ page: String(newPage) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle result click
  const handleResultClick = (hit: SearchHit) => {
    navigate(`/reader/${hit.id}`)
  }

  // Active filters
  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string; value: string }[] = []
    if (category) filters.push({ type: 'category', label: 'Категория', value: category })
    if (author) filters.push({ type: 'author', label: 'Автор', value: author })
    if (language) filters.push({ type: 'language', label: 'Язык', value: language })
    if (contentType) filters.push({ type: 'type', label: 'Тип', value: contentType })
    if (yearFrom) filters.push({ type: 'yearFrom', label: 'Год от', value: String(yearFrom) })
    if (yearTo) filters.push({ type: 'yearTo', label: 'Год до', value: String(yearTo) })
    return filters
  }, [category, author, language, contentType, yearFrom, yearTo])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <SearchBar
            initialValue={query}
            onSearch={handleSearch}
            placeholder="Поиск книг..."
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <SearchFilters
              facets={facets}
              activeFilters={{
                category,
                author,
                language,
                contentType,
                yearFrom,
                yearTo,
              }}
              onFilterChange={handleFilterChange}
            />
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                {query && (
                  <h1 className="text-xl font-semibold text-gray-900">
                    Результаты поиска: "{query}"
                  </h1>
                )}
                {results && (
                  <p className="text-sm text-gray-500 mt-1">
                    Найдено {results.totalHits} книг
                    {results.processingTimeMs > 0 && (
                      <span className="ml-2">({results.processingTimeMs} мс)</span>
                    )}
                  </p>
                )}
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Сортировка:</label>
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filters */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {activeFilters.map((filter) => (
                  <span
                    key={filter.type}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    <span className="text-blue-500">{filter.label}:</span>
                    {filter.value}
                    <button
                      onClick={() => handleFilterChange(filter.type, undefined)}
                      className="ml-1 hover:text-blue-900"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => {
                    const newParams = new URLSearchParams()
                    newParams.set('q', query)
                    setSearchParams(newParams)
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Сбросить все
                </button>
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Ошибка поиска</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Empty query state */}
            {!query && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg">Введите поисковый запрос</p>
                <p className="text-sm mt-1">Используйте строку поиска выше для поиска книг</p>
              </div>
            )}

            {/* No results state */}
            {query && !isLoading && results && results.hits.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg">Ничего не найдено</p>
                <p className="text-sm mt-1">Попробуйте изменить запрос или убрать фильтры</p>
              </div>
            )}

            {/* Results list */}
            {results && results.hits.length > 0 && (
              <div className="space-y-4">
                {results.hits.map((hit) => (
                  <SearchResultCard
                    key={hit.id}
                    hit={hit}
                    onClick={() => handleResultClick(hit)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {results && results.totalPages > 1 && (
              <Pagination
                currentPage={results.page}
                totalPages={results.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </main>
        </div>
      </div>

      {/* CSS for highlighting */}
      <style>{`
        .search-highlight mark {
          background-color: #fef08a;
          color: inherit;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  )
}

export default SearchResultsPage
