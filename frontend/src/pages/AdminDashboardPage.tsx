import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Shield, Users, BookOpen, EyeOff, Upload, Globe, ClipboardList } from 'lucide-react'
import { adminApi, getErrorMessage } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function AdminDashboardPage() {
  const { isAdmin, canManageBooks } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await adminApi.getStats()
      return response.data
    },
  })

  const cards = data
    ? [
        { label: 'Users', value: data.totalUsers, icon: Users },
        { label: 'Admins', value: data.adminUsers, icon: Shield },
        { label: 'Moderators', value: data.moderatorUsers, icon: Shield },
        { label: 'Books', value: data.totalBooks, icon: BookOpen },
        { label: 'Hidden Books', value: data.hiddenBooks, icon: EyeOff },
        { label: 'Uploaded', value: data.uploadedBooks, icon: Upload },
        { label: 'Imported', value: data.importedBooks, icon: Globe },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage users, content, and visibility rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{value}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading && <p className="text-gray-500">Loading admin statistics...</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isAdmin && (
          <Link to="/admin/users" className="bg-white border rounded-xl p-5 hover:border-blue-300 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
            <p className="text-gray-600 mt-2">Change roles and block or unblock accounts.</p>
          </Link>
        )}
        {canManageBooks && (
          <Link to="/admin/books" className="bg-white border rounded-xl p-5 hover:border-blue-300 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900">Books</h2>
            <p className="text-gray-600 mt-2">Hide, publish, or delete books from the catalog.</p>
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin/audit-logs" className="bg-white border rounded-xl p-5 hover:border-blue-300 transition-colors">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
            </div>
            <p className="text-gray-600 mt-2">Review role changes, blocking, moderation, and book deletions.</p>
          </Link>
        )}
      </div>
    </div>
  )
}

export default AdminDashboardPage
