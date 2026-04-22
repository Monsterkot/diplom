import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Eye, EyeOff, Globe, Tag, Trash2, User, X } from 'lucide-react'
import { adminApi, getErrorMessage } from '../services/api'
import type { Book, BookStatus } from '../types'

function AdminBooksPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<BookStatus | ''>('')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null)

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
                          onClick={() => setSelectedBook(book)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                        <button
                          onClick={() => updateStatusMutation.mutate({ bookId: book.id, status: nextStatus })}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          {book.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {book.status === 'published' ? 'Hide' : 'Publish'}
                        </button>
                        <button
                          onClick={() => setBookToDelete(book)}
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

      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedBook.title}</h2>
                <p className="mt-1 text-sm text-gray-500">Book ID: #{selectedBook.id}</p>
              </div>
              <button
                onClick={() => setSelectedBook(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-5 md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Description</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {selectedBook.description || 'No description provided.'}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Technical Info</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">File name</p>
                      <p className="mt-1 break-all text-sm font-medium text-gray-900">{selectedBook.fileName}</p>
                    </div>
                    <div className="rounded-xl border bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Content type</p>
                      <p className="mt-1 break-all text-sm font-medium text-gray-900">{selectedBook.contentType || 'Unknown'}</p>
                    </div>
                    <div className="rounded-xl border bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">File path</p>
                      <p className="mt-1 break-all text-sm font-medium text-gray-900">{selectedBook.filePath || 'Not available'}</p>
                    </div>
                    <div className="rounded-xl border bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Download URL</p>
                      <p className="mt-1 break-all text-sm font-medium text-gray-900">{selectedBook.downloadUrl || 'Not generated'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Metadata</h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Author</p>
                        <p>{selectedBook.author || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Tag className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Category</p>
                        <p>{selectedBook.category || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Globe className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Language</p>
                        <p>{selectedBook.language || 'Not specified'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Published year</p>
                        <p>{selectedBook.publishedYear || 'Unknown'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Publisher</p>
                      <p>{selectedBook.publisher || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ISBN</p>
                      <p>{selectedBook.isbn || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Uploader</p>
                      <p>{selectedBook.uploadedByUsername || `User #${selectedBook.uploadedById}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p>{selectedBook.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Visibility</p>
                      <p>{selectedBook.visibility}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p>{new Date(selectedBook.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Updated</p>
                      <p>{selectedBook.updatedAt ? new Date(selectedBook.updatedAt).toLocaleString() : 'Never'}</p>
                    </div>
                  </div>
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
                <h2 className="text-lg font-semibold text-gray-900">Delete book?</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  This will permanently remove <span className="font-medium text-gray-900">"{bookToDelete.title}"</span>
                  {' '}from the catalog and storage. The action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!deleteMutation.isPending) {
                    setBookToDelete(null)
                  }
                }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close delete confirmation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {deleteMutation.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getErrorMessage(deleteMutation.error)}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setBookToDelete(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(bookToDelete.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminBooksPage
