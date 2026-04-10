import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import { useFilteredCards, useAllTags } from '@/hooks/useFilteredCards'
import type { Card } from '@/types'

/** Minimal card factory — only required fields, defaults for the rest */
function makeCard(overrides: Partial<Card> & Pick<Card, 'id' | 'title' | 'columnId'>): Card {
  return {
    description: '',
    tags: [],
    priority: 'medium',
    category: '',
    links: [],
    notes: '',
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  }
}

// Seed the board store with known cards and reset filters before each test
beforeEach(() => {
  useFilterStore.getState().clearFilters()

  useBoardStore.setState({
    initialized: true,
    cards: {
      'card-1': makeCard({ id: 'card-1', title: 'Build API', columnId: 'ideas', tags: ['backend'], priority: 'high', category: 'infrastructure' }),
      'card-2': makeCard({ id: 'card-2', title: 'Design UI', columnId: 'ideas', tags: ['frontend'], priority: 'medium', description: 'Create mockups' }),
      'card-3': makeCard({ id: 'card-3', title: 'Write docs', columnId: 'planned', tags: ['docs'], priority: 'low' }),
    },
    columns: {
      ideas: { id: 'ideas', title: 'Ideas', cardIds: ['card-1', 'card-2'] },
      planned: { id: 'planned', title: 'Planned', cardIds: ['card-3'] },
      'in-progress': { id: 'in-progress', title: 'In Progress', cardIds: [] },
      shipped: { id: 'shipped', title: 'Shipped', cardIds: [] },
      retrospective: { id: 'retrospective', title: 'Retrospective', cardIds: [] },
    },
  })
})

describe('useFilteredCards', () => {
  // Verifies that all cards are returned when no filters are active
  it('returns all cards for a column when no filters are set', () => {
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(2)
    expect(result.current.map((c) => c.id)).toEqual(['card-1', 'card-2'])
  })

  // Verifies that text search matches against the title field
  it('filters cards by title search', () => {
    act(() => useFilterStore.getState().setSearchQuery('API'))
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-1')
  })

  // Verifies that text search matches against description, not just title
  it('filters cards by description search', () => {
    act(() => useFilterStore.getState().setSearchQuery('mockups'))
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-2')
  })

  // Verifies that text search matches against category
  it('filters cards by category search', () => {
    act(() => useFilterStore.getState().setSearchQuery('infrastructure'))
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-1')
  })

  // Verifies that text search is case-insensitive so "api" matches "API"
  it('search is case-insensitive', () => {
    act(() => useFilterStore.getState().setSearchQuery('api'))
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-1')
  })

  // Verifies that tag filters scope results to cards carrying that tag
  it('filters cards by active tag', () => {
    act(() => useFilterStore.getState().toggleTag('frontend'))
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-2')
  })

  // Verifies that multiple active tags use OR logic so cards matching any tag are shown
  it('multiple active tags use OR logic', () => {
    act(() => {
      useFilterStore.getState().toggleTag('frontend')
      useFilterStore.getState().toggleTag('backend')
    })
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(2)
  })

  // Verifies that priority filters scope results to cards with a matching priority
  it('filters cards by priority', () => {
    act(() => useFilterStore.getState().togglePriority('high'))
    const { result } = renderHook(() => useFilteredCards('ideas'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-1')
  })

  // Verifies that an empty column returns an empty array rather than erroring
  it('returns empty array for an empty column', () => {
    const { result } = renderHook(() => useFilteredCards('in-progress'))
    expect(result.current).toHaveLength(0)
  })

  // Verifies that only cards belonging to the requested column are returned
  it('does not include cards from other columns', () => {
    const { result } = renderHook(() => useFilteredCards('planned'))
    expect(result.current).toHaveLength(1)
    expect(result.current[0].id).toBe('card-3')
  })
})

describe('useAllTags', () => {
  // Verifies that all unique tags from every card across all columns are collected
  it('returns all unique tags from all cards', () => {
    const { result } = renderHook(() => useAllTags())
    expect(result.current).toEqual(['backend', 'docs', 'frontend'])
  })

  // Verifies that tags are returned in alphabetical order for consistent sidebar display
  it('returns tags sorted alphabetically', () => {
    const { result } = renderHook(() => useAllTags())
    expect(result.current).toEqual([...result.current].sort())
  })
})
