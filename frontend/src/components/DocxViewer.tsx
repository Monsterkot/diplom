import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Loader2,
  AlertCircle,
  Minimize,
} from 'lucide-react'
import { booksApi } from '../services/api'
import '../styles/docx-viewer.css'

interface DocxViewerProps {
  url: string
  bookId: number
  title?: string
  onDownload?: () => void
}

interface HtmlContent {
  html: string
  text: string
}

function DocxViewer({ url, bookId, title, onDownload }: DocxViewerProps) {
  const [content, setContent] = useState<HtmlContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch HTML content
  useEffect(() => {
    const fetchHtml = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await booksApi.getBookHtml(bookId)
        console.log('DOCX HTML Response:', response.data)
        
        // Проверка на пустой HTML
        if (!response.data.html || response.data.html.trim() === '') {
          console.warn('Получен пустой HTML от сервера')
          setError('Документ пуст или не удалось конвертировать')
          setIsLoading(false)
          return
        }
        
        setContent(response.data)
      } catch (err) {
        console.error('Error fetching HTML:', err)
        setError('Не удалось загрузить документ. Проверьте, что файл корректный.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchHtml()
  }, [bookId])

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(200, s + 10))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(50, s - 10))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(100)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await containerRef.current.requestFullscreen()
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload()
    } else if (bookId) {
      // Fallback: open download URL
      window.open(`/api/books/${bookId}/file/stream?download=true`, '_blank')
    }
  }, [onDownload, bookId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case '+':
        case '=':
          zoomIn()
          break
        case '-':
          zoomOut()
          break
        case '0':
          resetZoom()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
      }
    },
    [zoomIn, zoomOut, resetZoom, toggleFullscreen]
  )

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border-b px-4 py-2 flex-shrink-0">
        {/* Left: Title */}
        <div className="flex items-center gap-2">
          {title && (
            <span className="text-sm font-medium text-gray-700 truncate max-w-[300px]">
              {title}
            </span>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 50}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Уменьшить (Ctrl + -)"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <button
            onClick={resetZoom}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50 min-w-[60px]"
            title="Сбросить масштаб (Ctrl + 0)"
          >
            {scale}%
          </button>

          <button
            onClick={zoomIn}
            disabled={scale >= 200}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Увеличить (Ctrl + +)"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Скачать документ"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100"
            title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Document view */}
      <div className="flex-grow overflow-auto bg-gray-200 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-700 font-medium">Загрузка документа...</p>
            <p className="text-sm text-gray-500 mt-2">Конвертация DOCX в HTML</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ошибка загрузки</h3>
            <p className="text-gray-600 text-center max-w-md">{error}</p>
          </div>
        ) : content ? (
          <div
            className="docx-content bg-white shadow-lg mx-auto transition-transform duration-200"
            style={{
              transform: `scale(${scale / 100})`,
              transformOrigin: 'top center',
              maxWidth: `${800 * (scale / 100)}px`,
            }}
            dangerouslySetInnerHTML={{ __html: content.html }}
          />
        ) : null}
      </div>

      {/* Status bar */}
      {!isLoading && !error && content && (
        <div className="flex-shrink-0 bg-white border-t px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <span>DOCX Document</span>
          <span>
            {content.text.length.toLocaleString()} символов
          </span>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="hidden md:block absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
        Ctrl + / - : Масштаб | Ctrl + 0 : Сброс | F : Fullscreen
      </div>
    </div>
  )
}

export default DocxViewer
