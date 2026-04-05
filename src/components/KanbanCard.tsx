import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ExternalLink } from 'lucide-react'
import { PriorityBadge } from '@/components/PriorityBadge'
import { TagBadge } from '@/components/TagBadge'
import { CardDetail } from '@/components/CardDetail'
import { cn } from '@/lib/utils'
import type { Card } from '@/types'

interface KanbanCardProps {
  card: Card
  isDragOverlay?: boolean
}

export function KanbanCard({ card, isDragOverlay = false }: KanbanCardProps) {
  const [open, setOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', card } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={isDragOverlay ? undefined : style}
        className={cn(
          'group bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm',
          'hover:shadow-md hover:border-gray-200 transition-all duration-200',
          isDragging && 'opacity-40 shadow-none',
          isDragOverlay && 'shadow-xl rotate-1 scale-[1.02] cursor-grabbing',
          !isDragOverlay && 'cursor-pointer'
        )}
        onClick={() => !isDragOverlay && setOpen(true)}
        {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
      >
        {/* Tags row */}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {card.tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {card.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{card.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Title */}
        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1.5 line-clamp-2">
          {card.title}
        </p>

        {/* Description */}
        {card.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-2.5">
            {card.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <PriorityBadge priority={card.priority} />
          {card.links.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <ExternalLink size={11} />
              {card.links.length}
            </span>
          )}
        </div>
      </div>

      {!isDragOverlay && (
        <CardDetail card={card} open={open} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
