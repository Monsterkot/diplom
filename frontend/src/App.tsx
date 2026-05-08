import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import UploadPage from './pages/UploadPage'
import ReaderPage from './pages/ReaderPage'
import ExternalSearchPage from './pages/ExternalSearchPage'
import SearchResultsPage from './pages/SearchResultsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminBooksPage from './pages/AdminBooksPage'
import AdminAuditLogsPage from './pages/AdminAuditLogsPage'
import AdminServiceCredentialsPage from './pages/AdminServiceCredentialsPage'

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
          {/* Public routes */}
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* Protected routes - require authentication */}
          <Route
            path="library"
            element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="search"
            element={
              <ProtectedRoute>
                <SearchResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="external"
            element={
              <ProtectedRoute>
                <ExternalSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reader/:bookId"
            element={
              <ProtectedRoute>
                <ReaderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="upload"
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredRole={['moderator', 'admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/books"
            element={
              <ProtectedRoute requiredRole={['moderator', 'admin']}>
                <AdminBooksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit-logs"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminAuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/service-credentials"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminServiceCredentialsPage />
              </ProtectedRoute>
            }
          />
          </Route>
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App
