import { LayoutGrid, Tag, Filter, X } from 'lucide-react'
import { TagBadge } from '@/components/TagBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { useFilterStore } from '@/store/filterStore'
import { useAllTags } from '@/hooks/useFilteredCards'
import { cn } from '@/lib/utils'
import type { Priority } from '@/types'

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

/**
 * Left-hand navigation sidebar. Contains the board branding, priority filter
 * buttons, and tag filter pills. Uses the glass sidebar token so it blends
 * with the background atmosphere in both themes.
 */
export function Sidebar() {
  const { activeTags, activePriorities, toggleTag, togglePriority, clearFilters } = useFilterStore()
  const allTags = useAllTags()

  const hasFilters = activeTags.length > 0 || activePriorities.length > 0

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-full overflow-y-auto"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Branding */}
      <div
        className="flex items-center gap-2.5 px-4 py-5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <LayoutGrid size={15} style={{ color: '#fff' }} />
        </div>
        <div>
          <p
            className="text-sm font-bold leading-tight"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: '1rem',
              color: 'var(--ink-primary)',
            }}
          >
            Kanban
          </p>
          <p className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>Project Board</p>
        </div>
      </div>

      <div className="flex-1 px-3 py-4 space-y-6">
        {/* Priority filter */}
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <Filter size={11} style={{ color: 'var(--ink-faint)' }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{
                fontFamily: "'Fira Code', monospace",
                color: 'var(--ink-faint)',
              }}
            >
              Priority
            </span>
          </div>
          <div className="space-y-0.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={cn(
                  'w-full flex items-center px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer',
                )}
                style={{
                  background: activePriorities.includes(p)
                    ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                    : 'transparent',
                  color: 'var(--ink-muted)',
                }}
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
              <Tag size={11} style={{ color: 'var(--ink-faint)' }} />
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{
                  fontFamily: "'Fira Code', monospace",
                  color: 'var(--ink-faint)',
                }}
              >
                Tags
              </span>
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
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={clearFilters}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--ink-faint)' }}
          >
            <X size={12} />
            Clear filters
          </button>
        </div>
      )}
    </aside>
  )
}
