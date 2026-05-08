import { Globe } from 'lucide-react'
import { languages, useLanguage, type Language } from '../contexts/LanguageContext'

function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <label className="flex items-center gap-1 text-sm text-gray-600" title={t('common.languageSwitcher')}>
      <Globe className="h-4 w-4 text-gray-500" />
      <span className="sr-only">{t('common.languageSwitcher')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={t('common.languageSwitcher')}
      >
        {Object.entries(languages).map(([code, item]) => (
          <option key={code} value={code}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default LanguageSwitcher
