import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  BookOpen,
  User,
  Calendar,
  Tag,
  Building,
  Loader2,
  AlertCircle,
  FileText,
  Trash2,
  X,
} from 'lucide-react'
import { Reader, FileTypeInfo } from '../components'
import { booksApi, getErrorMessage, getBookStreamUrl, getBookDownloadUrl } from '../services/api'
import type { Book } from '../types'

function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Fetch book data
  const {
    data: book,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['book', bookId],
    queryFn: async () => {
      if (!bookId) throw new Error('Book ID is required')
      const response = await booksApi.getById(parseInt(bookId))
      return response.data
    },
    enabled: !!bookId,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!bookId) throw new Error('Book ID is required')
      await booksApi.delete(parseInt(bookId))
    },
    onSuccess: () => {
      // Invalidate books list queries
      queryClient.invalidateQueries({ queryKey: ['books'] })
      // Navigate to library
      navigate('/library')
    },
  })

  // Get stream URL for the book file (proxied through backend)
  const fileUrl = bookId ? getBookStreamUrl(parseInt(bookId)) : null

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleDownload = () => {
    if (bookId) {
      const downloadUrl = getBookDownloadUrl(parseInt(bookId))
      // Create temporary link and click it to trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = book?.fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading book...</p>
      </div>
    )
  }

  // Error state
  if (error || !book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Book Not Found</h2>
        <p className="text-gray-600 mb-6">{error ? getErrorMessage(error) : 'The requested book does not exist'}</p>
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Cover Image */}
        <div className="w-48 h-64 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 shadow-md mx-auto lg:mx-0">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 p-4">
              <BookOpen className="h-16 w-16 mb-2" />
              <span className="text-xs text-center text-gray-400">{book.title}</span>
            </div>
          )}
        </div>

        {/* Book Info */}
        <div className="flex-grow">
          {/* Back link */}
          <Link
            to="/library"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Link>

          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{book.title}</h1>

          {book.author && (
            <p className="text-lg text-gray-600 flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              {book.author}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
            <FileTypeInfo contentType={book.contentType || ''} fileName={book.fileName} />
            {book.category && (
              <span className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                {book.category}
              </span>
            )}
            {book.publishedYear && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {book.publishedYear}
              </span>
            )}
            {book.publisher && (
              <span className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                {book.publisher}
              </span>
            )}
            {book.fileSize && (
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {formatFileSize(book.fileSize)}
              </span>
            )}
          </div>

          {/* Tags */}
          {book.tags && book.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {book.description && (
            <p className="text-gray-600 mb-6 max-w-2xl">{book.description}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Скачать
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Удалить книгу?</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Вы уверены, что хотите удалить книгу "{book.title}"? Это действие нельзя отменить.
            </p>
            {deleteMutation.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {getErrorMessage(deleteMutation.error)}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reader */}
      {fileUrl ? (
        <div className="bg-white rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 24rem)', minHeight: '500px' }}>
          <Reader
            url={fileUrl}
            title={book.title}
            contentType={book.contentType || ''}
            fileName={book.fileName}
            onDownload={handleDownload}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-10 w-10 text-yellow-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">File Unavailable</h3>
          <p className="text-gray-600">
            The file for this book is temporarily unavailable.
          </p>
        </div>
      )}

      {/* ISBN */}
      {book.isbn && (
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-sm text-gray-500">ISBN: </span>
          <span className="text-sm font-mono text-gray-700">{book.isbn}</span>
        </div>
      )}
    </div>
  )
}

export default ReaderPage
