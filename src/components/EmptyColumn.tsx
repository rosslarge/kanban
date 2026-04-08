import { Inbox } from 'lucide-react'
import type { ColumnId } from '@/types'

const EMPTY_MESSAGES: Record<ColumnId, string> = {
  ideas: 'Drop a raw idea here',
  planned: 'Move scoped projects here',
  'in-progress': 'What are you working on?',
  shipped: 'Move finished work here',
  retrospective: 'Archive past projects here',
}

interface EmptyColumnProps {
  columnId: ColumnId
}

/**
 * Placeholder shown inside a column that has no visible cards (after
 * filtering). Uses theme tokens so it renders correctly in both themes.
 * @param columnId - Used to select a context-appropriate hint message.
 */
export function EmptyColumn({ columnId }: EmptyColumnProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl mx-1 border-2 border-dashed"
      style={{ borderColor: 'var(--border)' }}
    >
      <Inbox size={22} className="mb-2" style={{ color: 'var(--ink-faint)', opacity: 0.5 }} />
      <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{EMPTY_MESSAGES[columnId]}</p>
    </div>
  )
}
