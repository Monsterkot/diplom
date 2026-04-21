import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, UserX, UserCheck } from 'lucide-react'
import { adminApi, getErrorMessage } from '../services/api'
import type { User, UserRole } from '../types'

const roleOptions: UserRole[] = ['user', 'moderator', 'admin']

function AdminUsersPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await adminApi.getUsers({ skip: 0, limit: 100 })
      return response.data
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: UserRole }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const updateBlockMutation = useMutation({
    mutationFn: async ({ userId, isBlocked }: { userId: number; isBlocked: boolean }) =>
      adminApi.updateUserBlock(userId, isBlocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const users = data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-600 mt-1">Manage roles and account access.</p>
      </div>

      {isLoading && <p className="text-gray-500">Loading users...</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: User) => {
                const blockTarget = !user.isBlocked

                return (
                  <tr key={user.id}>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-blue-100 text-blue-700'
                          : user.role === 'moderator'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        user.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {user.isBlocked ? 'blocked' : 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-500" />
                          <select
                            value={user.role}
                            onChange={(e) => updateRoleMutation.mutate({ userId: user.id, role: e.target.value as UserRole })}
                            className="px-3 py-2 text-sm border rounded-lg bg-white"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => updateBlockMutation.mutate({ userId: user.id, isBlocked: blockTarget })}
                          className={`inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg ${
                            user.isBlocked
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {user.isBlocked ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          {user.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminUsersPage
