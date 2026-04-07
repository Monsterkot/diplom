import axios, { AxiosError, AxiosResponse } from 'axios'
import type {
  Book,
  BookListResponse,
  BookCreate,
  User,
  Token,
  UserCreate,
  UserLogin,
  SearchParams,
  SuggestResponse,
  FullSearchResponse,
  SearchStats,
  SimilarBook,
  Category,
  ApiError,
  ExternalSource,
  MultiSourceSearchResponse,
  ExternalSearchResponse,
  ExternalBookSearchResult,
  ExternalBookImportRequest,
  ImportResult,
  SourcesListResponse,
} from '../types'
import { toSnakeCase, toSnakeCaseKeys, toSnakeCaseKeysDeep } from '../utils/caseConverter'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Helper to get stream URL for a book file (proxied through backend) - for preview/inline viewing
export const getBookStreamUrl = (bookId: number): string => {
  return `${API_URL}/api/books/${bookId}/file/stream`
}

// Helper to get HTML preview URL for DOCX files
export const getBookHtmlUrl = (bookId: number): string => {
  return `${API_URL}/api/books/${bookId}/file/html`
}

// Helper to get download URL for a book file - forces browser to download
export const getBookDownloadUrl = (bookId: number): string => {
  return `${API_URL}/api/books/${bookId}/file/stream?download=true`
}

// Download file by opening in new window/tab
// This approach doesn't block other requests as it uses a separate browser context
export const downloadBookFile = (bookId: number, fileName: string): void => {
  const url = getBookDownloadUrl(bookId)
  
  // Создаем невидимый iframe для скачивания
  // Это работает в отдельном контексте и не блокирует основные запросы
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  
  // Удаляем iframe через 5 минут
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 300000)
}

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token management
const TOKEN_KEY = 'literature_auth_token'

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

// Functions for AuthContext
export const setAuthToken = (token: string): void => {
  setToken(token)
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const clearAuthToken = (): void => {
  removeToken()
  delete api.defaults.headers.common['Authorization']
}

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      removeToken()
      // Could redirect to login or dispatch an event
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  }
)

// ============ Auth API ============

export const authApi = {
  register: (data: UserCreate): Promise<AxiosResponse<User>> => {
    // Convert camelCase to snake_case for backend (currently fields are snake_case, but this ensures future compatibility)
    const snakeCaseData = toSnakeCaseKeys(data)
    return api.post('/api/auth/register', snakeCaseData)
  },

  login: (email: string, password: string): Promise<AxiosResponse<Token>> => {
    // FastAPI OAuth2 expects form data
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)

    return api.post<Token>('/api/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  },

  logout: (): Promise<AxiosResponse<void>> => {
    clearAuthToken()
    return api.post('/api/auth/logout')
  },

  getCurrentUser: (): Promise<AxiosResponse<User>> => api.get('/api/auth/me'),

  // Alias for backwards compatibility
  me: (): Promise<AxiosResponse<User>> => api.get('/api/auth/me'),
}

// ============ Books API ============

export interface BooksQueryParams {
  skip?: number
  limit?: number
  category?: string
  author?: string
  language?: string
  source?: string
  yearFrom?: number
  yearTo?: number
}

export const booksApi = {
  getAll: (params?: BooksQueryParams): Promise<AxiosResponse<BookListResponse>> => {
    // Convert camelCase to snake_case for query params
    const snakeCaseParams: Record<string, unknown> = {}
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          snakeCaseParams[toSnakeCase(key)] = value
        }
      })
    }
    return api.get('/api/books', { params: snakeCaseParams })
  },

  getById: (id: number): Promise<AxiosResponse<Book>> =>
    api.get(`/api/books/${id}`),

  create: (data: BookCreate): Promise<AxiosResponse<Book>> => {
    // Convert camelCase to snake_case for backend
    const snakeCaseData = toSnakeCaseKeys(data)
    return api.post('/api/books', snakeCaseData)
  },

  upload: (
    file: File,
    metadata: BookCreate,
    onProgress?: (progress: number) => void
  ): Promise<AxiosResponse<Book>> => {
    const formData = new FormData()
    formData.append('file', file)

    // Append metadata fields with snake_case conversion
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const snakeKey = toSnakeCase(key)
        if (Array.isArray(value)) {
          value.forEach((v) => formData.append(snakeKey, String(v)))
        } else {
          formData.append(snakeKey, String(value))
        }
      }
    })

    return api.post('/api/books/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  },

  update: (id: number, data: Partial<BookCreate>): Promise<AxiosResponse<Book>> => {
    // Convert camelCase to snake_case for backend
    const snakeCaseData = toSnakeCaseKeys(data)
    return api.patch(`/api/books/${id}`, snakeCaseData)
  },

  delete: (id: number): Promise<AxiosResponse<void>> =>
    api.delete(`/api/books/${id}`),

  getCategories: (): Promise<AxiosResponse<Category[]>> =>
    api.get('/api/books/categories'),

  getDownloadUrl: (id: number): Promise<AxiosResponse<{ url: string }>> =>
    api.get(`/api/books/${id}/download`),

  getFileUrl: (
    id: number,
    download = false
  ): Promise<AxiosResponse<{ url: string; file_name: string; file_size: number; content_type: string }>> =>
    api.get(`/api/books/${id}/file`, { params: { download } }),

  getBookHtml: (id: number): Promise<AxiosResponse<{ html: string; text: string }>> =>
    api.get(`/api/books/${id}/file/html`),
}

// ============ Search API ============

export const searchApi = {
  // Full-text search with Meilisearch
  search: (params: SearchParams): Promise<AxiosResponse<FullSearchResponse>> =>
    api.get('/api/search', {
      params: {
        q: params.q,
        page: params.page || 1,
        limit: params.limit || 20,
        category: params.category,
        author: params.author,
        language: params.language,
        content_type: params.contentType,
        year_from: params.yearFrom,
        year_to: params.yearTo,
        sort: params.sort,
      },
    }),

  // Autocomplete suggestions
  suggest: (query: string, limit = 5): Promise<AxiosResponse<SuggestResponse>> =>
    api.get('/api/search/suggest', {
      params: { q: query, limit },
    }),

  // Similar books recommendation
  getSimilar: (
    bookId: number,
    limit = 5
  ): Promise<AxiosResponse<{ book_id: number; similar: SimilarBook[] }>> =>
    api.get(`/api/search/similar/${bookId}`, {
      params: { limit },
    }),

  // Get available facets for filtering
  getFacets: (query = ''): Promise<AxiosResponse<{ facets: Record<string, Record<string, number>>; query: string }>> =>
    api.get('/api/search/facets', {
      params: { q: query },
    }),

  // Get search index statistics
  getStats: (): Promise<AxiosResponse<SearchStats>> =>
    api.get('/api/search/stats'),

  // Legacy search (database-based, for fallback)
  searchLegacy: (params: SearchParams): Promise<AxiosResponse<BookListResponse>> =>
    api.get('/api/search/legacy', {
      params: {
        q: params.q,
        category: params.category,
        author: params.author,
        language: params.language,
        year_from: params.yearFrom,
        year_to: params.yearTo,
        skip: ((params.page || 1) - 1) * (params.limit || 20),
        limit: params.limit || 20,
      },
    }),
}

// ============ Files API ============

export const filesApi = {
  upload: (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<AxiosResponse<{ id: number; url: string }>> => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
  },

  getDownloadUrl: (fileId: number): Promise<AxiosResponse<{ url: string }>> =>
    api.get(`/api/files/${fileId}`),

  delete: (fileId: number): Promise<AxiosResponse<void>> =>
    api.delete(`/api/files/${fileId}`),
}

// ============ Health API ============

export const healthApi = {
  check: (): Promise<AxiosResponse<{ status: string; service: string; version: string }>> =>
    api.get('/health'),
}

// ============ External Books API ============

export interface ExternalSearchParams {
  q: string
  source?: ExternalSource
  limit?: number
  page?: number
}

export interface SingleSourceSearchParams {
  q: string
  limit?: number
  offset?: number
}

export const externalApi = {
  // Get available sources
  getSources: (): Promise<AxiosResponse<SourcesListResponse>> =>
    api.get('/api/external/sources'),

  // Search all sources
  search: (params: ExternalSearchParams): Promise<AxiosResponse<MultiSourceSearchResponse>> =>
    api.get('/api/external/search', { params }),

  // Search single source
  searchSource: (
    source: ExternalSource,
    params: SingleSourceSearchParams
  ): Promise<AxiosResponse<ExternalSearchResponse>> =>
    api.get(`/api/external/search/${source}`, { params }),

  // Get book details
  getDetails: (
    source: ExternalSource,
    externalId: string
  ): Promise<AxiosResponse<ExternalBookSearchResult>> =>
    api.get(`/api/external/details/${source}/${encodeURIComponent(externalId)}`),

  // Import book
  importBook: (data: ExternalBookImportRequest): Promise<AxiosResponse<ImportResult>> => {
    // Convert camelCase to snake_case for backend
    const snakeCaseData = toSnakeCaseKeys(data)
    return api.post('/api/external/import', snakeCaseData)
  },

  // Bulk import
  bulkImport: (
    items: ExternalBookImportRequest[]
  ): Promise<AxiosResponse<{ total: number; successful: number; failed: number; results: ImportResult[] }>> => {
    // Convert camelCase to snake_case for each item in the array
    const snakeCaseItems = items.map(item => toSnakeCaseKeys(item))
    return api.post('/api/external/import/bulk', { items: snakeCaseItems })
  },
}

// ============ Error helpers ============

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>
    const detail = axiosError.response?.data?.detail

    if (typeof detail === 'string') {
      return detail
    }

    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((e) => e.msg).join(', ')
    }

    if (axiosError.response?.status === 401) {
      return 'Требуется авторизация'
    }

    if (axiosError.response?.status === 403) {
      return 'Доступ запрещен'
    }

    if (axiosError.response?.status === 404) {
      return 'Ресурс не найден'
    }

    if (axiosError.response?.status === 500) {
      return 'Внутренняя ошибка сервера'
    }

    return axiosError.message || 'Произошла ошибка'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Произошла неизвестная ошибка'
}
