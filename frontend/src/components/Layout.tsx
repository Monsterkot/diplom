import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Upload,
  Library,
  Search,
  X,
  Loader2,
  Globe,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  Shield,
} from 'lucide-react'
import { searchApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'
import type { SearchSuggestion, UserRole } from '../types'

type NavItem = {
  path: string
  label: string
  icon: typeof BookOpen
  requiresAuth?: boolean
  requiredRole?: UserRole | UserRole[]
}

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const { t } = useLanguage()

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const navItems: NavItem[] = [
    { path: '/', label: t('nav.home'), icon: BookOpen },
    { path: '/library', label: t('nav.library'), icon: Library },
    { path: '/search', label: t('nav.search'), icon: Search },
    { path: '/external', label: t('nav.external'), icon: Globe },
    { path: '/upload', label: t('nav.upload'), icon: Upload, requiresAuth: true },
    { path: '/admin', label: t('nav.admin'), icon: Shield, requiresAuth: true, requiredRole: ['moderator', 'admin'] },
  ]

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (searchQuery.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await searchApi.suggest(searchQuery)
        setSuggestions(response.data.suggestions)
        setShowSuggestions(true)
      } catch (error) {
        console.error('Search suggestion error:', error)
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      return
    }

    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchQuery('')
    setShowSuggestions(false)
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    navigate(`/reader/${suggestion.id}`)
    setSearchQuery('')
    setShowSuggestions(false)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
    navigate('/')
  }

  const canSeeNavItem = (item: NavItem) => {
    if (item.requiresAuth && !isAuthenticated) {
      return false
    }
    if (item.requiredRole) {
      const allowedRoles = Array.isArray(item.requiredRole) ? item.requiredRole : [item.requiredRole]
      if (!user || !allowedRoles.includes(user.role)) {
        return false
      }
    }
    return true
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                Literature
              </span>
            </Link>

            <div className="flex-1 max-w-lg mx-4 sm:mx-8" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={t('nav.searchPlaceholder')}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
                  </button>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                      >
                        <BookOpen className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{suggestion.title}</p>
                          {suggestion.author && (
                            <p className="text-sm text-gray-500 truncate">{suggestion.author}</p>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      type="submit"
                      className="w-full px-4 py-3 text-left text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium"
                    >
                      <Search className="h-5 w-5" />
                      {t('nav.searchFor', { query: searchQuery })}
                    </button>
                  </div>
                )}
              </form>
            </div>

            <div className="flex items-center gap-2">
              <nav className="hidden md:flex items-center space-x-1">
                {navItems.filter(canSeeNavItem).map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === path ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>

              <div className="flex items-center ml-2 pl-2 border-l border-gray-200">
                {authLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : isAuthenticated && user ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setShowUserMenu((prev) => !prev)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="hidden sm:block max-w-24 truncate">{user.username}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          <p className="text-xs text-blue-600 mt-1 uppercase">{user.role}</p>
                        </div>

                        <div className="md:hidden py-2 border-b border-gray-100">
                          {navItems.filter(canSeeNavItem).map(({ path, label, icon: Icon }) => (
                            <Link
                              key={path}
                              to={path}
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Icon className="w-4 h-4" />
                              {label}
                            </Link>
                          ))}
                        </div>

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          {t('nav.logout')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('nav.login')}</span>
                    </Link>
                    <Link
                      to="/register"
                      className="hidden sm:flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      {t('nav.register')}
                    </Link>
                  </div>
                )}
              </div>
              <div className="ml-2 pl-2 border-l border-gray-200">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 text-sm">
            {t('nav.footer')}
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
