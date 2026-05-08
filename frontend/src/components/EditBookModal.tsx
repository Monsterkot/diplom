import { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { booksApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import type { Book, BookUpdate } from '../types'

interface EditBookModalProps {
  book: Book
  isOpen: boolean
  onClose: () => void
  onBookUpdated?: (updatedBook: Book) => void
}

const CATEGORY_KEYS = [
  'programming',
  'math',
  'physics',
  'chemistry',
  'biology',
  'history',
  'philosophy',
  'economics',
  'literature',
  'art',
  'psychology',
  'other',
]

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
]

function EditBookModal({ book, isOpen, onClose, onBookUpdated }: EditBookModalProps) {
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [formData, setFormData] = useState<BookUpdate>({
    title: '',
    author: '',
    description: '',
    isbn: '',
    publisher: '',
    publishedYear: undefined,
    language: '',
    category: '',
  })

  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || '',
        author: book.author || '',
        description: book.description || '',
        isbn: book.isbn || '',
        publisher: book.publisher || '',
        publishedYear: book.publishedYear || undefined,
        language: book.language || '',
        category: book.category || '',
        visibility: book.visibility,
      })
    }
  }, [book])

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!book.id) throw new Error('Book ID is required')
      const updateData: BookUpdate = {
        title: formData.title || undefined,
        author: formData.author || undefined,
        description: formData.description || undefined,
        isbn: formData.isbn || undefined,
        publisher: formData.publisher || undefined,
        publishedYear: formData.publishedYear || undefined,
        language: formData.language || undefined,
        category: formData.category || undefined,
        visibility: formData.visibility || undefined,
      }
      const response = await booksApi.update(book.id, updateData)
      return response.data
    },
    onSuccess: (updatedBook) => {
      queryClient.setQueryData(['book', book.id], updatedBook)
      queryClient.invalidateQueries({ queryKey: ['books'] })
      onBookUpdated?.(updatedBook)
      onClose()
    },
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'publishedYear' ? (value ? parseInt(value) : undefined) : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.title.trim()) return
    updateMutation.mutate()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-900">{t('book.editTitle')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={updateMutation.isPending}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.title')} <span className="text-red-500">*</span>
            </label>
            <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder={t('upload.titlePlaceholder')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('book.visibility')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`border rounded-lg p-4 cursor-pointer transition-colors ${formData.visibility === 'private' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="visibility" value="private" checked={formData.visibility === 'private'} onChange={handleInputChange} className="sr-only" />
                <p className="font-medium text-gray-900">{t('common.private')}</p>
                <p className="text-sm text-gray-600 mt-1">{t('book.privateDescription')}</p>
              </label>
              <label className={`border rounded-lg p-4 cursor-pointer transition-colors ${formData.visibility === 'public' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="visibility" value="public" checked={formData.visibility === 'public'} onChange={handleInputChange} className="sr-only" />
                <p className="font-medium text-gray-900">{t('common.public')}</p>
                <p className="text-sm text-gray-600 mt-1">{t('book.publicEditDescription')}</p>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">{t('common.author')}</label>
            <input type="text" id="author" name="author" value={formData.author} onChange={handleInputChange} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder={t('upload.authorPlaceholder')} />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={4} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder={t('upload.descriptionPlaceholder')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
              <select id="category" name="category" value={formData.category} onChange={handleInputChange} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">{t('upload.categoryPlaceholder')}</option>
                {CATEGORY_KEYS.map((key) => {
                  const label = t(`categories.${key}`)
                  return <option key={key} value={label}>{label}</option>
                })}
              </select>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">{t('common.language')}</label>
              <select id="language" name="language" value={formData.language} onChange={handleInputChange} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">{t('common.language')}</option>
                {LANGUAGES.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 mb-1">{t('common.publisher')}</label>
              <input type="text" id="publisher" name="publisher" value={formData.publisher} onChange={handleInputChange} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder={t('upload.publisherPlaceholder')} />
            </div>
            <div>
              <label htmlFor="publishedYear" className="block text-sm font-medium text-gray-700 mb-1">{t('common.year')}</label>
              <input type="number" id="publishedYear" name="publishedYear" value={formData.publishedYear || ''} onChange={handleInputChange} min="1000" max="2100" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="2024" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-1">{t('common.isbn')}</label>
              <input type="text" id="isbn" name="isbn" value={formData.isbn} onChange={handleInputChange} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="978-3-16-148410-0" />
            </div>
          </div>

          {updateMutation.isError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <X className="h-5 w-5 flex-shrink-0" />
              <span>{getErrorMessage(updateMutation.error)}</span>
            </div>
          )}

          {updateMutation.isSuccess && (
            <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>{t('book.updated')}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={updateMutation.isPending} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={updateMutation.isPending || !formData.title} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('book.saving')}
                </>
              ) : (
                t('book.saveChanges')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditBookModal
