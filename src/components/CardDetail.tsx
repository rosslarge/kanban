import { useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, Trash2, Pencil } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CardForm } from '@/components/CardForm'
import { PriorityBadge } from '@/components/PriorityBadge'
import { TagBadge } from '@/components/TagBadge'
import { COLUMN_CONFIG } from '@/lib/constants'
import { useBoardStore } from '@/store/boardStore'
import type { Card } from '@/types'

interface CardDetailProps {
  card: Card
  open: boolean
  onClose: () => void
}

/**
 * Modal detail view for a single card. Supports inline editing and deletion.
 * @param card - The card to display.
 * @param open - Whether the dialog is visible.
 * @param onClose - Callback to close the dialog.
 */
export function CardDetail({ card, open, onClose }: CardDetailProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateCard = useBoardStore((s) => s.updateCard)
  const deleteCard = useBoardStore((s) => s.deleteCard)
  const moveCard = useBoardStore((s) => s.moveCard)
  const columns = useBoardStore((s) => s.columns)

  function handleUpdate(data: Parameters<typeof updateCard>[1] & { columnId?: Card['columnId'] }) {
    const { columnId: newColumnId, ...rest } = data as typeof data & { columnId: Card['columnId'] }
    updateCard(card.id, rest)
    if (newColumnId && newColumnId !== card.columnId) {
      moveCard(card.id, newColumnId, columns[newColumnId].cardIds.length)
    }
    setEditing(false)
  }

  function handleDelete() {
    deleteCard(card.id)
    onClose()
  }

  const colConfig = COLUMN_CONFIG[card.columnId]
  const accent = `var(${colConfig.accentVar})`

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={card.title} description={card.description}>
        {editing ? (
          <>
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-primary)' }}>Edit Card</h2>
            </div>
            <CardForm
              initial={card}
              onSubmit={(data) => handleUpdate(data)}
              onCancel={() => setEditing(false)}
              submitLabel="Save changes"
            />
          </>
        ) : (
          <div className="p-6">
            {/* Column pill */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: 'var(--ink-muted)',
                  border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                {colConfig.title}
              </span>
              <PriorityBadge priority={card.priority} />
            </div>

            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-primary)' }}>{card.title}</h2>

            {card.category && (
              <p
                className="text-xs uppercase tracking-wide font-medium mb-3"
                style={{
                  fontFamily: "'Fira Code', monospace",
                  color: 'var(--ink-faint)',
                }}
              >
                {card.category}
              </p>
            )}

            {card.description && (
              <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap" style={{ color: 'var(--ink-muted)' }}>
                {card.description}
              </p>
            )}

            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {card.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
              </div>
            )}

            {card.notes && (
              <div
                className="rounded-xl p-4 mb-4"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--accent)', fontFamily: "'Fira Code', monospace" }}
                >
                  Notes / Retrospective
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                  {card.notes}
                </p>
              </div>
            )}

            {card.links.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ fontFamily: "'Fira Code', monospace", color: 'var(--ink-faint)' }}
                >
                  Links
                </p>
                {card.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    <ExternalLink size={13} />
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            )}

            <div
              className="flex items-center gap-4 text-xs mt-4 pt-4"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--ink-faint)' }}
            >
              <span>Created {format(new Date(card.createdAt), 'MMM d, yyyy')}</span>
              {card.completedAt && (
                <span>Completed {format(new Date(card.completedAt), 'MMM d, yyyy')}</span>
              )}
            </div>

            <div
              className="flex items-center justify-between mt-5 pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>Delete this card?</span>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>Confirm</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} style={{ color: 'var(--ink-faint)' }} /> Delete
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
