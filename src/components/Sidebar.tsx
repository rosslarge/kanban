import { LayoutGrid, Tag, Filter, X } from 'lucide-react'
import { TagBadge } from '@/components/TagBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { useFilterStore } from '@/store/filterStore'
import { useAllTags } from '@/hooks/useFilteredCards'
import { cn } from '@/lib/utils'
import type { Priority } from '@/types'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

export function Sidebar() {
  const { activeTags, activePriorities, toggleTag, togglePriority, clearFilters } = useFilterStore()
  const allTags = useAllTags()

  const hasFilters = activeTags.length > 0 || activePriorities.length > 0

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-100 h-full overflow-y-auto">
      {/* Branding */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <LayoutGrid size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">Kanban</p>
          <p className="text-[11px] text-gray-400">Project Board</p>
        </div>
      </div>

      <div className="flex-1 px-3 py-4 space-y-6">
        {/* Priority filter */}
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <Filter size={12} className="text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Priority</span>
          </div>
          <div className="space-y-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={cn(
                  'w-full flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer',
                  activePriorities.includes(p)
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <PriorityBadge priority={p} />
              </button>
            ))}
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-1 mb-2">
              <Tag size={12} className="text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Tags</span>
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {allTags.map((tag) => (
                <TagBadge
                  key={tag}
                  tag={tag}
                  active={activeTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={clearFilters}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <X size={12} />
            Clear filters
          </button>
        </div>
      )}
    </aside>
  )
}
