import { useEffect, useRef } from 'react'
import {
  X,
  BookOpen,
  User,
  Calendar,
  Building,
  Tag,
  Star,
  ExternalLink,
  Download,
  Check,
  Loader2,
  Globe,
  FileText,
  Languages,
} from 'lucide-react'
import type { ExternalBookSearchResult, ExternalSource } from '../types'

interface BookPreviewModalProps {
  book: ExternalBookSearchResult
  isOpen: boolean
  onClose: () => void
  onImport: () => void
  isImporting: boolean
}

const SOURCE_LABELS: Record<ExternalSource, string> = {
  google_books: 'Google Books',
  open_library: 'Open Library',
}

const SOURCE_COLORS: Record<ExternalSource, string> = {
  google_books: 'bg-blue-100 text-blue-700',
  open_library: 'bg-green-100 text-green-700',
}

function BookPreviewModal({
  book,
  isOpen,
  onClose,
  onImport,
  isImporting,
}: BookPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-sm ${SOURCE_COLORS[book.source]}`}>
              {SOURCE_LABELS[book.source]}
            </span>
            {book.isImported && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm flex items-center gap-1">
                <Check className="h-3 w-3" />
                Imported
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Cover Image */}
            <div className="w-40 h-56 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden mx-auto md:mx-0 shadow-md">
              {book.thumbnailUrl ? (
                <img
                  src={book.thumbnailUrl}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                  <BookOpen className="h-16 w-16 mb-2" />
                  <span className="text-xs text-center text-gray-400 px-2">No cover</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{book.title}</h2>

              {book.authors.length > 0 && (
                <p className="text-lg text-gray-600 flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-gray-400" />
                  {book.authors.join(', ')}
                </p>
              )}

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                {book.publishedDate && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>{book.publishedDate}</span>
                  </div>
                )}

                {book.publisher && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{book.publisher}</span>
                  </div>
                )}

                {book.pageCount && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>{book.pageCount} pages</span>
                  </div>
                )}

                {book.language && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Languages className="h-4 w-4 text-gray-400" />
                    <span className="uppercase">{book.language}</span>
                  </div>
                )}

                {book.averageRating && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    <span>
                      {book.averageRating.toFixed(1)}
                      {book.ratingsCount && (
                        <span className="text-gray-400 ml-1">
                          ({book.ratingsCount.toLocaleString()} ratings)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Categories */}
              {book.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {book.categories.map((category, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm flex items-center gap-1"
                    >
                      <Tag className="h-3 w-3" />
                      {category}
                    </span>
                  ))}
                </div>
              )}

              {/* ISBNs */}
              {(book.isbn10 || book.isbn13) && (
                <div className="text-sm text-gray-500 mb-4">
                  {book.isbn13 && <div>ISBN-13: <span className="font-mono">{book.isbn13}</span></div>}
                  {book.isbn10 && <div>ISBN-10: <span className="font-mono">{book.isbn10}</span></div>}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
              <div
                className="text-gray-600 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: book.description }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            {book.previewLink && (
              <a
                href={book.previewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <ExternalLink className="h-4 w-4" />
                Preview
              </a>
            )}
            {book.infoLink && (
              <a
                href={book.infoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <Globe className="h-4 w-4" />
                More Info
              </a>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>

            {book.isImported ? (
              <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
                <Check className="h-5 w-5" />
                Already Imported
              </span>
            ) : (
              <button
                onClick={onImport}
                disabled={isImporting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" />
                    Import to Library
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookPreviewModal
