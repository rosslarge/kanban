import { apiClient } from '@/services/apiClient'
import { COLUMN_ORDER } from '@/lib/constants'
import type { Card, BoardCards, BoardColumns, ColumnId } from '@/types'
import type { StorageAdapter, AddCardInput, UpdateCardInput } from './types'

/**
 * A card as returned by the API — includes server-managed fields that the
 * frontend `Card` type does not have.
 */
interface ApiCard extends Card {
  userId: string
  position: number
}

interface ApiColumn { id: string; title: string; cards: ApiCard[] }
interface ApiBoardResponse { columns: Record<string, ApiColumn> }

/**
 * Strips server-only fields from an API card to produce a frontend Card.
 * @param apiCard - Card as returned by the API.
 */
function toCard(apiCard: ApiCard): Card {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, position: _p, ...card } = apiCard
  return card as Card
}

/**
 * HTTP-backed storage adapter. All persistence calls go to the REST API.
 * Each method supplies a `ToastContext` so `apiClient` owns the full
 * toast lifecycle: retry progress toasts update in-place and transition
 * directly to the error state when all retries are exhausted — no separate
 * dismiss + new-toast flash.
 */
export const apiAdapter: StorageAdapter = {
  /**
   * Fetches the full board from GET /api/board and maps it to the normalised
   * store shape. Cards are already sorted by ascending position in the API response.
   */
  async loadBoard(): Promise<{ cards: BoardCards; columns: BoardColumns }> {
    const data = await apiClient.get<ApiBoardResponse>('/api/board', {
      toastId: 'load-board',
      failureMessage: 'Failed to load the board. Please refresh to try again.',
    })

    const cards: BoardCards = {}
    const columns = {} as BoardColumns

    for (const colId of COLUMN_ORDER) {
      const apiCol = data.columns[colId]
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
    const apiCard = await apiClient.post<ApiCard>('/api/cards', data, {
      toastId: 'add-card',
      failureMessage: 'Failed to create card. Please try again.',
    })
    return toCard(apiCard)
  },

  /**
   * Updates card fields via PUT /api/cards/{id}.
   * @param id - The card ID.
   * @param updates - Fields to overwrite.
   */
  async updateCard(id: string, updates: UpdateCardInput): Promise<Card> {
    const apiCard = await apiClient.put<ApiCard>(`/api/cards/${id}`, updates, {
      toastId: `update-${id}`,
      failureMessage: 'Failed to save — your edit has been reverted.',
    })
    return toCard(apiCard)
  },

  /**
   * Deletes a card via DELETE /api/cards/{id}.
   * @param id - The card ID.
   */
  async deleteCard(id: string): Promise<void> {
    await apiClient.delete(`/api/cards/${id}`, {
      toastId: `delete-${id}`,
      failureMessage: 'Failed to delete — the card has been restored.',
    })
  },

  /**
   * Moves or reorders a card via PATCH /api/cards/{id}/move.
   * @param cardId - The card to move.
   * @param toColumnId - Destination column.
   * @param toPosition - Zero-based insertion index.
   */
  async moveCard(cardId: string, toColumnId: ColumnId, toPosition: number): Promise<void> {
    await apiClient.patch(`/api/cards/${cardId}/move`, { toColumnId, toPosition }, {
      toastId: `move-${cardId}`,
      failureMessage: 'Failed to move — position has been restored.',
    })
  },
}
