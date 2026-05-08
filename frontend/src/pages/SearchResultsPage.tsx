import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { searchApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import type { SearchHit, SearchFacets, FullSearchResponse } from '../types'
import SearchFilters from '../components/SearchFilters'
import SearchBar from '../components/SearchBar'

const formatFileSize = (bytes: number | null, unknownLabel: string): string => {
  if (!bytes) return unknownLabel
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getFileTypeLabel = (contentType: string | null, fileLabel: string): string => {
  if (!contentType) return fileLabel
  if (contentType.includes('pdf')) return 'PDF'
  if (contentType.includes('epub')) return 'EPUB'
  if (contentType.includes('text')) return 'TXT'
  return fileLabel
}

const HighlightedText = ({ html, fallback }: { html: string | null; fallback: string }) => {
  if (!html) return <>{fallback}</>
  return <span dangerouslySetInnerHTML={{ __html: html }} className="search-highlight" />
}

const SearchResultCard = ({ hit, onClick }: { hit: SearchHit; onClick: () => void }) => {
  const { t } = useLanguage()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {hit.coverUrl ? (
            <img src={hit.coverUrl} alt={hit.title} className="w-20 h-28 object-cover rounded" />
          ) : (
            <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
            <HighlightedText html={hit.titleHighlighted} fallback={hit.title} />
          </h3>

          {hit.author && (
            <p className="text-sm text-gray-600 mb-2">
              <HighlightedText html={hit.authorHighlighted} fallback={hit.author} />
            </p>
          )}

          {(hit.descriptionHighlighted || hit.contentSnippet || hit.description) && (
            <p className="text-sm text-gray-500 mb-3 line-clamp-2">
              <HighlightedText html={hit.contentSnippet || hit.descriptionHighlighted} fallback={hit.description || ''} />
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            {hit.category && <span className="px-2 py-1 bg-[#DAF3E6] text-[#016646] rounded">{hit.category}</span>}
            {hit.language && <span className="px-2 py-1 bg-green-100 text-green-700 rounded">{hit.language.toUpperCase()}</span>}
            {hit.contentType && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">{getFileTypeLabel(hit.contentType, t('search.file'))}</span>}
            {hit.publishedYear && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">{hit.publishedYear}</span>}
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">{formatFileSize(hit.fileSize, t('search.unknownSize'))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
              page === currentPage ? 'bg-[#008A5E] text-white border-[#008A5E]' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
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

const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useLanguage()

  const [results, setResults] = useState<FullSearchResponse | null>(null)
  const [facets, setFacets] = useState<SearchFacets>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const category = searchParams.get('category') || undefined
  const author = searchParams.get('author') || undefined
  const language = searchParams.get('language') || undefined
  const contentType = searchParams.get('type') || undefined
  const yearFrom = searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom')!, 10) : undefined
  const yearTo = searchParams.get('yearTo') ? parseInt(searchParams.get('yearTo')!, 10) : undefined
  const sort = searchParams.get('sort') || ''

  const sortOptions = useMemo(
    () => [
      { value: '', label: t('search.byRelevance') },
      { value: 'published_year:desc', label: t('search.yearNew') },
      { value: 'published_year:asc', label: t('search.yearOld') },
      { value: 'title:asc', label: t('search.titleAsc') },
      { value: 'title:desc', label: t('search.titleDesc') },
    ],
    [t]
  )

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

  useEffect(() => {
    performSearch()
  }, [performSearch])

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

      if (!('page' in updates)) {
        newParams.set('page', '1')
      }

      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
  )

  const handleSearch = (newQuery: string) => updateParams({ q: newQuery, page: undefined })
  const handleFilterChange = (filterType: string, value: string | undefined) => updateParams({ [filterType]: value })
  const handleSortChange = (newSort: string) => updateParams({ sort: newSort || undefined })
  const handleResultClick = (hit: SearchHit) => navigate(`/reader/${hit.id}`)

  const handlePageChange = (newPage: number) => {
    updateParams({ page: String(newPage) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeFilters = useMemo(() => {
    const filters: { type: string; label: string; value: string }[] = []
    if (category) filters.push({ type: 'category', label: t('search.category'), value: category })
    if (author) filters.push({ type: 'author', label: t('search.author'), value: author })
    if (language) filters.push({ type: 'language', label: t('search.language'), value: language })
    if (contentType) filters.push({ type: 'type', label: t('search.fileType'), value: contentType })
    if (yearFrom) filters.push({ type: 'yearFrom', label: t('search.from'), value: String(yearFrom) })
    if (yearTo) filters.push({ type: 'yearTo', label: t('search.to'), value: String(yearTo) })
    return filters
  }, [category, author, language, contentType, yearFrom, yearTo, t])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <SearchBar initialValue={query} onSearch={handleSearch} placeholder={t('search.placeholder')} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <SearchFilters
              facets={facets}
              activeFilters={{ category, author, language, contentType, yearFrom, yearTo }}
              onFilterChange={handleFilterChange}
            />
          </aside>

          <main className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                {query && <h1 className="text-xl font-semibold text-gray-900">{t('library.searchResults', { query })}</h1>}
                {results && (
                  <p className="text-sm text-gray-500 mt-1">
                    {t('library.found', { count: results.totalHits })}
                    {results.processingTimeMs > 0 && <span className="ml-2">({results.processingTimeMs} ms)</span>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">{t('search.sort')}</label>
                <select
                  value={sort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008A5E]"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {activeFilters.map((filter) => (
                  <span key={filter.type} className="inline-flex items-center gap-1 px-3 py-1 bg-[#DAF3E6] text-[#016646] rounded-full text-sm">
                    <span className="text-[#008A5E]">{filter.label}:</span>
                    {filter.value}
                    <button onClick={() => handleFilterChange(filter.type, undefined)} className="ml-1 hover:text-[#016646]">
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
                  {t('search.clearAll')}
                </button>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#008A5E]"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">{t('search.error')}</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {!query && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg">{t('search.enterQuery')}</p>
                <p className="text-sm mt-1">{t('search.enterQueryText')}</p>
              </div>
            )}

            {query && !isLoading && results && results.hits.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg">{t('library.emptySearchTitle')}</p>
                <p className="text-sm mt-1">{t('library.tryChangeFilters')}</p>
              </div>
            )}

            {results && results.hits.length > 0 && (
              <div className="space-y-4">
                {results.hits.map((hit) => (
                  <SearchResultCard key={hit.id} hit={hit} onClick={() => handleResultClick(hit)} />
                ))}
              </div>
            )}

            {results && results.totalPages > 1 && <Pagination currentPage={results.page} totalPages={results.totalPages} onPageChange={handlePageChange} />}
          </main>
        </div>
      </div>

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
