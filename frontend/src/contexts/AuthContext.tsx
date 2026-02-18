import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi, setAuthToken, clearAuthToken } from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'literature_auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY)
  })
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = !!user && !!token

  // Check authentication on mount
  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY)

    if (!storedToken) {
      setIsLoading(false)
      return
    }

    setAuthToken(storedToken)

    try {
      const response = await authApi.getCurrentUser()
      setUser(response.data)
      setToken(storedToken)
    } catch (error) {
      // Token is invalid or expired
      console.error('Auth check failed:', error)
      localStorage.removeItem(TOKEN_KEY)
      clearAuthToken()
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Login
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)

    try {
      // Get token
      const tokenResponse = await authApi.login(email, password)
      const newToken = tokenResponse.data.access_token

      // Save token
      localStorage.setItem(TOKEN_KEY, newToken)
      setAuthToken(newToken)
      setToken(newToken)

      // Get user info
      const userResponse = await authApi.getCurrentUser()
      setUser(userResponse.data)
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY)
      clearAuthToken()
      setToken(null)
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Register
  const register = useCallback(async (email: string, username: string, password: string) => {
    setIsLoading(true)

    try {
      // Register user
      await authApi.register({ email, username, password })

      // Auto-login after registration
      await login(email, password)
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }, [login])

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    clearAuthToken()
    setToken(null)
    setUser(null)
  }, [])

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    checkAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

export default AuthContext
