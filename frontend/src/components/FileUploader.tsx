import { useCallback, useState } from 'react'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { UploadProgress } from '../types'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  uploadProgress?: UploadProgress | null
  accept?: string
  maxSize?: number // in MB
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ALLOWED_EXTENSIONS = ['.pdf', '.epub', '.txt', '.docx']

function FileUploader({
  onFileSelect,
  selectedFile,
  uploadProgress,
  accept = '.pdf,.epub,.txt,.docx',
  maxSize = 50, // 50 MB default
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extension)

    if (!isValidType) {
      return `Неподдерживаемый формат файла. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`
    }

    // Check file size
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxSize) {
      return `Файл слишком большой. Максимальный размер: ${maxSize} MB`
    }

    return null
  }

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      onFileSelect(file)
    },
    [onFileSelect, maxSize]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    const colors: Record<string, string> = {
      pdf: 'text-red-500',
      epub: 'text-green-500',
      txt: 'text-gray-500',
      docx: 'text-blue-500',
    }
    return colors[ext || ''] || 'text-gray-400'
  }

  const clearFile = () => {
    setError(null)
    onFileSelect(null as unknown as File)
  }

  // Show selected file preview
  if (selectedFile && !error) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${getFileIcon(selectedFile.name)}`}>
            <File className="h-10 w-10" />
          </div>
          <div className="ml-4 flex-grow min-w-0">
            <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>

            {/* Upload progress */}
            {uploadProgress && uploadProgress.status === 'uploading' && (
              <div className="mt-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{uploadProgress.progress}% загружено</p>
              </div>
            )}

            {uploadProgress && uploadProgress.status === 'error' && (
              <p className="text-sm text-red-600 mt-1">{uploadProgress.error || 'Ошибка загрузки'}</p>
            )}
          </div>

          <div className="ml-4 flex-shrink-0">
            {uploadProgress?.status === 'uploading' ? (
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            ) : uploadProgress?.status === 'completed' ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : uploadProgress?.status === 'error' ? (
              <AlertCircle className="h-6 w-6 text-red-500" />
            ) : (
              <button
                onClick={clearFile}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Удалить файл"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Drop zone
  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload
          className={`h-10 w-10 mx-auto mb-3 ${
            isDragging ? 'text-blue-500' : error ? 'text-red-400' : 'text-gray-400'
          }`}
        />
        <p className="text-base font-medium text-gray-900 mb-1">
          Перетащите файл сюда
        </p>
        <p className="text-sm text-gray-600 mb-3">или</p>
        <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          <span>Выбрать файл</span>
          <input
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-500 mt-4">
          Поддерживаемые форматы: PDF, EPUB, TXT, DOCX (до {maxSize} MB)
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export default FileUploader
