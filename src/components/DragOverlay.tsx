import { DragOverlay as DndDragOverlay } from '@dnd-kit/core'
import { KanbanCard } from '@/components/KanbanCard'
import type { Card } from '@/types'

interface BoardDragOverlayProps {
  activeCard: Card | null
}

export function BoardDragOverlay({ activeCard }: BoardDragOverlayProps) {
  return (
    <DndDragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
      {activeCard ? <KanbanCard card={activeCard} isDragOverlay /> : null}
    </DndDragOverlay>
  )
}
