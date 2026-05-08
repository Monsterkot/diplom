import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, ArrowRight, BookOpen } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import FileUploader from '../components/FileUploader'
import { booksApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import type { BookCreate, BookVisibility, UploadProgress } from '../types'

interface FormData extends BookCreate {
  file: File | null
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

function UploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [step, setStep] = useState<'file' | 'metadata' | 'complete'>('file')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [formData, setFormData] = useState<FormData>({
    file: null,
    title: '',
    author: '',
    description: '',
    isbn: '',
    publisher: '',
    publishedYear: undefined,
    language: 'ru',
    category: '',
    visibility: 'private',
    tags: [],
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!formData.file) throw new Error(t('upload.noFile'))

      setUploadProgress({ file: formData.file, progress: 0, status: 'uploading' })

      const metadata: BookCreate = {
        title: formData.title,
        author: formData.author || undefined,
        description: formData.description || undefined,
        isbn: formData.isbn || undefined,
        publisher: formData.publisher || undefined,
        publishedYear: formData.publishedYear || undefined,
        language: formData.language || undefined,
        category: formData.category || undefined,
        visibility: formData.visibility as BookVisibility,
        tags: formData.tags?.length ? formData.tags : undefined,
      }

      const response = await booksApi.upload(formData.file, metadata, (progress) => {
        setUploadProgress((prev) => (prev ? { ...prev, progress, status: 'uploading' } : null))
      })

      return response.data
    },
    onSuccess: () => {
      setUploadProgress((prev) => (prev ? { ...prev, status: 'completed', progress: 100 } : null))
      setStep('complete')
    },
    onError: (error) => {
      setUploadProgress((prev) => (prev ? { ...prev, status: 'error', error: getErrorMessage(error) } : null))
    },
  })

  const handleFileSelect = (file: File) => {
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    const cleanTitle = nameWithoutExt.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
    setFormData((prev) => ({ ...prev, file, title: prev.title || cleanTitle }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'publishedYear' ? (value ? parseInt(value, 10) : undefined) : value,
    }))
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (!tag || formData.tags?.includes(tag)) return
    setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), tag] }))
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [] }))
  }

  const resetForm = () => {
    setFormData({
      file: null,
      title: '',
      author: '',
      description: '',
      isbn: '',
      publisher: '',
      publishedYear: undefined,
      language: 'ru',
      category: '',
      visibility: 'private',
      tags: [],
    })
    setUploadProgress(null)
    setStep('file')
  }

  if (step === 'file') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('upload.title')}</h1>
          <p className="text-gray-600 mt-1">{t('upload.subtitle')}</p>
        </div>

        <FileUploader onFileSelect={handleFileSelect} selectedFile={formData.file} uploadProgress={null} />

        {formData.file && (
          <div className="flex justify-end">
            <button onClick={() => setStep('metadata')} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
              {t('common.next')}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  if (step === 'metadata') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('upload.infoTitle')}</h1>
          <p className="text-gray-600 mt-1">{t('upload.infoSubtitle')}</p>
        </div>

        <FileUploader onFileSelect={handleFileSelect} selectedFile={formData.file} uploadProgress={uploadProgress} />

        <form onSubmit={(e) => { e.preventDefault(); uploadMutation.mutate() }} className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.title')} <span className="text-red-500">*</span>
            </label>
            <input type="text" id="title" name="title" value={formData.title} onChange={handleInputChange} required className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder={t('upload.titlePlaceholder')} />
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
                {LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
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
                <p className="text-sm text-gray-600 mt-1">{t('book.publicDescription')}</p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.tags')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-blue-900">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }} className="flex-grow border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder={t('upload.addTag')} />
              <button type="button" onClick={handleAddTag} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">{t('upload.add')}</button>
            </div>
          </div>

          {uploadMutation.isError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{getErrorMessage(uploadMutation.error)}</span>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <button type="button" onClick={() => setStep('file')} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">{t('common.back')}</button>
            <button type="submit" disabled={!formData.title || uploadMutation.isPending} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {uploadMutation.isPending ? t('upload.uploading') : t('upload.uploadBook')}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('upload.completeTitle')}</h1>
      <p className="text-gray-600 mb-8">{t('upload.completeText', { title: formData.title })}</p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button onClick={resetForm} className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors">
          {t('upload.uploadAnother')}
        </button>
        <button onClick={() => { queryClient.invalidateQueries({ queryKey: ['books'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); navigate('/library') }} className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <BookOpen className="h-5 w-5" />
          {t('upload.goToLibrary')}
        </button>
      </div>
    </div>
  )
}

export default UploadPage
