'use client'
import { useState, useEffect, useCallback } from 'react'
import { Trash2, ShoppingBag, Calendar, FileText } from 'lucide-react'
import Modal from './ui/Modal'
import { TargetItemsList } from './TargetItemsList'

// Lists every Target purchase-history CSV the user has imported, mirroring
// the bank-statement file cards in UserFiles — same layout, same two-step
// delete, but "Review" opens a read-only item list (with thumbnails)
// instead of an editable transaction list, since these aren't transactions.
export default function TargetImportsList() {
  const [imports, setImports] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  const [reviewImport, setReviewImport] = useState(null)
  const [reviewItems, setReviewItems] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)

  const fetchImports = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/target-purchase-imports')
      const data = await res.json()
      setImports(data.imports || [])
    } catch (error) {
      console.error('Error fetching Target imports:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchImports() }, [fetchImports])

  const openReview = async (imp) => {
    setReviewImport(imp)
    setReviewLoading(true)
    try {
      const res = await fetch(`/api/target-purchase-imports/${imp.id}`)
      const data = await res.json()
      setReviewItems(data.items || [])
    } catch (error) {
      console.error('Error fetching Target import items:', error)
      setReviewItems([])
    } finally {
      setReviewLoading(false)
    }
  }
  const closeReview = useCallback(() => setReviewImport(null), [])

  const deleteImport = async (importId) => {
    setConfirmingDeleteId(null)
    setActionError(null)
    try {
      const res = await fetch(`/api/target-purchase-imports/${importId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setImports(prev => prev.filter(i => i.id !== importId))
    } catch (error) {
      console.error('Error deleting Target import:', error)
      setActionError('Failed to delete import. Please try again.')
    }
  }

  if (isLoading || imports.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Target Purchase Imports</h2>

      {actionError && (
        <div role="alert" className="bg-danger-50 border border-danger-200 p-3 rounded-lg">
          <p className="text-danger-600 text-sm">{actionError}</p>
        </div>
      )}

      {imports.map(imp => (
        <div key={imp.id} className="bg-surface rounded-2xl border border-line shadow-sm p-5 hover:border-sage-300 transition-colors">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="h-4 w-4 text-sage-600 flex-shrink-0" aria-hidden="true" />
                <h3 className="text-base font-semibold text-ink truncate">{imp.fileName}</h3>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-ink-faint">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(imp.importedAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {imp.itemCount} item{imp.itemCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {confirmingDeleteId === imp.id ? (
                <>
                  <span className="text-xs text-ink-soft">Delete this import?</span>
                  <button
                    onClick={() => deleteImport(imp.id)}
                    className="px-3 py-1.5 bg-danger-600 text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(null)}
                    className="px-3 py-1.5 text-sm rounded-lg text-ink-soft hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openReview(imp)}
                    className="px-3 py-1.5 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 transition-colors"
                  >
                    Review
                  </button>
                  <button
                    onClick={() => setConfirmingDeleteId(imp.id)}
                    aria-label={`Delete ${imp.fileName}`}
                    className="p-1.5 text-ink-faint hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {reviewImport && (
        <Modal
          isOpen
          onClose={closeReview}
          title={reviewImport.fileName}
          subtitle={`${reviewImport.itemCount} item${reviewImport.itemCount === 1 ? '' : 's'} · what you bought, with thumbnails`}
          ariaLabel={`Items in ${reviewImport.fileName}`}
        >
          <div className="overflow-y-auto p-4">
            <TargetItemsList items={reviewItems} isLoading={reviewLoading} />
          </div>
        </Modal>
      )}
    </div>
  )
}
