import type { ColumnId, Priority } from '@/types'

export const COLUMN_ORDER: ColumnId[] = [
  'ideas',
  'planned',
  'in-progress',
  'shipped',
  'retrospective',
]

export const COLUMN_CONFIG: Record<ColumnId, { title: string; accentVar: string }> = {
  ideas:         { title: 'Ideas',         accentVar: '--col-ideas' },
  planned:       { title: 'Planned',       accentVar: '--col-planned' },
  'in-progress': { title: 'In Progress',   accentVar: '--col-inprogress' },
  shipped:       { title: 'Shipped',       accentVar: '--col-shipped' },
  retrospective: { title: 'Retrospective', accentVar: '--col-retro' },
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; classes: string; dot: string }> = {
  high: {
    label: 'High',
    classes: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  medium: {
    label: 'Medium',
    classes: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  low: {
    label: 'Low',
    classes: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
}

export const DEFAULT_TAGS = [
  'Web App',
  'CLI Tool',
  'API',
  'ML / AI',
  'Mobile',
  'Library',
  'Script',
  'Game',
  'Design',
  'DevOps',
]

// Deterministic color palette for tags (index = hash % palette.length)
export const TAG_PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
]

/**
 * Returns a deterministic Tailwind background+text class pair for a given tag string.
 * The same tag always receives the same colour across renders by hashing the tag name.
 * @param tag - The tag string to colourise.
 * @returns A Tailwind class string, e.g. "bg-blue-100 text-blue-700".
 */
export function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length]
}

export const COMPLETED_COLUMNS: ColumnId[] = ['shipped', 'retrospective']
