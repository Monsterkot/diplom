import { BookOpen, FileText, AlertCircle, Download } from 'lucide-react'
import PdfViewer from './PdfViewer'
import EpubViewer from './EpubViewer'
import DocxViewer from './DocxViewer'
import { useLanguage } from '../contexts/LanguageContext'

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
  const { t } = useLanguage()

  const getFileType = (): FileType => {
    if (contentType === 'application/pdf') return 'pdf'
    if (contentType === 'application/epub+zip') return 'epub'
    if (contentType === 'text/plain') return 'txt'
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'

    const ext = fileName?.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return 'pdf'
    if (ext === 'epub') return 'epub'
    if (ext === 'txt') return 'txt'
    if (ext === 'docx') return 'docx'

    return 'unknown'
  }

  const fileType = getFileType()

  if (fileType === 'pdf') {
    return <PdfViewer url={url} title={title} />
  }

  if (fileType === 'epub') {
    return <EpubViewer url={url} title={title} />
  }

  if (fileType === 'docx') {
    if (!bookId) {
      const bookIdMatch = url.match(/\/books\/(\d+)/)
      bookId = bookIdMatch ? parseInt(bookIdMatch[1], 10) : undefined
    }
    if (bookId) {
      return <DocxViewer url={url} bookId={bookId} title={title} onDownload={onDownload} />
    }
  }

  if (fileType === 'txt') {
    return (
      <div className="flex flex-col h-full bg-white rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between bg-gray-50 border-b px-4 py-2">
          <span className="text-sm font-medium text-gray-700 truncate">{title || t('reader.textFile')}</span>
          {onDownload && (
            <button onClick={onDownload} className="flex items-center gap-1 px-3 py-1 text-sm text-[#008A5E] hover:bg-[#DAF3E6] rounded">
              <Download className="h-4 w-4" />
              {t('reader.download')}
            </button>
          )}
        </div>
        <iframe src={url} title={title || t('reader.textFile')} className="flex-grow w-full bg-white" style={{ minHeight: '500px' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg border p-8 text-center">
      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="h-10 w-10 text-yellow-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{t('reader.previewNotAvailable')}</h3>
      <p className="text-gray-600 mb-6 max-w-md">{t('reader.unsupportedFile', { type: contentType || t('admin.unknown') })}</p>
      {onDownload && (
        <button onClick={onDownload} className="flex items-center gap-2 px-6 py-3 bg-[#008A5E] text-white rounded-lg hover:bg-[#016646] transition-colors">
          <Download className="h-5 w-5" />
          {t('reader.downloadFile')}
        </button>
      )}
    </div>
  )
}

export default Reader

export function FileTypeInfo({ contentType, fileName }: { contentType: string; fileName?: string }) {
  const { t } = useLanguage()

  const getInfo = () => {
    if (contentType === 'application/pdf' || fileName?.endsWith('.pdf')) {
      return { icon: FileText, label: t('reader.pdfDocument'), color: 'text-red-500' }
    }
    if (contentType === 'application/epub+zip' || fileName?.endsWith('.epub')) {
      return { icon: BookOpen, label: t('reader.epubBook'), color: 'text-green-500' }
    }
    if (contentType === 'text/plain' || fileName?.endsWith('.txt')) {
      return { icon: FileText, label: t('reader.textFile'), color: 'text-gray-500' }
    }
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName?.endsWith('.docx')) {
      return { icon: FileText, label: t('reader.wordDocument'), color: 'text-sky-500' }
    }
    return { icon: FileText, label: t('reader.document'), color: 'text-gray-400' }
  }

  const { icon: Icon, label, color } = getInfo()

  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm">{label}</span>
    </span>
  )
}
