import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { adminApi, getErrorMessage } from '../services/api'
import type { BookStatus } from '../types'

function AdminBooksPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<BookStatus | ''>('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-books', statusFilter],
    queryFn: async () => {
      const response = await adminApi.getBooks({
        skip: 0,
        limit: 100,
        status: statusFilter || undefined,
      })
      return response.data
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ bookId, status }: { bookId: number; status: BookStatus }) =>
      adminApi.updateBookStatus(bookId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-books'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (bookId: number) => adminApi.deleteBook(bookId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-books'] }),
  })

  const books = data?.items ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books Moderation</h1>
          <p className="text-gray-600 mt-1">Control book visibility and remove content from the catalog.</p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target.value as BookStatus | '') || '')}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {isLoading && <p className="text-gray-500">Loading books...</p>}
      {error && <p className="text-red-600">{getErrorMessage(error)}</p>}

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Book</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Author</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => {
                const nextStatus: BookStatus = book.status === 'published' ? 'hidden' : 'published'

                return (
                  <tr key={book.id}>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{book.title}</p>
                        <p className="text-sm text-gray-500">#{book.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{book.author || 'Unknown'}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        book.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {book.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => updateStatusMutation.mutate({ bookId: book.id, status: nextStatus })}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          {book.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {book.status === 'published' ? 'Hide' : 'Publish'}
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(book.id)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
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

export default AdminBooksPage
