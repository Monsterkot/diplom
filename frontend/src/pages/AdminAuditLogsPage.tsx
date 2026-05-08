import { useQuery } from '@tanstack/react-query'
import { adminApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import type { AuditLogEntry } from '../types'

function formatDetails(details: Record<string, unknown> | null, fallback: string): string {
  if (!details) {
    return fallback
  }

  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ')
}

function AdminAuditLogsPage() {
  const { t } = useLanguage()
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
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.auditLog')}</h1>
        <p className="text-gray-600 mt-1">{t('admin.auditSubtitle')}</p>
      </div>

      {isLoading && <p className="text-gray-500">{t('admin.loadingAudit')}</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.time')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.actor')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.action')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.target')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.detailsColumn')}</th>
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
                      <p className="font-medium text-gray-900">{item.actor?.username || t('admin.system')}</p>
                      <p className="text-sm text-gray-500">{item.actor?.email || t('admin.noActor')}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">{item.action}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {item.entityType} {item.entityId ? `#${item.entityId}` : ''}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{formatDetails(item.details, t('admin.noDetails'))}</td>
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
