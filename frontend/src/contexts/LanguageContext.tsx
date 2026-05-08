import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  LANGUAGE_STORAGE_KEY,
  interpolate,
  languages,
  translations,
  type Language,
} from '../i18n/translations'

type TranslationParams = Record<string, string | number>

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, params?: TranslationParams) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'ru'
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'en' || stored === 'ru' ? stored : 'ru'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string, params?: TranslationParams) => {
      const template = translations[language][key] ?? translations.ru[key] ?? key
      return interpolate(template, params)
    }

    return {
      language,
      setLanguage: setLanguageState,
      t,
    }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export { languages }
export type { Language }
