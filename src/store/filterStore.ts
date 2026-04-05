import { create } from 'zustand'
import type { Priority } from '@/types'

interface FilterState {
  searchQuery: string
  activeTags: string[]
  activePriorities: Priority[]
  setSearchQuery: (q: string) => void
  toggleTag: (tag: string) => void
  togglePriority: (p: Priority) => void
  clearFilters: () => void
}

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
