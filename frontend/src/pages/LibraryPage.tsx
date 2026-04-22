import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Grid, List, Filter, ChevronDown, Upload, Check, X, BookOpen, Globe, Users } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import BookList from '../components/BookList'
import EditBookModal from '../components/EditBookModal'
import { booksApi, searchApi, getErrorMessage } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Book, ViewMode, FilterState } from '../types'

const ITEMS_PER_PAGE = 20

type BookSource = 'all' | 'my' | 'shared' | 'imported'

const emptyFilters: FilterState = {
  category: null,
  author: null,
  language: null,
  yearFrom: null,
  yearTo: null,
}

function LibraryPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [bookSource, setBookSource] = useState<BookSource>('all')
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [tempFilters, setTempFilters] = useState<FilterState>(emptyFilters)

  const searchQuery = searchParams.get('q') || ''
  const effectiveSearchQuery = bookSource === 'all' || bookSource === 'imported' ? searchQuery : ''
  const skip = parseInt(searchParams.get('skip') || '0', 10)

  useEffect(() => {
    const nextFilters = {
      category: searchParams.get('category'),
      author: searchParams.get('author'),
      language: searchParams.get('language'),
      yearFrom: searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom') || '', 10) : null,
      yearTo: searchParams.get('yearTo') ? parseInt(searchParams.get('yearTo') || '', 10) : null,
    }
    setFilters(nextFilters)
    setTempFilters(nextFilters)
  }, [searchParams])

  useEffect(() => {
    if (!isAuthenticated && (bookSource === 'my' || bookSource === 'shared')) {
      setBookSource('all')
    }
  }, [isAuthenticated, bookSource])

  const {
    data: booksData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['books', bookSource, effectiveSearchQuery, skip, filters],
    queryFn: async () => {
      if (effectiveSearchQuery) {
        const response = await searchApi.search({
          q: effectiveSearchQuery,
          category: filters.category || undefined,
          author: filters.author || undefined,
          language: filters.language || undefined,
          yearFrom: filters.yearFrom || undefined,
          yearTo: filters.yearTo || undefined,
          source: bookSource === 'imported' ? 'external' : undefined,
          page: Math.floor(skip / ITEMS_PER_PAGE) + 1,
          limit: ITEMS_PER_PAGE,
        })

        return {
          items: response.data.hits.map((hit) => ({
            id: hit.id,
            title: hit.title,
            author: hit.author,
            description: hit.description,
            isbn: null,
            publisher: null,
            publishedYear: hit.publishedYear,
            language: hit.language,
            category: hit.category,
            status: 'published' as const,
            visibility: 'public' as const,
            source: hit.source as Book['source'],
            coverPath: null,
            coverUrl: hit.coverUrl,
            filePath: '',
            fileName: hit.title,
            fileSize: hit.fileSize || 0,
            contentType: hit.contentType || '',
            downloadUrl: null,
            uploadedById: 0,
            uploadedByUsername: null,
            createdAt: hit.createdAt || new Date().toISOString(),
            updatedAt: null,
          })),
          total: response.data.totalHits,
          skip,
          limit: ITEMS_PER_PAGE,
          hasMore: skip + response.data.hits.length < response.data.totalHits,
        }
      }

      if (bookSource === 'my') {
        const response = await booksApi.getMy({
          skip,
          limit: ITEMS_PER_PAGE,
        })
        return response.data
      }

      if (bookSource === 'shared') {
        const response = await booksApi.getShared({
          skip,
          limit: ITEMS_PER_PAGE,
          category: filters.category || undefined,
          author: filters.author || undefined,
          language: filters.language || undefined,
          yearFrom: filters.yearFrom || undefined,
          yearTo: filters.yearTo || undefined,
        })
        return response.data
      }

      const response = await booksApi.getAll({
        skip,
        limit: ITEMS_PER_PAGE,
        category: filters.category || undefined,
        author: filters.author || undefined,
        language: filters.language || undefined,
        yearFrom: filters.yearFrom || undefined,
        yearTo: filters.yearTo || undefined,
        source: bookSource === 'imported' ? 'external' : undefined,
      })
      return response.data
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await booksApi.getCategories()
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        nextParams.delete(key)
      } else {
        nextParams.set(key, value)
      }
    })
    setSearchParams(nextParams)
  }, [searchParams, setSearchParams])

  const handlePageChange = (nextSkip: number) => {
    updateParams({ skip: String(nextSkip) })
  }

  const handleDeleteBook = async (bookId: number) => {
    setDeletingBookId(bookId)
    try {
      await booksApi.delete(bookId)
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    } finally {
      setDeletingBookId(null)
    }
  }

  const handleTempFilterChange = (key: keyof FilterState, value: string | number | null) => {
    setTempFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applyFilters = useCallback(() => {
    setFilters(tempFilters)
    updateParams({
      category: tempFilters.category,
      author: tempFilters.author,
      language: tempFilters.language,
      yearFrom: tempFilters.yearFrom ? String(tempFilters.yearFrom) : null,
      yearTo: tempFilters.yearTo ? String(tempFilters.yearTo) : null,
      skip: '0',
    })
  }, [tempFilters, updateParams])

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters)
    setTempFilters(emptyFilters)
    const nextParams = new URLSearchParams()
    if (searchQuery) {
      nextParams.set('q', searchQuery)
    }
    setSearchParams(nextParams)
  }, [searchQuery, setSearchParams])

  const books = booksData?.items || []
  const total = booksData?.total || 0
  const hasActiveFilters = Object.values(filters).some((value) => value !== null)

  const title = effectiveSearchQuery
    ? `Результаты поиска: "${effectiveSearchQuery}"`
    : bookSource === 'my'
      ? 'Мои книги'
      : bookSource === 'shared'
        ? 'Книги пользователей'
        : bookSource === 'imported'
          ? 'Импортированные книги'
          : 'Библиотека'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {total > 0 && <p className="text-sm text-gray-600 mt-1">Найдено {total} книг</p>}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setBookSource('all')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                bookSource === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => (isAuthenticated ? setBookSource('shared') : setBookSource('all'))}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                bookSource === 'shared' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="h-4 w-4" />
              Пользователи
            </button>
            <button
              onClick={() => (isAuthenticated ? setBookSource('my') : setBookSource('all'))}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                bookSource === 'my' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Мои
            </button>
            <button
              onClick={() => setBookSource('imported')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                bookSource === 'imported' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Globe className="h-4 w-4" />
              Импортированные
            </button>
          </div>

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

          <button
            onClick={() => setShowFilters((prev) => !prev)}
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
                {Object.values(filters).filter((value) => value !== null).length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Фильтры</h3>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-gray-700 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Сбросить
                </button>
              )}
              <button
                onClick={applyFilters}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Check className="h-4 w-4" />
                Применить
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <select
                value={tempFilters.category || ''}
                onChange={(e) => handleTempFilterChange('category', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Все категории</option>
                {(categories as string[] | undefined)?.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Язык</label>
              <select
                value={tempFilters.language || ''}
                onChange={(e) => handleTempFilterChange('language', e.target.value || null)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Все языки</option>
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="de">Deutsch</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Год от</label>
              <input
                type="number"
                value={tempFilters.yearFrom || ''}
                onChange={(e) => handleTempFilterChange('yearFrom', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="1900"
                min="1000"
                max="2100"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Год до</label>
              <input
                type="number"
                value={tempFilters.yearTo || ''}
                onChange={(e) => handleTempFilterChange('yearTo', e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="2024"
                min="1000"
                max="2100"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

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
          onEditBook={setEditingBook}
          deletingBookId={deletingBookId}
        />
      ) : (
        <EmptyState
          title={title}
          searchQuery={effectiveSearchQuery}
          hasFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

      {editingBook && (
        <EditBookModal
          book={editingBook}
          isOpen={!!editingBook}
          onClose={() => setEditingBook(null)}
          onBookUpdated={() => {
            refetch()
            setEditingBook(null)
          }}
        />
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  searchQuery: string
  hasFilters: boolean
  onClearFilters: () => void
}

function EmptyState({ title, searchQuery, hasFilters, onClearFilters }: EmptyStateProps) {
  const isMyBooks = title === 'Мои книги'
  const isSharedBooks = title === 'Книги пользователей'

  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <BookOpen className="h-10 w-10 text-gray-400" />
      </div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {searchQuery ? 'Ничего не найдено' : isMyBooks ? 'У вас пока нет книг' : isSharedBooks ? 'Пока никто не поделился книгами' : 'Библиотека пуста'}
      </h2>

      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {searchQuery
          ? `По запросу "${searchQuery}" ничего не найдено. Попробуйте изменить запрос или фильтры.`
          : isMyBooks
            ? 'Загрузите первую книгу и выберите, будет она приватной или публичной.'
            : isSharedBooks
              ? 'Когда пользователи начнут публиковать книги, они появятся здесь.'
              : 'Добавьте книги или измените фильтры, чтобы увидеть каталог.'}
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
