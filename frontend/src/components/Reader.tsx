import { BookOpen, FileText, AlertCircle, Download } from 'lucide-react'
import PdfViewer from './PdfViewer'
import EpubViewer from './EpubViewer'
import DocxViewer from './DocxViewer'

interface ReaderProps {
  url: string
  bookId?: number
  title?: string
  contentType: string
  fileName?: string
  onDownload?: () => void
}

type FileType = 'pdf' | 'epub' | 'txt' | 'docx' | 'unknown'

function Reader({ url, bookId, title, contentType, fileName, onDownload }: ReaderProps) {
  const getFileType = (): FileType => {
    // Check content type first
    if (contentType === 'application/pdf') return 'pdf'
    if (contentType === 'application/epub+zip') return 'epub'
    if (contentType === 'text/plain') return 'txt'
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'

    // Fallback to file extension
    const ext = fileName?.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (ext === 'epub') return 'epub'
    if (ext === 'txt') return 'txt'
    if (ext === 'docx') return 'docx'

    return 'unknown'
  }

  const fileType = getFileType()
  
  // Debug log
  console.log('Reader props:', { url, bookId, contentType, fileName, fileType })

  // PDF Viewer
  if (fileType === 'pdf') {
    return <PdfViewer url={url} title={title} />
  }

  // EPUB Viewer
  if (fileType === 'epub') {
    return <EpubViewer url={url} title={title} />
  }

  // DOCX Viewer - HTML preview
  if (fileType === 'docx') {
    console.log('DOCX detected, bookId:', bookId)
    if (!bookId) {
      // Fallback: try to extract book ID from URL
      const bookIdMatch = url.match(/\/books\/(\d+)/)
      bookId = bookIdMatch ? parseInt(bookIdMatch[1], 10) : undefined
      console.log('Extracted bookId from URL:', bookId)
    }
    if (bookId) {
      console.log('Rendering DocxViewer with bookId:', bookId)
      return <DocxViewer url={url} bookId={bookId} title={title} onDownload={onDownload} />
    }
    console.log('No bookId available, showing fallback')
    // Fallback to download prompt if bookId not available
  }

  // TXT Viewer (use iframe)
  if (fileType === 'txt') {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between bg-gray-50 border-b px-4 py-2">
          <span className="text-sm font-medium text-gray-700 truncate">{title || 'Text File'}</span>
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
          )}
        </div>
        <iframe
          src={url}
          title={title || 'Text file'}
          className="flex-grow w-full bg-white"
          style={{ minHeight: '500px' }}
        />
      </div>
    )
  }

  // Unsupported file type
  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg border p-8 text-center">
      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="h-10 w-10 text-yellow-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Not Available</h3>
      <p className="text-gray-600 mb-6 max-w-md">
        This file type ({contentType || 'unknown'}) cannot be previewed in the browser.
        Please download the file to view it in an appropriate application.
      </p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="h-5 w-5" />
          Download File
        </button>
      )}
    </div>
  )
}

export default Reader

// Helper component for showing file type info
export function FileTypeInfo({ contentType, fileName }: { contentType: string; fileName?: string }) {
  const getInfo = () => {
    if (contentType === 'application/pdf' || fileName?.endsWith('.pdf')) {
      return { icon: FileText, label: 'PDF Document', color: 'text-red-500' }
    }
    if (contentType === 'application/epub+zip' || fileName?.endsWith('.epub')) {
      return { icon: BookOpen, label: 'EPUB Book', color: 'text-green-500' }
    }
    if (contentType === 'text/plain' || fileName?.endsWith('.txt')) {
      return { icon: FileText, label: 'Text File', color: 'text-gray-500' }
    }
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName?.endsWith('.docx')) {
      return { icon: FileText, label: 'Word Document', color: 'text-blue-500' }
    }
    return { icon: FileText, label: 'Document', color: 'text-gray-400' }
  }

  const { icon: Icon, label, color } = getInfo()

  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </span>
  )
}
