import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Download, User, Calendar, Tag, Trash2, X, Loader2 } from 'lucide-react'
import { getBookDownloadUrl } from '../services/api'
import type { Book, ViewMode } from '../types'

interface BookCardProps {
  book: Book
  viewMode?: ViewMode
  onDelete?: (bookId: number) => Promise<void>
  isDeleting?: boolean
}

function BookCard({ book, viewMode = 'grid', onDelete, isDeleting }: BookCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(book.id)
      setShowDeleteConfirm(false)
    }
  }
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      upload: { bg: 'bg-green-100', text: 'text-green-700', label: 'Загружено' },
      openlibrary: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Open Library' },
      gutenberg: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Gutenberg' },
    }
    return badges[source] || badges.upload
  }

  const sourceBadge = getSourceBadge(book.source)

  if (viewMode === 'list') {
    return (
      <div className="flex items-center p-4 bg-white rounded-lg border hover:shadow-md transition-shadow">
        {/* Cover */}
        <div className="w-20 h-28 flex-shrink-0 rounded overflow-hidden bg-gray-100">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
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
        <div className="ml-4 flex-grow min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{book.title}</h3>
              {book.author && (
                <p className="text-sm text-gray-600 flex items-center mt-1">
                  <User className="h-3 w-3 mr-1" />
                  {book.author}
                </p>
              )}
            </div>
            <span className={`ml-2 flex-shrink-0 text-xs px-2 py-1 rounded ${sourceBadge.bg} ${sourceBadge.text}`}>
              {sourceBadge.label}
            </span>
          </div>

          {book.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{book.description}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            {book.category && (
              <span className="flex items-center">
                <Tag className="h-3 w-3 mr-1" />
                {book.category}
              </span>
            )}
            {book.publishedYear && (
              <span className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {book.publishedYear}
              </span>
            )}
            {book.fileSize && (
              <span>{formatFileSize(book.fileSize)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
          <Link
            to={`/reader/${book.id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Читать
          </Link>
          <a
            href={getBookDownloadUrl(book.id)}
            download={book.fileName || 'download'}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <Download className="h-4 w-4 mr-1" />
            Скачать
          </a>
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Удалить
            </button>
          )}
        </div>

        {/* Delete Confirmation Popup */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">Удалить книгу?</h3>
                <button onClick={() => setShowDeleteConfirm(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Удалить "{book.title}"? Это действие нельзя отменить.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Grid view
  return (
    <div className="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow group">
      {/* Cover */}
      <Link to={`/reader/${book.id}`} className="block aspect-[3/4] relative overflow-hidden bg-gray-100">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 p-4">
            <BookOpen className="h-12 w-12 mb-2" />
            <span className="text-xs text-center line-clamp-3 text-gray-400">{book.title}</span>
          </div>
        )}

        {/* Source Badge Overlay */}
        <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${sourceBadge.bg} ${sourceBadge.text}`}>
          {sourceBadge.label}
        </span>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="px-4 py-2 bg-white text-gray-900 font-medium rounded-lg">
            Читать
          </span>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        <Link to={`/reader/${book.id}`}>
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 hover:text-blue-600 transition-colors">
            {book.title}
          </h3>
        </Link>
        {book.author && (
          <p className="text-xs text-gray-600 mt-1 truncate">{book.author}</p>
        )}
        {book.category && (
          <span className="inline-block mt-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {book.category}
          </span>
        )}
      </div>
    </div>
  )
}

export default BookCard
