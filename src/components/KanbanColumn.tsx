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
  /** Zero-based position used to stagger the column reveal animation. */
  index?: number
}

export function KanbanColumn({ columnId, index = 0 }: KanbanColumnProps) {
  const [addOpen, setAddOpen] = useState(false)
  const config = COLUMN_CONFIG[columnId]
  const cards = useFilteredCards(columnId)
  const totalCount = useBoardStore((s) => s.columns[columnId].cardIds.length)
  const addCard = useBoardStore((s) => s.addCard)

  const { setNodeRef, isOver } = useDroppable({ id: columnId, data: { type: 'column', columnId } })

  const accent = `var(${config.accentVar})`

  return (
    <div
      className="flex flex-col w-72 shrink-0 col-reveal"
      style={{ '--col-i': index } as React.CSSProperties}
    >
      {/* Column header */}
      <div
        className="glass-column flex items-center justify-between px-3 py-2.5 mb-2"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
          <span
            className="text-sm font-medium tracking-wide truncate"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 500,
              fontSize: '0.95rem',
              color: 'var(--ink-primary)',
            }}
          >
            {config.title}
          </span>
          <span
            className="shrink-0 text-[11px] font-medium rounded-full px-1.5 py-0.5 leading-none"
            style={{
              fontFamily: "'Fira Code', monospace",
              background: 'var(--border)',
              color: 'var(--ink-faint)',
            }}
          >
            {totalCount}
          </span>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer shrink-0"
          style={{ color: 'var(--ink-faint)' }}
          title={`Add to ${config.title}`}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-32 transition-colors duration-150',
          isOver && 'bg-white/[0.06]',
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
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-primary)' }}>New card</h2>
          </div>
          <CardForm
            defaultColumnId={columnId}
            onSubmit={async (data) => {
              try { await addCard(data); setAddOpen(false) }
              catch { /* error toast shown by store; keep dialog open for retry */ }
            }}
            onCancel={() => setAddOpen(false)}
            submitLabel="Create card"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
