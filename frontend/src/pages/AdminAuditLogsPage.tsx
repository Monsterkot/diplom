import { useQuery } from '@tanstack/react-query'
import { adminApi, getErrorMessage } from '../services/api'
import type { AuditLogEntry } from '../types'

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) {
    return 'No details'
  }

  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ')
}

function AdminAuditLogsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const response = await adminApi.getAuditLogs({ skip: 0, limit: 100 })
      return response.data
    },
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-gray-600 mt-1">Administrative and moderation actions across users and books.</p>
      </div>

      {isLoading && <p className="text-gray-500">Loading audit log...</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item: AuditLogEntry) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.actor?.username || 'system'}</p>
                      <p className="text-sm text-gray-500">{item.actor?.email || 'No actor'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">{item.action}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {item.entityType} {item.entityId ? `#${item.entityId}` : ''}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{formatDetails(item.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminAuditLogsPage
