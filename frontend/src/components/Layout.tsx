import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Upload, Library, Search, X, Loader2, Globe, LogIn, LogOut, User, ChevronDown } from 'lucide-react'
import { searchApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { SearchSuggestion } from '../types'

function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  const navItems = [
    { path: '/', label: 'Главная', icon: BookOpen },
    { path: '/library', label: 'Библиотека', icon: Library },
    { path: '/search', label: 'Поиск', icon: Search },
    { path: '/external', label: 'Внешние', icon: Globe },
    { path: '/upload', label: 'Загрузить', icon: Upload, requiresAuth: true },
  ]

  // Fetch suggestions on query change
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

  // Close dropdowns on click outside
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
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
      setShowSuggestions(false)
    }
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900 hidden sm:block">
                Литература
              </span>
            </Link>

            {/* Search Bar */}
            <div className="flex-1 max-w-lg mx-4 sm:mx-8" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Поиск книг..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {isSearching ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <X className="h-5 w-5" />
                    )}
                  </button>
                )}

                {/* Suggestions dropdown */}
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
                          <p className="font-medium text-gray-900 truncate">
                            {suggestion.title}
                          </p>
                          {suggestion.author && (
                            <p className="text-sm text-gray-500 truncate">
                              {suggestion.author}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                    <button
                      type="submit"
                      className="w-full px-4 py-3 text-left text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium"
                    >
                      <Search className="h-5 w-5" />
                      Искать "{searchQuery}"
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Navigation + Auth */}
            <div className="flex items-center gap-2">
              {/* Navigation */}
              <nav className="hidden md:flex items-center space-x-1">
                {navItems.map(({ path, label, icon: Icon, requiresAuth }) => {
                  // Hide auth-required items if not authenticated
                  if (requiresAuth && !isAuthenticated) {
                    return null
                  }

                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        location.pathname === path
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Auth section */}
              <div className="flex items-center ml-2 pl-2 border-l border-gray-200">
                {authLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : isAuthenticated && user ? (
                  // User menu
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="hidden sm:block max-w-24 truncate">
                        {user.username}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown menu */}
                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.username}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>

                        {/* Mobile nav items */}
                        <div className="md:hidden py-2 border-b border-gray-100">
                          {navItems.map(({ path, label, icon: Icon, requiresAuth }) => {
                            if (requiresAuth && !isAuthenticated) return null
                            return (
                              <Link
                                key={path}
                                to={path}
                                onClick={() => setShowUserMenu(false)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Icon className="w-4 h-4" />
                                {label}
                              </Link>
                            )
                          })}
                        </div>

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Выйти
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  // Login/Register buttons
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span className="hidden sm:inline">Войти</span>
                    </Link>
                    <Link
                      to="/register"
                      className="hidden sm:flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Регистрация
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 text-sm">
            Система агрегации учебной литературы - Дипломный проект
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
