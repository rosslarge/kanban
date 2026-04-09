import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ExternalLink, Trash2, X } from 'lucide-react'
import { PriorityBadge } from '@/components/PriorityBadge'
import { TagBadge } from '@/components/TagBadge'
import { CardDetail } from '@/components/CardDetail'
import { useBoardStore } from '@/store/boardStore'
import { cn } from '@/lib/utils'
import type { Card } from '@/types'

interface KanbanCardProps {
  card: Card
  isDragOverlay?: boolean
}

/**
 * Renders a single kanban card with glass morphism styling and a 3-D tilt
 * effect on hover. The outer div is owned by dnd-kit (ref, listeners,
 * transform style). The inner `.glass-card` div owns the tilt transform so
 * the two transform systems never conflict.
 * @param card - The card data to display.
 * @param isDragOverlay - When true the card renders as a drag ghost (no
 *   dnd-kit wiring, slightly rotated/scaled).
 */
export function KanbanCard({ card, isDragOverlay = false }: KanbanCardProps) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const glassRef = useRef<HTMLDivElement>(null)
  const deleteCard = useBoardStore((s) => s.deleteCard)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setIsDeleting(true)
    try {
      await deleteCard(card.id)
    } catch {
      setIsDeleting(false)
      setConfirmingDelete(false)
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', card } })

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  /** Apply a subtle 3-D tilt based on pointer position within the card. */
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (isDragOverlay) return
    const el = glassRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5   // -0.5 → 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    const rotX = (-y * 7).toFixed(2)
    const rotY = (x * 7).toFixed(2)
    el.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.01,1.01,1.01)`
  }

  /** Reset tilt when the pointer leaves. */
  function handlePointerLeave() {
    const el = glassRef.current
    if (el) el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
  }

  return (
    <>
      {/* Outer wrapper — owned by dnd-kit */}
      <div
        ref={isDragOverlay ? undefined : setNodeRef}
        style={isDragOverlay ? undefined : dndStyle}
        className={cn(
          'group',
          isDragging && 'opacity-30',
          isDragOverlay && 'rotate-1 scale-[1.03] cursor-grabbing',
          !isDragOverlay && 'cursor-pointer',
        )}
        onClick={() => !isDragOverlay && !confirmingDelete && setOpen(true)}
        {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      >
        {/* Inner glass surface — owns the tilt transform */}
        <div
          ref={glassRef}
          className="glass-card p-3.5 relative"
          style={{ transition: 'transform 120ms ease-out' }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {/* Tags row */}
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {card.tags.slice(0, 3).map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
              {card.tags.length > 3 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    fontFamily: "'Fira Code', monospace",
                    color: 'var(--ink-faint)',
                    background: 'var(--border)',
                  }}
                >
                  +{card.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <p
            className="text-sm font-semibold leading-snug mb-1.5 line-clamp-2"
            style={{ color: 'var(--ink-primary)' }}
          >
            {card.title}
          </p>

          {/* Description */}
          {card.description && (
            <p
              className="text-xs leading-relaxed line-clamp-2 mb-2.5"
              style={{ color: 'var(--ink-muted)' }}
            >
              {card.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <PriorityBadge priority={card.priority} />
            {card.links.length > 0 && (
              <span
                className="flex items-center gap-0.5 text-[11px]"
                style={{
                  fontFamily: "'Fira Code', monospace",
                  color: 'var(--ink-faint)',
                }}
              >
                <ExternalLink size={11} />
                {card.links.length}
              </span>
            )}
          </div>

          {/* Delete controls — trash on hover, tick/cross when confirming */}
          {!isDragOverlay && (
            <div
              className="absolute top-2 right-1.5 flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {confirmingDelete ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false) }}
                    disabled={isDeleting}
                    className="rounded p-1 cursor-pointer transition-colors disabled:opacity-50"
                    style={{ color: 'var(--ink-faint)' }}
                    title="Cancel"
                  >
                    <X size={13} />
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded p-1 cursor-pointer transition-colors disabled:opacity-50"
                    style={{ color: 'rgba(220, 53, 69, 0.85)' }}
                    title="Confirm delete"
                  >
                    <Check size={13} />
                  </button>
                </>
              ) : (
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 cursor-pointer"
                  style={{ color: 'var(--ink-faint)' }}
                  onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true) }}
                  title="Delete card"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {!isDragOverlay && (
        <CardDetail card={card} open={open} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
