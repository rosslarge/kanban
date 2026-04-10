import { beforeEach, describe, expect, it } from 'vitest'
import { useFilterStore } from '@/store/filterStore'

// Reset store state before each test so tests are fully isolated
beforeEach(() => {
  useFilterStore.getState().clearFilters()
})

describe('filterStore', () => {
  // Verifies that the initial state is empty so no cards are filtered out on first load
  it('starts with empty filters', () => {
    const { searchQuery, activeTags, activePriorities } = useFilterStore.getState()
    expect(searchQuery).toBe('')
    expect(activeTags).toEqual([])
    expect(activePriorities).toEqual([])
  })

  // Verifies that setSearchQuery updates the query so useFilteredCards can match against it
  it('sets search query', () => {
    useFilterStore.getState().setSearchQuery('react')
    expect(useFilterStore.getState().searchQuery).toBe('react')
  })

  // Verifies that toggleTag adds a tag that wasn't active, enabling tag-based filtering
  it('toggleTag adds a tag when not active', () => {
    useFilterStore.getState().toggleTag('frontend')
    expect(useFilterStore.getState().activeTags).toContain('frontend')
  })

  // Verifies that toggleTag removes a tag already in the active set, acting as a toggle
  it('toggleTag removes a tag when already active', () => {
    useFilterStore.getState().toggleTag('frontend')
    useFilterStore.getState().toggleTag('frontend')
    expect(useFilterStore.getState().activeTags).not.toContain('frontend')
  })

  // Verifies that multiple tags can be active simultaneously for OR-based filtering
  it('can have multiple active tags', () => {
    useFilterStore.getState().toggleTag('frontend')
    useFilterStore.getState().toggleTag('backend')
    expect(useFilterStore.getState().activeTags).toEqual(['frontend', 'backend'])
  })

  // Verifies that togglePriority adds and removes priorities the same way tags do
  it('togglePriority adds and removes a priority', () => {
    useFilterStore.getState().togglePriority('high')
    expect(useFilterStore.getState().activePriorities).toContain('high')
    useFilterStore.getState().togglePriority('high')
    expect(useFilterStore.getState().activePriorities).not.toContain('high')
  })

  // Verifies that clearFilters resets everything so the user can start fresh
  it('clearFilters resets all filter state', () => {
    useFilterStore.getState().setSearchQuery('test')
    useFilterStore.getState().toggleTag('frontend')
    useFilterStore.getState().togglePriority('high')
    useFilterStore.getState().clearFilters()

    const { searchQuery, activeTags, activePriorities } = useFilterStore.getState()
    expect(searchQuery).toBe('')
    expect(activeTags).toEqual([])
    expect(activePriorities).toEqual([])
  })
})
