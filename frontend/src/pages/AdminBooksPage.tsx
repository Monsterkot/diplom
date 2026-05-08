import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Eye, EyeOff, Globe, Tag, Trash2, User, X } from 'lucide-react'
import { adminApi, getErrorMessage } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import type { Book, BookStatus } from '../types'

function AdminBooksPage() {
  const queryClient = useQueryClient()
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState<BookStatus | ''>('')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-books', statusFilter],
    queryFn: async () => {
      const response = await adminApi.getBooks({ skip: 0, limit: 100, status: statusFilter || undefined })
      return response.data
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookId, status }: { bookId: number; status: BookStatus }) => adminApi.updateBookStatus(bookId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-books'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (bookId: number) => adminApi.deleteBook(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-books'] })
      setBookToDelete(null)
    },
  })

  const books = data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.booksModeration')}</h1>
          <p className="text-gray-600 mt-1">{t('admin.booksModerationSubtitle')}</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter((e.target.value as BookStatus | '') || '')} className="px-4 py-2 border rounded-lg bg-white">
          <option value="">{t('admin.allStatuses')}</option>
          <option value="published">{t('admin.published')}</option>
          <option value="hidden">{t('admin.hidden')}</option>
        </select>
      </div>

      {isLoading && <p className="text-gray-500">{t('admin.loadingBooks')}</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.book')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('common.author')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.status')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => {
                const nextStatus: BookStatus = book.status === 'published' ? 'hidden' : 'published'
                return (
                  <tr key={book.id}>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{book.title}</p>
                      <p className="text-sm text-gray-500">#{book.id}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{book.author || t('admin.unknown')}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${book.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {book.status === 'published' ? t('admin.published') : t('admin.hidden')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedBook(book)} className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
                          <Eye className="w-4 h-4" /> {t('admin.details')}
                        </button>
                        <button onClick={() => updateStatusMutation.mutate({ bookId: book.id, status: nextStatus })} className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
                          {book.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {book.status === 'published' ? t('admin.hide') : t('admin.publish')}
                        </button>
                        <button onClick={() => setBookToDelete(book)} className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100">
                          <Trash2 className="w-4 h-4" /> {t('common.delete')}
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

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedBook.title}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('admin.bookId')}: #{selectedBook.id}</p>
              </div>
              <button onClick={() => setSelectedBook(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={t('admin.closeDetails')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('common.description')}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{selectedBook.description || t('admin.noDescription')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('admin.technicalInfo')}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InfoBox label={t('admin.fileName')} value={selectedBook.fileName} />
                    <InfoBox label={t('admin.contentType')} value={selectedBook.contentType || t('admin.unknown')} />
                    <InfoBox label={t('admin.filePath')} value={selectedBook.filePath || t('admin.notAvailable')} />
                    <InfoBox label={t('admin.downloadUrl')} value={selectedBook.downloadUrl || t('admin.notGenerated')} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('admin.metadata')}</h3>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <MetaRow icon={<User className="mt-0.5 h-4 w-4 text-gray-400" />} label={t('common.author')} value={selectedBook.author || t('admin.unknown')} />
                  <MetaRow icon={<Tag className="mt-0.5 h-4 w-4 text-gray-400" />} label={t('common.category')} value={selectedBook.category || t('admin.notSpecified')} />
                  <MetaRow icon={<Globe className="mt-0.5 h-4 w-4 text-gray-400" />} label={t('common.language')} value={selectedBook.language || t('admin.notSpecified')} />
                  <MetaRow icon={<Calendar className="mt-0.5 h-4 w-4 text-gray-400" />} label={t('common.year')} value={String(selectedBook.publishedYear || t('admin.unknown'))} />
                  <InfoLine label={t('common.publisher')} value={selectedBook.publisher || t('admin.notSpecified')} />
                  <InfoLine label={t('common.isbn')} value={selectedBook.isbn || t('admin.notSpecified')} />
                  <InfoLine label={t('admin.uploader')} value={selectedBook.uploadedByUsername || `User #${selectedBook.uploadedById}`} />
                  <InfoLine label={t('admin.status')} value={selectedBook.status === 'published' ? t('admin.published') : t('admin.hidden')} />
                  <InfoLine label={t('admin.visibility')} value={selectedBook.visibility} />
                  <InfoLine label={t('admin.created')} value={new Date(selectedBook.createdAt).toLocaleString()} />
                  <InfoLine label={t('admin.updated')} value={selectedBook.updatedAt ? new Date(selectedBook.updatedAt).toLocaleString() : t('admin.never')} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('admin.deleteBook')}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{t('admin.deleteBookText', { title: bookToDelete.title })}</p>
              </div>
              <button onClick={() => !deleteMutation.isPending && setBookToDelete(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {deleteMutation.error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{getErrorMessage(deleteMutation.error)}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setBookToDelete(null)} disabled={deleteMutation.isPending} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button onClick={() => deleteMutation.mutate(bookToDelete.id)} disabled={deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> {deleteMutation.isPending ? t('admin.deleting') : t('admin.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p>{value}</p>
      </div>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p>{value}</p>
    </div>
  )
}

export default AdminBooksPage
