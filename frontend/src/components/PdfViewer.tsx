import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Maximize,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Set up PDF.js worker using Vite's URL import
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString()

interface PdfViewerProps {
  url: string
  title?: string
}

function PdfViewer({ url, title }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error)
    setError('Не удалось загрузить документ')
    setIsLoading(false)
  }, [])

  const goToPage = (page: number) => {
    if (numPages) {
      setCurrentPage(Math.max(1, Math.min(page, numPages)))
    }
  }

  const goToPreviousPage = () => goToPage(currentPage - 1)
  const goToNextPage = () => goToPage(currentPage + 1)

  const zoomIn = () => setScale((s) => Math.min(3, s + 0.25))
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25))
  const resetZoom = () => setScale(1.0)

  const rotate = () => setRotation((r) => (r + 90) % 360)

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value)) {
      goToPage(value)
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          goToPreviousPage()
          break
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          goToNextPage()
          break
        case '+':
        case '=':
          zoomIn()
          break
        case '-':
          zoomOut()
          break
      }
    },
    [currentPage, numPages]
  )

  return (
    <div
      className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border-b px-4 py-2 flex-shrink-0">
        {/* Left: Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Предыдущая страница"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1 text-sm">
            <input
              type="number"
              value={currentPage}
              onChange={handlePageInputChange}
              min={1}
              max={numPages || 1}
              className="w-12 text-center border rounded px-1 py-1"
            />
            <span className="text-gray-500">из {numPages || '—'}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={!numPages || currentPage >= numPages}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Следующая страница"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Center: Title */}
        {title && (
          <div className="hidden md:block text-sm font-medium text-gray-700 truncate max-w-[200px]">
            {title}
          </div>
        )}

        {/* Right: Zoom and rotation controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Уменьшить"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <button
            onClick={resetZoom}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50 min-w-[60px]"
            title="Сбросить масштаб"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Увеличить"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <button
            onClick={rotate}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Повернуть"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          <button
            onClick={() => {
              const elem = document.documentElement
              if (document.fullscreenElement) {
                document.exitFullscreen()
              } else {
                elem.requestFullscreen()
              }
            }}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Полноэкранный режим"
          >
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Document view */}
      <div className="flex-grow overflow-auto flex items-start justify-center p-4">
        {error ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ошибка загрузки</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600">Загрузка документа...</p>
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              rotate={rotation}
              loading={
                <div className="flex items-center justify-center w-[595px] h-[842px] bg-white">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
              }
              className="shadow-lg"
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        )}
      </div>

      {/* Quick page navigation */}
      {numPages && numPages > 1 && (
        <div className="flex-shrink-0 bg-white border-t px-4 py-2">
          <input
            type="range"
            min={1}
            max={numPages}
            value={currentPage}
            onChange={(e) => goToPage(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      )}
    </div>
  )
}

export default PdfViewer
