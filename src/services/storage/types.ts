import type { Card, BoardCards, BoardColumns, ColumnId, Priority, CardLink } from '@/types'

/** Data required to create a new card (the server assigns the ID). */
export interface AddCardInput {
  title: string
  description: string
  tags: string[]
  priority: Priority
  category: string
  links: CardLink[]
  notes: string
  columnId: ColumnId
}

/** Partial card fields that may be updated (excludes server-managed fields). */
export type UpdateCardInput = Partial<Omit<Card, 'id' | 'createdAt'>>

/**
 * Abstraction over the persistence layer.
 * Two implementations exist: `localAdapter` (Zustand persist) and `apiAdapter` (HTTP).
 */
export interface StorageAdapter {
  /**
   * Loads the full board state.
   * @returns Normalised cards map and ordered columns map.
   */
  loadBoard(): Promise<{ cards: BoardCards; columns: BoardColumns }>

  /**
   * Creates a new card and returns it with the server-assigned ID.
   * @param data - Card fields (no ID).
   */
  addCard(data: AddCardInput): Promise<Card>

  /**
   * Applies partial updates to a card.
   * @param id - The card ID.
   * @param updates - Fields to overwrite.
   */
  updateCard(id: string, updates: UpdateCardInput): Promise<Card>

  /**
   * Deletes a card.
   * @param id - The card ID.
   */
  deleteCard(id: string): Promise<void>

  /**
   * Moves or reorders a card.
   * @param cardId - The card to move.
   * @param toColumnId - Destination column (same column for reorders).
   * @param toPosition - Zero-based insertion index.
   */
  moveCard(cardId: string, toColumnId: ColumnId, toPosition: number): Promise<void>
}
