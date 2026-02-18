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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Helper to get stream URL for a book file (proxied through backend) - for preview/inline viewing
export const getBookStreamUrl = (bookId: number): string => {
  return `${API_URL}/api/books/${bookId}/file/stream`
}

// Helper to get download URL for a book file - forces browser to download
export const getBookDownloadUrl = (bookId: number): string => {
  return `${API_URL}/api/books/${bookId}/file/stream?download=true`
}

// Download file as blob and trigger browser download
export const downloadBookFile = async (bookId: number, fileName: string): Promise<void> => {
  const url = getBookDownloadUrl(bookId)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to download file')
  }

  const blob = await response.blob()
  const blobUrl = window.URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = blobUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL
  window.URL.revokeObjectURL(blobUrl)
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
  register: (data: UserCreate): Promise<AxiosResponse<User>> =>
    api.post('/api/auth/register', data),

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
}

export const booksApi = {
  getAll: (params?: BooksQueryParams): Promise<AxiosResponse<BookListResponse>> =>
    api.get('/api/books', { params }),

  getById: (id: number): Promise<AxiosResponse<Book>> =>
    api.get(`/api/books/${id}`),

  create: (data: BookCreate): Promise<AxiosResponse<Book>> =>
    api.post('/api/books', data),

  upload: (
    file: File,
    metadata: BookCreate,
    onProgress?: (progress: number) => void
  ): Promise<AxiosResponse<Book>> => {
    const formData = new FormData()
    formData.append('file', file)

    // Append metadata fields
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => formData.append(key, v))
        } else {
          formData.append(key, String(value))
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

  update: (id: number, data: Partial<BookCreate>): Promise<AxiosResponse<Book>> =>
    api.patch(`/api/books/${id}`, data),

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
  importBook: (data: ExternalBookImportRequest): Promise<AxiosResponse<ImportResult>> =>
    api.post('/api/external/import', data),

  // Bulk import
  bulkImport: (
    items: ExternalBookImportRequest[]
  ): Promise<AxiosResponse<{ total: number; successful: number; failed: number; results: ImportResult[] }>> =>
    api.post('/api/external/import/bulk', { items }),
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
