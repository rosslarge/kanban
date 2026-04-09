import { apiClient } from '@/services/apiClient'
import { COLUMN_ORDER } from '@/lib/constants'
import type { Card, BoardCards, BoardColumns, ColumnId } from '@/types'
import type { StorageAdapter, AddCardInput, UpdateCardInput } from './types'

/**
 * A card as returned by the API — includes server-managed fields that the
 * frontend Card type does not have.
 */
interface ApiCard extends Card {
  userId: string
  position: number
}

/** A column as returned by the GET /api/board endpoint. */
interface ApiColumn {
  id: string
  title: string
  cards: ApiCard[]
}

/** Full response shape from GET /api/board. */
interface ApiBoardResponse {
  columns: Record<string, ApiColumn>
}

/**
 * Strips server-only fields from an API card to produce a frontend Card.
 * @param apiCard - Card as returned by the API.
 * @returns Card without userId or position.
 */
function toCard(apiCard: ApiCard): Card {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, position: _p, ...card } = apiCard
  return card as Card
}

/**
 * HTTP-backed storage adapter. All operations call the REST API.
 * Retry logic and toast notifications are handled by apiClient.
 */
export const apiAdapter: StorageAdapter = {
  /**
   * Fetches the full board from GET /api/board and maps it to the normalised
   * store shape (flat cards map + columns with ordered cardIds arrays).
   */
  async loadBoard(): Promise<{ cards: BoardCards; columns: BoardColumns }> {
    const data = await apiClient.get<ApiBoardResponse>('/api/board')

    const cards: BoardCards = {}
    const columns = {} as BoardColumns

    for (const colId of COLUMN_ORDER) {
      const apiCol = data.columns[colId]
      // Cards from the API are already sorted by ascending position
      const colCards = apiCol?.cards ?? []

      for (const apiCard of colCards) {
        const card = toCard(apiCard)
        cards[card.id] = card
      }

      columns[colId] = {
        id: colId,
        title: apiCol?.title ?? colId,
        cardIds: colCards.map((c) => c.id),
      }
    }

    return { cards, columns }
  },

  /**
   * Creates a card via POST /api/cards and returns it with the server-assigned ID.
   * @param data - Card creation payload.
   */
  async addCard(data: AddCardInput): Promise<Card> {
    const apiCard = await apiClient.post<ApiCard>('/api/cards', data)
    return toCard(apiCard)
  },

  /**
   * Updates a card's fields via PUT /api/cards/{id}.
   * @param id - The card ID.
   * @param updates - Fields to overwrite.
   */
  async updateCard(id: string, updates: UpdateCardInput): Promise<Card> {
    const toastId = `update-${id}`
    const apiCard = await apiClient.put<ApiCard>(`/api/cards/${id}`, updates, toastId)
    return toCard(apiCard)
  },

  /**
   * Deletes a card via DELETE /api/cards/{id}.
   * @param id - The card ID.
   */
  async deleteCard(id: string): Promise<void> {
    const toastId = `delete-${id}`
    await apiClient.delete(`/api/cards/${id}`, toastId)
  },

  /**
   * Moves or reorders a card via PATCH /api/cards/{id}/move.
   * Handles both cross-column moves and same-column reorders.
   * @param cardId - The card to move.
   * @param toColumnId - Destination column (same column for reorders).
   * @param toPosition - Zero-based insertion index.
   */
  async moveCard(cardId: string, toColumnId: ColumnId, toPosition: number): Promise<void> {
    const toastId = `move-${cardId}`
    await apiClient.patch(`/api/cards/${cardId}/move`, { toColumnId, toPosition }, toastId)
  },
}
