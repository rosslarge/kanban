import { useMemo } from 'react'
import { useBoardStore } from '@/store/boardStore'
import { useFilterStore } from '@/store/filterStore'
import type { Card, ColumnId } from '@/types'

/**
 * Returns the visible cards for a given column, applying all active filters.
 * Filters text across title, description, tags, and category (case-insensitive).
 * Tag and priority filters are OR-matched within their respective sets.
 * Memoised on the card list, column order, and filter values to avoid redundant work.
 * @param columnId - The column whose cards should be filtered and returned.
 * @returns The ordered, filtered array of cards for that column.
 */
export function useFilteredCards(columnId: ColumnId): Card[] {
  const cards = useBoardStore((s) => s.cards)
  const columnCardIds = useBoardStore((s) => s.columns[columnId].cardIds)
  const { searchQuery, activeTags, activePriorities } = useFilterStore()

  return useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return columnCardIds
      .map((id) => cards[id])
      .filter((card): card is Card => {
        if (!card) return false

        if (query) {
          const matches =
            card.title.toLowerCase().includes(query) ||
            card.description.toLowerCase().includes(query) ||
            card.tags.some((t) => t.toLowerCase().includes(query)) ||
            card.category.toLowerCase().includes(query)
          if (!matches) return false
        }

        if (activeTags.length > 0) {
          if (!activeTags.some((t) => card.tags.includes(t))) return false
        }

        if (activePriorities.length > 0) {
          if (!activePriorities.includes(card.priority)) return false
        }

        return true
      })
  }, [columnCardIds, cards, searchQuery, activeTags, activePriorities])
}

/**
 * Returns a sorted, deduplicated list of all tags currently on the board.
 * Used to populate the tag filter in the sidebar.
 * Memoised on the full cards map.
 */
export function useAllTags(): string[] {
  const cards = useBoardStore((s) => s.cards)
  return useMemo(() => {
    const tagSet = new Set<string>()
    Object.values(cards).forEach((card) => card.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [cards])
}
