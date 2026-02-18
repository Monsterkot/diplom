import { useState, useMemo } from 'react'
import type { SearchFacets } from '../types'

interface SearchFiltersProps {
  facets: SearchFacets
  activeFilters: {
    category?: string
    author?: string
    language?: string
    contentType?: string
    yearFrom?: number
    yearTo?: number
  }
  onFilterChange: (filterType: string, value: string | undefined) => void
}

// Language code to name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pl: 'Polski',
  zh: '中文',
  ja: '日本語',
}

// Content type labels
const CONTENT_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/epub+zip': 'EPUB',
  'text/plain': 'TXT',
}

// Filter section component
const FilterSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-gray-200 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2 text-left font-medium text-gray-900"
      >
        {title}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  )
}

// Facet list with "show more" functionality
const FacetList = ({
  items,
  selected,
  onSelect,
  getLabel,
  maxVisible = 5,
}: {
  items: [string, number][]
  selected?: string
  onSelect: (value: string | undefined) => void
  getLabel?: (value: string) => string
  maxVisible?: number
}) => {
  const [showAll, setShowAll] = useState(false)

  const visibleItems = showAll ? items : items.slice(0, maxVisible)
  const hasMore = items.length > maxVisible

  return (
    <div className="space-y-1">
      {visibleItems.map(([value, count]) => (
        <label
          key={value}
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 ${
            selected === value ? 'bg-blue-50 text-blue-700' : ''
          }`}
        >
          <input
            type="radio"
            name="facet"
            checked={selected === value}
            onChange={() => onSelect(selected === value ? undefined : value)}
            className="sr-only"
          />
          <span className="flex-1 text-sm truncate">
            {getLabel ? getLabel(value) : value}
          </span>
          <span className="text-xs text-gray-400">{count}</span>
        </label>
      ))}

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1"
        >
          {showAll ? 'Свернуть' : `Показать все (${items.length})`}
        </button>
      )}

      {selected && (
        <button
          onClick={() => onSelect(undefined)}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Сбросить
        </button>
      )}
    </div>
  )
}

const SearchFilters = ({ facets, activeFilters, onFilterChange }: SearchFiltersProps) => {
  // Sort facets by count
  const sortedCategories = useMemo(() => {
    if (!facets.category) return []
    return Object.entries(facets.category).sort((a, b) => b[1] - a[1])
  }, [facets.category])

  const sortedAuthors = useMemo(() => {
    if (!facets.author) return []
    return Object.entries(facets.author).sort((a, b) => b[1] - a[1])
  }, [facets.author])

  const sortedLanguages = useMemo(() => {
    if (!facets.language) return []
    return Object.entries(facets.language).sort((a, b) => b[1] - a[1])
  }, [facets.language])

  const sortedContentTypes = useMemo(() => {
    if (!facets.contentType) return []
    return Object.entries(facets.contentType).sort((a, b) => b[1] - a[1])
  }, [facets.contentType])

  const sortedYears = useMemo(() => {
    if (!facets.publishedYear) return []
    return Object.entries(facets.publishedYear).sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
  }, [facets.publishedYear])

  // Get year range for slider
  const yearRange = useMemo(() => {
    if (sortedYears.length === 0) return { min: 1900, max: new Date().getFullYear() }
    const years = sortedYears.map(([year]) => parseInt(year))
    return {
      min: Math.min(...years),
      max: Math.max(...years),
    }
  }, [sortedYears])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Фильтры</h2>

      {/* Category filter */}
      {sortedCategories.length > 0 && (
        <FilterSection title="Категория">
          <FacetList
            items={sortedCategories}
            selected={activeFilters.category}
            onSelect={(value) => onFilterChange('category', value)}
          />
        </FilterSection>
      )}

      {/* File type filter */}
      {sortedContentTypes.length > 0 && (
        <FilterSection title="Тип файла">
          <FacetList
            items={sortedContentTypes}
            selected={activeFilters.contentType}
            onSelect={(value) => onFilterChange('type', value)}
            getLabel={(value) => CONTENT_TYPE_LABELS[value] || value}
          />
        </FilterSection>
      )}

      {/* Language filter */}
      {sortedLanguages.length > 0 && (
        <FilterSection title="Язык">
          <FacetList
            items={sortedLanguages}
            selected={activeFilters.language}
            onSelect={(value) => onFilterChange('language', value)}
            getLabel={(value) => LANGUAGE_NAMES[value] || value.toUpperCase()}
          />
        </FilterSection>
      )}

      {/* Author filter */}
      {sortedAuthors.length > 0 && (
        <FilterSection title="Автор" defaultOpen={false}>
          <FacetList
            items={sortedAuthors}
            selected={activeFilters.author}
            onSelect={(value) => onFilterChange('author', value)}
            maxVisible={10}
          />
        </FilterSection>
      )}

      {/* Year range filter */}
      {sortedYears.length > 0 && (
        <FilterSection title="Год издания" defaultOpen={false}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="От"
                value={activeFilters.yearFrom || ''}
                onChange={(e) => onFilterChange('yearFrom', e.target.value || undefined)}
                min={yearRange.min}
                max={yearRange.max}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400">—</span>
              <input
                type="number"
                placeholder="До"
                value={activeFilters.yearTo || ''}
                onChange={(e) => onFilterChange('yearTo', e.target.value || undefined)}
                min={yearRange.min}
                max={yearRange.max}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Popular years */}
            <div className="flex flex-wrap gap-1">
              {sortedYears.slice(0, 5).map(([year, count]) => (
                <button
                  key={year}
                  onClick={() => {
                    onFilterChange('yearFrom', year)
                    onFilterChange('yearTo', year)
                  }}
                  className={`px-2 py-0.5 text-xs rounded border ${
                    activeFilters.yearFrom === parseInt(year) && activeFilters.yearTo === parseInt(year)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {year} ({count})
                </button>
              ))}
            </div>

            {(activeFilters.yearFrom || activeFilters.yearTo) && (
              <button
                onClick={() => {
                  onFilterChange('yearFrom', undefined)
                  onFilterChange('yearTo', undefined)
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Сбросить
              </button>
            )}
          </div>
        </FilterSection>
      )}

      {/* No facets message */}
      {sortedCategories.length === 0 &&
        sortedAuthors.length === 0 &&
        sortedLanguages.length === 0 &&
        sortedContentTypes.length === 0 && (
          <p className="text-sm text-gray-500 py-4">
            Выполните поиск, чтобы увидеть доступные фильтры
          </p>
        )}
    </div>
  )
}

export default SearchFilters
