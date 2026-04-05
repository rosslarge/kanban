import { Inbox } from 'lucide-react'
import type { ColumnId } from '@/types'

const EMPTY_MESSAGES: Record<ColumnId, string> = {
  ideas: 'Drop a raw idea here',
  planned: 'Move scoped projects here',
  'in-progress': 'What are you working on?',
  shipped: "Move finished work here",
  retrospective: 'Archive past projects here',
}

interface EmptyColumnProps {
  columnId: ColumnId
}

export function EmptyColumn({ columnId }: EmptyColumnProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-gray-200 rounded-xl mx-1">
      <Inbox size={24} className="text-gray-300 mb-2" />
      <p className="text-xs text-gray-400">{EMPTY_MESSAGES[columnId]}</p>
    </div>
  )
}
