import type { Card, BoardCards, BoardColumns, ColumnId, Priority, CardLink } from '@/types'

/** Data required to create a new card (server assigns the ID). */
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
 * Implementations: localAdapter (localStorage via Zustand persist) and apiAdapter (HTTP API).
 */
export interface StorageAdapter {
  /**
   * Loads the full board state from the persistence layer.
   * @returns Normalised cards map and ordered columns map.
   */
  loadBoard(): Promise<{ cards: BoardCards; columns: BoardColumns }>

  /**
   * Creates a new card and returns it with the server-assigned ID.
   * @param data - Card fields (no ID required).
   * @returns The created card.
   */
  addCard(data: AddCardInput): Promise<Card>

  /**
   * Applies partial updates to an existing card.
   * @param id - The card ID.
   * @param updates - Fields to overwrite.
   * @returns The updated card.
   */
  updateCard(id: string, updates: UpdateCardInput): Promise<Card>

  /**
   * Deletes a card by ID.
   * @param id - The card ID.
   */
  deleteCard(id: string): Promise<void>

  /**
   * Moves or reorders a card within the board.
   * @param cardId - The card to move.
   * @param toColumnId - Destination column (same column for reorders).
   * @param toPosition - Zero-based insertion index in the destination column.
   */
  moveCard(cardId: string, toColumnId: ColumnId, toPosition: number): Promise<void>
}
