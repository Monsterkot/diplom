import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Grid, List, Filter, X, ChevronDown, Upload } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import BookList from '../components/BookList'
import { booksApi, searchApi, getErrorMessage } from '../services/api'
import type { Book, ViewMode, FilterState, Category } from '../types'

const ITEMS_PER_PAGE = 20

function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    category: null,
    author: null,
    language: null,
    yearFrom: null,
    yearTo: null,
  })

  // Get search query from URL
  const searchQuery = searchParams.get('q') || ''
  const skip = parseInt(searchParams.get('skip') || '0')

  // Initialize filters from URL
  useEffect(() => {
    setFilters({
      category: searchParams.get('category'),
      author: searchParams.get('author'),
      language: searchParams.get('language'),
      yearFrom: searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom')!) : null,
      yearTo: searchParams.get('yearTo') ? parseInt(searchParams.get('yearTo')!) : null,
    })
  }, [])

  // Fetch books
  const {
    data: booksData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['books', searchQuery, skip, filters],
    queryFn: async () => {
      if (searchQuery) {
        // Search mode
        const response = await searchApi.search({
          q: searchQuery,
          category: filters.category || undefined,
          author: filters.author || undefined,
          language: filters.language || undefined,
          yearFrom: filters.yearFrom || undefined,
          yearTo: filters.yearTo || undefined,
          skip,
          limit: ITEMS_PER_PAGE,
        })
        return response.data
      } else {
        // Browse mode
        const response = await booksApi.getAll({
          skip,
          limit: ITEMS_PER_PAGE,
          category: filters.category || undefined,
          author: filters.author || undefined,
          language: filters.language || undefined,
        })
        return response.data
      }
    },
  })

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await booksApi.getCategories()
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Delete book handler
  const handleDeleteBook = async (bookId: number) => {
    setDeletingBookId(bookId)
    try {
      await booksApi.delete(bookId)
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    } finally {
      setDeletingBookId(null)
    }
  }

  const books = booksData?.items || []
  const total = booksData?.total || 0

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams)

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      })

      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
  )

  const handlePageChange = (newSkip: number) => {
    updateParams({ skip: newSkip.toString() })
  }

  const handleFilterChange = (key: keyof FilterState, value: string | number | null) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    updateParams({
      [key]: value?.toString() || null,
      skip: '0', // Reset to first page on filter change
    })
  }

  const clearFilters = () => {
    setFilters({
      category: null,
      author: null,
      language: null,
      yearFrom: null,
      yearTo: null,
    })
    const newParams = new URLSearchParams()
    if (searchQuery) {
      newParams.set('q', searchQuery)
    }
    setSearchParams(newParams)
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {searchQuery ? `Результаты поиска: "${searchQuery}"` : 'Библиотека'}
          </h1>
          {total > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Найдено {total} книг
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Сетка"
            >
              <Grid className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${
                viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Список"
            >
              <List className="h-5 w-5" />
            </button>
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Фильтры</span>
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {Object.values(filters).filter((v) => v !== null).length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Фильтры</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Сбросить
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Все категории</option>
                {categories?.map((cat: Category) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Language filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Язык
              </label>
              <select
                value={filters.language || ''}
                onChange={(e) => handleFilterChange('language', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Все языки</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
              </select>
            </div>

            {/* Year from */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Год от
              </label>
              <input
                type="number"
                value={filters.yearFrom || ''}
                onChange={(e) =>
                  handleFilterChange('yearFrom', e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="1900"
                min="1000"
                max="2100"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Year to */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Год до
              </label>
              <input
                type="number"
                value={filters.yearTo || ''}
                onChange={(e) =>
                  handleFilterChange('yearTo', e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="2024"
                min="1000"
                max="2100"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Tags */}
      {hasActiveFilters && !showFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.category && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              Категория: {filters.category}
              <button onClick={() => handleFilterChange('category', null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.language && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              Язык: {filters.language}
              <button onClick={() => handleFilterChange('language', null)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(filters.yearFrom || filters.yearTo) && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              Год: {filters.yearFrom || '...'} - {filters.yearTo || '...'}
              <button
                onClick={() => {
                  handleFilterChange('yearFrom', null)
                  handleFilterChange('yearTo', null)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Books List */}
      {books.length > 0 || isLoading ? (
        <BookList
          books={books}
          total={total}
          skip={skip}
          limit={ITEMS_PER_PAGE}
          viewMode={viewMode}
          isLoading={isLoading}
          error={error ? getErrorMessage(error) : null}
          onPageChange={handlePageChange}
          onDeleteBook={handleDeleteBook}
          deletingBookId={deletingBookId}
        />
      ) : (
        <EmptyState searchQuery={searchQuery} hasFilters={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  )
}

interface EmptyStateProps {
  searchQuery: string
  hasFilters: boolean
  onClearFilters: () => void
}

function EmptyState({ searchQuery, hasFilters, onClearFilters }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg
          className="h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {searchQuery ? 'Ничего не найдено' : 'Библиотека пуста'}
      </h2>

      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {searchQuery
          ? `По запросу "${searchQuery}" ничего не найдено. Попробуйте изменить запрос${hasFilters ? ' или сбросить фильтры' : ''}.`
          : 'Загрузите свою первую книгу, чтобы начать.'}
      </p>

      <div className="flex justify-center gap-4">
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Сбросить фильтры
          </button>
        )}
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Загрузить книгу
        </Link>
      </div>
    </div>
  )
}

export default LibraryPage
