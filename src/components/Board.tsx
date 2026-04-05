import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCorners,
} from '@dnd-kit/core'
import { KanbanColumn } from '@/components/KanbanColumn'
import { BoardDragOverlay } from '@/components/DragOverlay'
import { useBoardStore } from '@/store/boardStore'
import { COLUMN_ORDER } from '@/lib/constants'
import type { Card, ColumnId } from '@/types'

export function Board() {
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const cards = useBoardStore((s) => s.cards)
  const columns = useBoardStore((s) => s.columns)
  const moveCard = useBoardStore((s) => s.moveCard)
  const reorderCard = useBoardStore((s) => s.reorderCard)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  function findColumnOfCard(cardId: string): ColumnId | null {
    for (const colId of COLUMN_ORDER) {
      if (columns[colId].cardIds.includes(cardId)) return colId
    }
    return null
  }

  function handleDragStart({ active }: DragStartEvent) {
    const card = cards[active.id as string]
    if (card) setActiveCard(card)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    const fromCol = findColumnOfCard(activeId)
    if (!fromCol) return

    // Determine target column: either a column id or a card's column
    const toCol = (COLUMN_ORDER.includes(overId as ColumnId)
      ? overId
      : findColumnOfCard(overId)) as ColumnId | null

    if (!toCol || fromCol === toCol) return

    // Move to new column at the position of the card being hovered
    const toCardIds = columns[toCol].cardIds
    const overIndex = toCardIds.indexOf(overId)
    const insertIndex = overIndex >= 0 ? overIndex : toCardIds.length

    moveCard(activeId, toCol, insertIndex)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const col = findColumnOfCard(activeId)
    if (!col) return

    // Same-column reorder
    const cardIds = columns[col].cardIds
    const fromIndex = cardIds.indexOf(activeId)
    const toIndex = cardIds.indexOf(overId)
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      reorderCard(col, fromIndex, toIndex)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 px-6 pb-8 overflow-x-auto min-h-0 flex-1">
        {COLUMN_ORDER.map((colId) => (
          <KanbanColumn key={colId} columnId={colId} />
        ))}
      </div>
      <BoardDragOverlay activeCard={activeCard} />
    </DndContext>
  )
}
