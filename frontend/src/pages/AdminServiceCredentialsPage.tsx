import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Database, HardDrive, KeyRound, Link as LinkIcon, Server } from 'lucide-react'
import { adminApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'

const iconMap = {
  web: HardDrive,
  api_key: KeyRound,
  database: Database,
  redis: Server,
} as const

function AdminServiceCredentialsPage() {
  const { t } = useLanguage()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-service-credentials'],
    queryFn: async () => {
      const response = await adminApi.getServiceCredentials()
      return response.data
    },
  })

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value)
  }

  const services = data?.items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.serviceCredentials')}</h1>
        <p className="mt-1 text-gray-600">
          {t('admin.serviceCredentialsSubtitle')}
        </p>
      </div>

      {isLoading && <p className="text-gray-500">{t('admin.loadingServiceCredentials')}</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="grid gap-4">
        {services.map((service) => {
          const Icon = iconMap[service.accessType as keyof typeof iconMap] || HardDrive

          return (
            <section key={service.serviceName} className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{service.serviceName}</h2>
                    <p className="mt-1 text-sm text-gray-600">{service.description}</p>
                  </div>
                </div>
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-600">
                  {service.accessType}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {service.url && (
                  <CredentialRow
                    label="URL"
                    value={service.url}
                    icon={<LinkIcon className="h-4 w-4 text-gray-400" />}
                    onCopy={handleCopy}
                  />
                )}
                {service.username && (
                  <CredentialRow
                    label={t('admin.username')}
                    value={service.username}
                    icon={<KeyRound className="h-4 w-4 text-gray-400" />}
                    onCopy={handleCopy}
                  />
                )}
                {service.password && (
                  <CredentialRow
                    label={service.accessType === 'api_key' ? t('admin.masterKey') : t('admin.password')}
                    value={service.password}
                    icon={<KeyRound className="h-4 w-4 text-gray-400" />}
                    onCopy={handleCopy}
                    secret
                  />
                )}
                {service.database && (
                  <CredentialRow
                    label={t('admin.database')}
                    value={service.database}
                    icon={<Database className="h-4 w-4 text-gray-400" />}
                    onCopy={handleCopy}
                  />
                )}
              </div>

              {service.notes && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {service.notes}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {!isLoading && !error && services.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white px-6 py-10 text-center text-gray-500">
          {t('admin.noServiceCredentials')}
        </div>
      )}
    </div>
  )
}

interface CredentialRowProps {
  label: string
  value: string
  icon: ReactNode
  onCopy: (value: string) => Promise<void>
  secret?: boolean
}

function CredentialRow({ label, value, icon, onCopy, secret = false }: CredentialRowProps) {
  const { t } = useLanguage()
  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          {icon}
          <span>{label}</span>
        </div>
        <button
          onClick={() => onCopy(value)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          <Copy className="h-3.5 w-3.5" />
          {t('admin.copy')}
        </button>
      </div>
      <div className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-gray-900">
        {secret ? value : value}
      </div>
    </div>
  )
}

export default AdminServiceCredentialsPage
