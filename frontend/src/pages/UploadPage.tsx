import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, ArrowRight, BookOpen } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import FileUploader from '../components/FileUploader'
import { booksApi, getErrorMessage } from '../services/api'
import type { BookCreate, UploadProgress } from '../types'

interface FormData extends BookCreate {
  file: File | null
}

const CATEGORIES = [
  'Программирование',
  'Математика',
  'Физика',
  'Химия',
  'Биология',
  'История',
  'Философия',
  'Экономика',
  'Литература',
  'Искусство',
  'Психология',
  'Другое',
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
  const [step, setStep] = useState<'file' | 'metadata' | 'complete'>('file')
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
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
    tags: [],
  })
  const [tagInput, setTagInput] = useState('')

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!formData.file) throw new Error('Файл не выбран')

      setUploadProgress({
        file: formData.file,
        progress: 0,
        status: 'uploading',
      })

      const metadata: BookCreate = {
        title: formData.title,
        author: formData.author || undefined,
        description: formData.description || undefined,
        isbn: formData.isbn || undefined,
        publisher: formData.publisher || undefined,
        publishedYear: formData.publishedYear || undefined,
        language: formData.language || undefined,
        category: formData.category || undefined,
        tags: formData.tags?.length ? formData.tags : undefined,
      }

      const response = await booksApi.upload(formData.file, metadata, (progress) => {
        setUploadProgress((prev) =>
          prev ? { ...prev, progress, status: 'uploading' } : null
        )
      })

      return response.data
    },
    onSuccess: (book) => {
      setUploadProgress((prev) => (prev ? { ...prev, status: 'completed', progress: 100 } : null))
      setStep('complete')
    },
    onError: (error) => {
      setUploadProgress((prev) =>
        prev ? { ...prev, status: 'error', error: getErrorMessage(error) } : null
      )
    },
  })

  const handleFileSelect = (file: File) => {
    // Extract title from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    const cleanTitle = nameWithoutExt
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    setFormData((prev) => ({
      ...prev,
      file,
      title: prev.title || cleanTitle,
    }))
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'publishedYear' ? (value ? parseInt(value) : undefined) : value,
    }))
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !formData.tags?.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tag],
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const goToMetadata = () => {
    if (formData.file) {
      setStep('metadata')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    uploadMutation.mutate()
  }

  // Step 1: File selection
  if (step === 'file') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Загрузка книги</h1>
          <p className="text-gray-600 mt-1">Выберите файл для загрузки</p>
        </div>

        <FileUploader
          onFileSelect={handleFileSelect}
          selectedFile={formData.file}
          uploadProgress={null}
        />

        {formData.file && (
          <div className="flex justify-end">
            <button
              onClick={goToMetadata}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Далее
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  // Step 2: Metadata form
  if (step === 'metadata') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Информация о книге</h1>
          <p className="text-gray-600 mt-1">Заполните данные о книге</p>
        </div>

        {/* Selected file preview */}
        <FileUploader
          onFileSelect={handleFileSelect}
          selectedFile={formData.file}
          uploadProgress={uploadProgress}
        />

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-6">
          {/* Title (required) */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите название книги"
            />
          </div>

          {/* Author */}
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              Автор
            </label>
            <input
              type="text"
              id="author"
              name="author"
              value={formData.author}
              onChange={handleInputChange}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Имя автора"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Краткое описание книги"
            />
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Выберите категорию</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                Язык
              </label>
              <select
                id="language"
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Publisher */}
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 mb-1">
                Издательство
              </label>
              <input
                type="text"
                id="publisher"
                name="publisher"
                value={formData.publisher}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Название издательства"
              />
            </div>

            {/* Year */}
            <div>
              <label htmlFor="publishedYear" className="block text-sm font-medium text-gray-700 mb-1">
                Год издания
              </label>
              <input
                type="number"
                id="publishedYear"
                name="publishedYear"
                value={formData.publishedYear || ''}
                onChange={handleInputChange}
                min="1000"
                max="2100"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="2024"
              />
            </div>

            {/* ISBN */}
            <div className="sm:col-span-2">
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-1">
                ISBN
              </label>
              <input
                type="text"
                id="isbn"
                name="isbn"
                value={formData.isbn}
                onChange={handleInputChange}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="978-3-16-148410-0"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Теги</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-grow border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Добавить тег"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Добавить
              </button>
            </div>
          </div>

          {/* Error message */}
          {uploadMutation.isError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{getErrorMessage(uploadMutation.error)}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep('file')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={!formData.title || uploadMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadMutation.isPending ? 'Загрузка...' : 'Загрузить книгу'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // Step 3: Complete
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Книга загружена!</h1>
      <p className="text-gray-600 mb-8">
        Книга "{formData.title}" успешно добавлена в вашу библиотеку.
      </p>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <button
          onClick={() => {
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
              tags: [],
            })
            setUploadProgress(null)
            setStep('file')
          }}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Загрузить ещё
        </button>
        <button
          onClick={() => navigate('/library')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <BookOpen className="h-5 w-5" />
          Перейти в библиотеку
        </button>
      </div>
    </div>
  )
}

export default UploadPage
