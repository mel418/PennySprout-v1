'use client'
import { useState, useEffect, useCallback } from 'react'
import { Trash2, ShoppingBag, Calendar, FileText } from 'lucide-react'
import Modal from './ui/Modal'
import Button, { IconButton } from './ui/Button'
import { Banner } from './ui/Field'
import { SectionHeader } from './ui/SectionHeader'
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
      <SectionHeader title="Target purchase imports" doodle="dots" />

      {actionError && <Banner tone="error" role="alert">{actionError}</Banner>}

      {imports.map(imp => (
        <div key={imp.id} className="card-soft p-4 transition-colors hover:border-sage-300 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 flex-shrink-0 text-peach-600" aria-hidden="true" />
                <h3 className="truncate text-base font-semibold text-ink">{imp.fileName}</h3>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tnum">{new Date(imp.importedAt).toLocaleDateString()}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="tnum">{imp.itemCount}</span> item{imp.itemCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              {confirmingDeleteId === imp.id ? (
                <>
                  <span className="text-sm text-ink-soft">Delete this import?</span>
                  <Button size="sm" variant="danger" onClick={() => deleteImport(imp.id)}>Delete</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteId(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => openReview(imp)}>Review</Button>
                  <IconButton label={`Delete ${imp.fileName}`} tone="danger" onClick={() => setConfirmingDeleteId(imp.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
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
