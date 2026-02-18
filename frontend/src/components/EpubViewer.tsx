import { useEffect, useRef, useState, useCallback } from 'react'
import ePub, { Book, Rendition, NavItem } from 'epubjs'
import {
  ChevronLeft,
  ChevronRight,
  List,
  ZoomIn,
  ZoomOut,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react'

interface EpubViewerProps {
  url: string
  title?: string
}

interface TocItem {
  id: string
  href: string
  label: string
  subitems?: TocItem[]
}

function EpubViewer({ url, title }: EpubViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState<string>('Загрузка файла...')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(false)
  const [fontSize, setFontSize] = useState(100)

  // Initialize book
  useEffect(() => {
    if (!viewerRef.current) return

    setIsLoading(true)
    setError(null)
    setDownloadProgress(0)
    setLoadingStatus('Загрузка файла...')

    let isDestroyed = false
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null
    const abortController = new AbortController()

    // Set loading timeout (60 seconds for large files)
    loadingTimeout = setTimeout(() => {
      if (isDestroyed) return
      setError('Превышено время загрузки. Файл может быть повреждён или слишком большой.')
      setIsLoading(false)
    }, 60000)

    // Fetch EPUB as ArrayBuffer with progress tracking
    const loadBook = async () => {
      try {
        const response = await fetch(url, { signal: abortController.signal })
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        // Get content length for progress tracking
        const contentLength = response.headers.get('Content-Length')
        const total = contentLength ? parseInt(contentLength, 10) : 0

        if (!response.body) {
          throw new Error('ReadableStream not supported')
        }

        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let receivedLength = 0

        // Read the stream with progress updates
        while (true) {
          if (isDestroyed) {
            reader.cancel()
            return
          }
          const { done, value } = await reader.read()
          if (done) break

          chunks.push(value)
          receivedLength += value.length

          if (total > 0) {
            const percent = Math.round((receivedLength / total) * 100)
            setDownloadProgress(percent)
            setLoadingStatus(`Загрузка файла... ${percent}%`)
          } else {
            setLoadingStatus(`Загрузка... ${(receivedLength / 1024 / 1024).toFixed(1)} MB`)
          }
        }

        if (isDestroyed) return

        // Combine chunks into ArrayBuffer
        const arrayBuffer = new Uint8Array(receivedLength)
        let position = 0
        for (const chunk of chunks) {
          arrayBuffer.set(chunk, position)
          position += chunk.length
        }

        setLoadingStatus('Обработка книги...')

        const book = ePub(arrayBuffer.buffer)
        bookRef.current = book

        await book.ready

        if (isDestroyed || !viewerRef.current) return

        setLoadingStatus('Подготовка отображения...')

        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
        })

        renditionRef.current = rendition

        // Apply initial font size
        rendition.themes.fontSize(`${fontSize}%`)

        // Set light theme
        rendition.themes.default({
          body: {
            'font-family': '"Georgia", serif',
            'line-height': '1.6',
            'padding': '20px',
            'background': '#fff',
            'color': '#333',
          },
          'a': {
            'color': '#2563eb',
          },
        })

        // Handle keyboard navigation
        rendition.on('keyup', (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            rendition.prev()
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
            rendition.next()
          }
        })

        // Wait for the book to actually display before hiding loading
        rendition.on('displayed', () => {
          if (isDestroyed) return
          if (loadingTimeout) {
            clearTimeout(loadingTimeout)
            loadingTimeout = null
          }
          setIsLoading(false)

          // Force resize and re-render to fix rendering issue where content is not visible
          setTimeout(() => {
            if (renditionRef.current && viewerRef.current) {
              const { width, height } = viewerRef.current.getBoundingClientRect()
              renditionRef.current.resize(width, height)

              // Force re-render by going to next and back
              renditionRef.current.next().then(() => {
                renditionRef.current?.prev()
              }).catch(() => {
                // Ignore errors - just trying to force refresh
              })
            }
          }, 200)
        })

        // Load table of contents
        let firstHref: string | null = null
        try {
          const nav = await book.loaded.navigation
          if (isDestroyed) return
          const tocItems = nav.toc.map((item: NavItem): TocItem => ({
            id: item.id,
            href: item.href,
            label: item.label,
            subitems: item.subitems?.map((sub: NavItem): TocItem => ({
              id: sub.id,
              href: sub.href,
              label: sub.label,
            })),
          }))
          setToc(tocItems)

          // Get first href from TOC
          if (tocItems.length > 0 && tocItems[0].href) {
            firstHref = tocItems[0].href
          }
        } catch (navErr) {
          console.error('Error loading navigation:', navErr)
        }

        // Display first page using spine
        try {
          // Get the first spine item's CFI or href
          // @ts-ignore - accessing spine internals
          const spine = book.spine
          let displayed = false

          // Try method 1: Use spine.first() if available
          // @ts-ignore
          if (spine?.first && typeof spine.first === 'function') {
            const firstItem = spine.first()
            if (firstItem?.href) {
              await rendition.display(firstItem.href)
              displayed = true
            }
          }

          // Try method 2: Use spineItems array
          if (!displayed) {
            // @ts-ignore
            const spineItems = spine?.spineItems || spine?.items || []
            if (spineItems.length > 0) {
              const firstItem = spineItems[0]
              if (firstItem?.href) {
                await rendition.display(firstItem.href)
                displayed = true
              } else if (firstItem?.url) {
                await rendition.display(firstItem.url)
                displayed = true
              }
            }
          }

          // Try method 3: Use TOC first item
          if (!displayed && firstHref) {
            await rendition.display(firstHref)
            displayed = true
          }

          // Fallback: just display without params
          if (!displayed) {
            await rendition.display()
          }
        } catch (displayErr) {
          console.error('Error displaying first page:', displayErr)
          // Final fallback
          try {
            await rendition.display()
          } catch (e) {
            console.error('Final display fallback failed:', e)
          }
        }

      } catch (err) {
        if (isDestroyed) return
        // Don't show error if request was aborted (component unmounted)
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Error loading EPUB:', err)
        setError('Не удалось загрузить EPUB файл. Проверьте, что файл корректный.')
        setIsLoading(false)
        if (loadingTimeout) {
          clearTimeout(loadingTimeout)
        }
      }
    }

    loadBook()

    return () => {
      isDestroyed = true
      abortController.abort()
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
      if (renditionRef.current) {
        renditionRef.current.destroy()
        renditionRef.current = null
      }
      if (bookRef.current) {
        bookRef.current.destroy()
        bookRef.current = null
      }
    }
  }, [url])

  // Handle container resize
  useEffect(() => {
    if (!viewerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (renditionRef.current && viewerRef.current) {
        const { width, height } = viewerRef.current.getBoundingClientRect()
        if (width > 0 && height > 0) {
          renditionRef.current.resize(width, height)
        }
      }
    })

    resizeObserver.observe(viewerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // Update font size when changed
  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`)
    }
  }, [fontSize])

  const goToPrev = useCallback(() => {
    renditionRef.current?.prev()
  }, [])

  const goToNext = useCallback(() => {
    renditionRef.current?.next()
  }, [])

  const goToHref = useCallback((href: string) => {
    renditionRef.current?.display(href)
    setShowToc(false)
  }, [])

  const increaseFontSize = () => {
    setFontSize((prev) => Math.min(200, prev + 10))
  }

  const decreaseFontSize = () => {
    setFontSize((prev) => Math.max(50, prev - 10))
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case 'ArrowLeft':
          goToPrev()
          break
        case 'ArrowRight':
          goToNext()
          break
        case '+':
        case '=':
          increaseFontSize()
          break
        case '-':
          decreaseFontSize()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToPrev, goToNext])

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border-b px-4 py-2 flex-shrink-0">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            onClick={goToNext}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowToc(!showToc)}
            className={`p-2 rounded-lg ${showToc ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title="Table of contents"
          >
            <List className="h-5 w-5" />
          </button>
        </div>

        {/* Center: Title */}
        <div className="flex items-center">
          {title && (
            <span className="text-sm font-medium text-gray-700 truncate max-w-[300px]">
              {title}
            </span>
          )}
        </div>

        {/* Right: Font size controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={decreaseFontSize}
            disabled={fontSize <= 50}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Decrease font size"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          <span className="px-2 text-sm min-w-[50px] text-center">{fontSize}%</span>

          <button
            onClick={increaseFontSize}
            disabled={fontSize >= 200}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Increase font size"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-grow relative overflow-hidden">
        {/* Table of contents sidebar */}
        {showToc && (
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r shadow-lg z-10 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium text-gray-900">Contents</h3>
              <button
                onClick={() => setShowToc(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="p-2">
              {toc.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => goToHref(item.href)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded truncate"
                  >
                    {item.label}
                  </button>
                  {item.subitems && item.subitems.length > 0 && (
                    <div className="ml-4">
                      {item.subitems.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => goToHref(sub.href)}
                          className="w-full text-left px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded truncate"
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-700 font-medium mb-2">{loadingStatus}</p>
            {downloadProgress > 0 && (
              <div className="w-64 bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}
            <p className="text-sm text-gray-500">Пожалуйста, подождите...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ошибка загрузки EPUB</h3>
            <p className="text-gray-600 text-center max-w-md">{error}</p>
          </div>
        )}

        {/* EPUB viewer container */}
        <div
          ref={viewerRef}
          className="w-full h-full bg-white"
          style={{ display: isLoading || error ? 'none' : 'block' }}
        />

        {/* Navigation overlay buttons */}
        {!isLoading && !error && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-0 top-0 bottom-0 w-16 opacity-0 hover:opacity-100 bg-gradient-to-r from-black/10 to-transparent flex items-center justify-start pl-2 transition-opacity"
              title="Previous"
            >
              <ChevronLeft className="h-8 w-8 text-gray-500" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-0 top-0 bottom-0 w-16 opacity-0 hover:opacity-100 bg-gradient-to-l from-black/10 to-transparent flex items-center justify-end pr-2 transition-opacity"
              title="Next"
            >
              <ChevronRight className="h-8 w-8 text-gray-500" />
            </button>
          </>
        )}
      </div>

    </div>
  )
}

export default EpubViewer
