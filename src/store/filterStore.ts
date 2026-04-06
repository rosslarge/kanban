import { create } from 'zustand'
import type { Priority } from '@/types'

/** All filter state and actions for searching and narrowing cards on the board. */
interface FilterState {
  /** Current text search query — matched against title, description, tags, and category. */
  searchQuery: string
  /** Tags that must appear on a card for it to be shown. Multiple tags are OR-matched. */
  activeTags: string[]
  /** Priorities that must match a card for it to be shown. Multiple priorities are OR-matched. */
  activePriorities: Priority[]
  /** Updates the free-text search query. */
  setSearchQuery: (q: string) => void
  /** Adds a tag to the active filter set, or removes it if already present. */
  toggleTag: (tag: string) => void
  /** Adds a priority to the active filter set, or removes it if already present. */
  togglePriority: (p: Priority) => void
  /** Resets all filters to their initial empty state. */
  clearFilters: () => void
}

/**
 * Zustand store for board filter state.
 * Not persisted — filters reset on page refresh by design.
 * Consumed by useFilteredCards to derive the visible subset of cards per column.
 */
export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: '',
  activeTags: [],
  activePriorities: [],

  setSearchQuery: (q) => set({ searchQuery: q }),

  toggleTag: (tag) =>
    set((state) => ({
      activeTags: state.activeTags.includes(tag)
        ? state.activeTags.filter((t) => t !== tag)
        : [...state.activeTags, tag],
    })),

  togglePriority: (p) =>
    set((state) => ({
      activePriorities: state.activePriorities.includes(p)
        ? state.activePriorities.filter((x) => x !== p)
        : [...state.activePriorities, p],
    })),

  clearFilters: () => set({ searchQuery: '', activeTags: [], activePriorities: [] }),
}))
