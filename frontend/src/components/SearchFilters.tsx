import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SearchFacets } from '../types'
import { useLanguage } from '../contexts/LanguageContext'

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

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
  de: 'Deutsch',
  fr: 'Francais',
  es: 'Espanol',
  it: 'Italiano',
  pl: 'Polski',
  zh: 'Chinese',
  ja: 'Japanese',
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/epub+zip': 'EPUB',
  'text/plain': 'TXT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
}

const FilterSection = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
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
  const { t } = useLanguage()
  const [showAll, setShowAll] = useState(false)

  const visibleItems = showAll ? items : items.slice(0, maxVisible)
  const hasMore = items.length > maxVisible

  return (
    <div className="space-y-1">
      {visibleItems.map(([value, count]) => (
        <label
          key={value}
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 ${
            selected === value ? 'bg-[#DAF3E6] text-[#016646]' : ''
          }`}
        >
          <input
            type="radio"
            name="facet"
            checked={selected === value}
            onChange={() => onSelect(selected === value ? undefined : value)}
            className="sr-only"
          />
          <span className="flex-1 text-sm truncate">{getLabel ? getLabel(value) : value}</span>
          <span className="text-xs text-gray-400">{count}</span>
        </label>
      ))}

      {hasMore && (
        <button onClick={() => setShowAll(!showAll)} className="text-sm text-[#008A5E] hover:text-[#016646] px-2 py-1">
          {showAll ? t('search.collapse') : t('search.showAll', { count: items.length })}
        </button>
      )}

      {selected && (
        <button onClick={() => onSelect(undefined)} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1">
          {t('common.reset')}
        </button>
      )}
    </div>
  )
}

const SearchFilters = ({ facets, activeFilters, onFilterChange }: SearchFiltersProps) => {
  const { t } = useLanguage()

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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('search.filters')}</h2>

      {sortedCategories.length > 0 && (
        <FilterSection title={t('search.category')}>
          <FacetList items={sortedCategories} selected={activeFilters.category} onSelect={(value) => onFilterChange('category', value)} />
        </FilterSection>
      )}

      {sortedContentTypes.length > 0 && (
        <FilterSection title={t('search.fileType')}>
          <FacetList
            items={sortedContentTypes}
            selected={activeFilters.contentType}
            onSelect={(value) => onFilterChange('type', value)}
            getLabel={(value) => CONTENT_TYPE_LABELS[value] || value}
          />
        </FilterSection>
      )}

      {sortedLanguages.length > 0 && (
        <FilterSection title={t('search.language')}>
          <FacetList
            items={sortedLanguages}
            selected={activeFilters.language}
            onSelect={(value) => onFilterChange('language', value)}
            getLabel={(value) => LANGUAGE_NAMES[value] || value.toUpperCase()}
          />
        </FilterSection>
      )}

      {sortedAuthors.length > 0 && (
        <FilterSection title={t('search.author')} defaultOpen={false}>
          <FacetList items={sortedAuthors} selected={activeFilters.author} onSelect={(value) => onFilterChange('author', value)} maxVisible={10} />
        </FilterSection>
      )}

      {sortedYears.length > 0 && (
        <FilterSection title={t('search.publicationYear')} defaultOpen={false}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder={t('search.from')}
                value={activeFilters.yearFrom || ''}
                onChange={(e) => onFilterChange('yearFrom', e.target.value || undefined)}
                min={yearRange.min}
                max={yearRange.max}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#008A5E]"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                placeholder={t('search.to')}
                value={activeFilters.yearTo || ''}
                onChange={(e) => onFilterChange('yearTo', e.target.value || undefined)}
                min={yearRange.min}
                max={yearRange.max}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#008A5E]"
              />
            </div>

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
                      ? 'bg-[#DAF3E6] border-[#008A5E] text-[#016646]'
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
                {t('common.reset')}
              </button>
            )}
          </div>
        </FilterSection>
      )}

      {sortedCategories.length === 0 &&
        sortedAuthors.length === 0 &&
        sortedLanguages.length === 0 &&
        sortedContentTypes.length === 0 && <p className="text-sm text-gray-500 py-4">{t('search.noFacets')}</p>}
    </div>
  )
}

export default SearchFilters
