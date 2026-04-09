import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { KanbanCard } from '@/components/KanbanCard'
import { EmptyColumn } from '@/components/EmptyColumn'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CardForm } from '@/components/CardForm'
import { COLUMN_CONFIG } from '@/lib/constants'
import { useBoardStore } from '@/store/boardStore'
import { useFilteredCards } from '@/hooks/useFilteredCards'
import { cn } from '@/lib/utils'
import type { ColumnId } from '@/types'

interface KanbanColumnProps {
  columnId: ColumnId
}

export function KanbanColumn({ columnId }: KanbanColumnProps) {
  const [addOpen, setAddOpen] = useState(false)
  const config = COLUMN_CONFIG[columnId]
  const cards = useFilteredCards(columnId)
  const totalCount = useBoardStore((s) => s.columns[columnId].cardIds.length)
  const addCard = useBoardStore((s) => s.addCard)

  const { setNodeRef, isOver } = useDroppable({ id: columnId, data: { type: 'column', columnId } })

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-xl mb-2', config.headerBg, 'border-l-4', config.accent)}>
        <div className="flex items-center gap-2">
          <span className={cn('w-2.5 h-2.5 rounded-full', config.dotColor)} />
          <span className="text-sm font-semibold text-gray-800">{config.title}</span>
          <span className="text-xs text-gray-500 bg-white/70 rounded-full px-1.5 py-0.5 font-medium">
            {totalCount}
          </span>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:bg-white/70 hover:text-gray-800 transition-colors cursor-pointer"
          title={`Add to ${config.title}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-32 transition-colors duration-150',
          isOver ? 'bg-violet-50' : 'bg-transparent'
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <EmptyColumn columnId={columnId} />
          ) : (
            cards.map((card) => <KanbanCard key={card.id} card={card} />)
          )}
        </SortableContext>
      </div>

      {/* Add card dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent title={`Add to ${config.title}`} description="Create a new card">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-gray-900">New card</h2>
          </div>
          <CardForm
            defaultColumnId={columnId}
            onSubmit={async (data) => {
              try {
                await addCard(data)
                setAddOpen(false)
              } catch {
                // Error toast shown by the store; keep dialog open so the user can retry
              }
            }}
            onCancel={() => setAddOpen(false)}
            submitLabel="Create card"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
