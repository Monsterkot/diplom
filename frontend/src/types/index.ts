/**
 * TypeScript type definitions for the Literature Aggregation System
 */

// ============ User Types ============

export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  created_at: string
}

export interface UserCreate {
  email: string
  username: string
  password: string
}

export interface UserLogin {
  email: string
  password: string
}

// ============ Auth Types ============

export interface Token {
  access_token: string
  token_type: string
  expires_in: number
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

// ============ Book Types ============

export interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  isbn: string | null
  publisher: string | null
  publishedYear: number | null
  language: string | null
  category: string | null
  tags?: string[]
  source?: 'upload' | 'openlibrary' | 'gutenberg'
  coverPath: string | null
  coverUrl: string | null
  filePath: string
  fileName: string
  fileSize: number
  contentType: string
  downloadUrl: string | null
  pageCount?: number | null
  uploadedById: number
  createdAt: string
  updatedAt: string | null
}

export interface BookCreate {
  title: string
  author?: string
  description?: string
  isbn?: string
  publisher?: string
  publishedYear?: number
  language?: string
  category?: string
  tags?: string[]
}

export interface BookUpdate {
  title?: string
  author?: string
  description?: string
  isbn?: string
  publisher?: string
  publishedYear?: number
  language?: string
  category?: string
  tags?: string[]
}

export interface BookUploadData extends BookCreate {
  file: File
}

// ============ API Response Types ============

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  limit: number
  hasMore: boolean
}

export type BookListResponse = PaginatedResponse<Book>

export interface SearchParams {
  q: string
  category?: string
  author?: string
  language?: string
  contentType?: string
  yearFrom?: number
  yearTo?: number
  page?: number
  limit?: number
  sort?: string
}

export interface SearchSuggestion {
  id: number
  title: string
  author: string | null
  category: string | null
}

export interface SuggestResponse {
  query: string
  suggestions: SearchSuggestion[]
  processingTimeMs: number
}

// ============ Meilisearch Search Types ============

export interface SearchHit {
  id: number
  title: string
  author: string | null
  description: string | null
  coverUrl: string | null
  category: string | null
  language: string | null
  publishedYear: number | null
  contentType: string | null
  fileSize: number | null
  source: string
  createdAt: string | null
  // Highlighted snippets
  titleHighlighted: string | null
  authorHighlighted: string | null
  descriptionHighlighted: string | null
  contentSnippet: string | null
}

export interface SearchFacets {
  author?: Record<string, number>
  category?: Record<string, number>
  language?: Record<string, number>
  contentType?: Record<string, number>
  publishedYear?: Record<string, number>
}

export interface FullSearchResponse {
  query: string
  hits: SearchHit[]
  totalHits: number
  processingTimeMs: number
  page: number
  hitsPerPage: number
  totalPages: number
  facets: SearchFacets
}

export interface SearchStats {
  numberOfDocuments: number
  isIndexing: boolean
  fieldDistribution: Record<string, number>
}

export interface SimilarBook {
  id: number
  title: string
  author: string | null
  category: string | null
  coverUrl: string | null
}

// ============ File Types ============

export interface FileRecord {
  id: number
  filename: string
  originalFilename: string
  contentType: string
  fileSize: number
  downloadUrl: string
  createdAt: string
}

// ============ Category Types ============

export interface Category {
  name: string
  count: number
}

// ============ API Error Types ============

export interface ApiError {
  detail: string | ValidationError[]
}

export interface ValidationError {
  loc: (string | number)[]
  msg: string
  type: string
}

// ============ UI State Types ============

export interface LoadingState {
  isLoading: boolean
  error: string | null
}

export interface UploadProgress {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

export type ViewMode = 'grid' | 'list'

export interface FilterState {
  category: string | null
  author: string | null
  language: string | null
  yearFrom: number | null
  yearTo: number | null
}

// ============ Reader Types ============

export interface ReaderState {
  currentPage: number
  totalPages: number
  zoom: number
  isLoading: boolean
}

// ============ External Book Types ============

export type ExternalSource = 'google_books' | 'open_library'

export interface ExternalBookSearchResult {
  externalId: string
  source: ExternalSource
  title: string
  authors: string[]
  description: string | null
  isbn10: string | null
  isbn13: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
  language: string | null
  thumbnailUrl: string | null
  previewLink: string | null
  infoLink: string | null
  averageRating: number | null
  ratingsCount: number | null
  isImported: boolean
  importedBookId: number | null
}

export interface ExternalSearchResponse {
  source: ExternalSource
  query: string
  totalItems: number
  items: ExternalBookSearchResult[]
  searchTimeMs: number
}

export interface MultiSourceSearchResponse {
  query: string
  results: Record<string, ExternalSearchResponse>
  totalItems: number
  totalSearchTimeMs: number
}

export interface ExternalBookImportRequest {
  source: ExternalSource
  externalId: string
  title?: string
  author?: string
  description?: string
  category?: string
  language?: string
}

export interface ImportResult {
  externalId: string
  source: ExternalSource
  success: boolean
  message: string
  externalBookId: number | null
  error: string | null
}

export interface ExternalSourceInfo {
  id: string
  name: string
  description: string
  features: string[]
  rateLimit: string
  hasApiKey: boolean
  isAvailable: boolean
}

export interface SourcesListResponse {
  sources: ExternalSourceInfo[]
}

export interface ExternalBook {
  id: number
  source: string
  externalId: string
  title: string
  authors: string[] | null
  description: string | null
  coverUrl: string | null
  publishedDate: string | null
  publishedYear: number | null
  language: string | null
  categories: string[] | null
  isbn10: string | null
  isbn13: string | null
  publisher: string | null
  pageCount: number | null
  averageRating: number | null
  ratingsCount: number | null
  previewLink: string | null
  infoLink: string | null
  downloadUrl: string | null
  isImported: boolean
  importedBookId: number | null
  importedAt: string | null
  createdAt: string
  updatedAt: string | null
}
