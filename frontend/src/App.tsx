import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
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

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Public routes */}
          <Route index element={<HomePage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="search" element={<SearchResultsPage />} />
          <Route path="external" element={<ExternalSearchPage />} />
          <Route path="reader/:bookId" element={<ReaderPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* Protected routes - require authentication */}
          <Route
            path="upload"
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
