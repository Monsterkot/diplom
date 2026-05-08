import { useState, useCallback } from 'react'
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
  Edit2,
} from 'lucide-react'
import { Reader, FileTypeInfo, EditBookModal } from '../components'
import { booksApi, getErrorMessage, getBookStreamUrl, downloadBookFile } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'

function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const { data: book, isLoading, error, refetch } = useQuery({
    queryKey: ['book', bookId],
    queryFn: async () => {
      if (!bookId) throw new Error('Book ID is required')
      const response = await booksApi.getById(parseInt(bookId))
      return response.data
    },
    enabled: !!bookId,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!bookId) throw new Error('Book ID is required')
      await booksApi.delete(parseInt(bookId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      navigate('/library')
    },
  })

  const fileUrl = bookId ? getBookStreamUrl(parseInt(bookId)) : null

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleDownload = useCallback(() => {
    if (bookId && book?.fileName) {
      downloadBookFile(parseInt(bookId))
    }
  }, [bookId, book?.fileName])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">{t('reader.loading')}</p>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('reader.error')}</h2>
        <p className="text-gray-600 mb-6">{error ? getErrorMessage(error) : t('reader.error')}</p>
        <button onClick={() => navigate('/library')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('reader.backToLibrary')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="w-48 h-64 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 shadow-md mx-auto lg:mx-0">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 p-4">
              <BookOpen className="h-16 w-16 mb-2" />
              <span className="text-xs text-center text-gray-400">{book.title}</span>
            </div>
          )}
        </div>

        <div className="flex-grow">
          <Link to="/library" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" />
            {t('reader.backToLibrary')}
          </Link>

          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{book.title}</h1>

          {book.author && (
            <p className="text-lg text-gray-600 flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              {book.author}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
            <FileTypeInfo contentType={book.contentType || ''} fileName={book.fileName} />
            {book.category && <span className="flex items-center gap-1"><Tag className="h-4 w-4" />{book.category}</span>}
            {book.language && <span className="flex items-center gap-1 uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{book.language}</span>}
            {book.publishedYear && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{book.publishedYear}</span>}
            {book.publisher && <span className="flex items-center gap-1"><Building className="h-4 w-4" />{book.publisher}</span>}
            {book.isbn && <span className="flex items-center gap-1 font-mono">ISBN: {book.isbn}</span>}
            {book.fileSize && <span className="flex items-center gap-1"><FileText className="h-4 w-4" />{formatFileSize(book.fileSize)}</span>}
          </div>

          {book.tags && book.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {book.tags.map((tag) => <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">{tag}</span>)}
            </div>
          )}

          {book.description && <p className="text-gray-600 mb-6 max-w-2xl">{book.description}</p>}

          <div className="flex flex-wrap gap-3">
            <button onClick={handleDownload} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="h-4 w-4" />
              {t('book.download')}
            </button>
            <button onClick={() => setShowEditModal(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 className="h-4 w-4" />
              {t('common.edit')}
            </button>
            <button onClick={() => setShowDeleteModal(true)} className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 className="h-4 w-4" />
              {t('common.delete')}
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('book.deleteQuestion')}</h3>
              <button onClick={() => setShowDeleteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">{t('book.deleteConfirm', { title: book.title })}</p>
            {deleteMutation.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {getErrorMessage(deleteMutation.error)}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleteMutation.isPending} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleteMutation.isPending ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {fileUrl ? (
        <div className="bg-white rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 24rem)', minHeight: '500px' }}>
          <Reader url={fileUrl} bookId={parseInt(bookId || '0', 10)} title={book.title} contentType={book.contentType || ''} fileName={book.fileName} onDownload={handleDownload} />
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-10 w-10 text-yellow-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('reader.fileUnavailable')}</h3>
          <p className="text-gray-600">{t('reader.fileUnavailableText')}</p>
        </div>
      )}

      {book.isbn && (
        <div className="bg-gray-50 rounded-lg p-4">
          <span className="text-sm text-gray-500">ISBN: </span>
          <span className="text-sm font-mono text-gray-700">{book.isbn}</span>
        </div>
      )}

      {showEditModal && <EditBookModal book={book} isOpen={showEditModal} onClose={() => setShowEditModal(false)} onBookUpdated={() => refetch()} />}
    </div>
  )
}

export default ReaderPage
