import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { config } from '@/config'
import { storageAdapter } from '@/services/storage'
import type { Card, BoardCards, BoardColumns, ColumnId, Priority, CardLink } from '@/types'
import { buildSampleData } from '@/lib/sampleData'
import { COMPLETED_COLUMNS } from '@/lib/constants'

/** The persisted board data: all cards normalised by ID and columns with ordered card ID arrays. */
interface BoardState {
  cards: BoardCards
  columns: BoardColumns
  /** True once data has been loaded or seeded, preventing re-initialisation on subsequent renders. */
  initialized: boolean
}

/** All mutating actions available on the board store. */
interface BoardActions {
  /**
   * Loads board data from the configured storage backend.
   * - Local mode: seeds sample data on first load (no-op if already initialised).
   * - API mode: fetches board state from GET /api/board.
   */
  initialize: () => Promise<void>

  /**
   * Creates a new card and appends it to the end of the specified column.
   * - Local mode: generates ID locally, updates state synchronously.
   * - API mode: posts to the API and waits for the server-assigned ID.
   * @returns The new card's ID.
   */
  addCard: (data: {
    title: string
    description: string
    tags: string[]
    priority: Priority
    category: string
    links: CardLink[]
    notes: string
    columnId: ColumnId
  }) => Promise<string>

  /**
   * Applies partial updates to an existing card.
   * Optimistic in API mode: updates immediately and rolls back on failure.
   * @param id - The ID of the card to update.
   * @param updates - The fields to overwrite.
   */
  updateCard: (id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>) => Promise<void>

  /**
   * Removes a card from the store and its column.
   * Optimistic in API mode: removes immediately and restores on failure.
   * @param id - The ID of the card to delete.
   */
  deleteCard: (id: string) => Promise<void>

  /**
   * Moves a card to a different column at a specific index.
   * Optimistic in API mode: moves immediately and restores position on failure.
   * @param cardId - The ID of the card to move.
   * @param toColumnId - The destination column.
   * @param toIndex - The zero-based insertion index in the destination column.
   */
  moveCard: (cardId: string, toColumnId: ColumnId, toIndex: number) => Promise<void>

  /**
   * Reorders a card within its current column.
   * Optimistic in API mode: reorders immediately and restores on failure.
   * @param columnId - The column containing the card.
   * @param fromIndex - The card's current index.
   * @param toIndex - The desired index after the move.
   */
  reorderCard: (columnId: ColumnId, fromIndex: number, toIndex: number) => Promise<void>
}

const { cards: sampleCards, columns: sampleColumns } = buildSampleData()


const storeFn: StateCreator<BoardState & BoardActions> = (set, get) => ({
  cards: {},
  columns: {
    ideas: { id: 'ideas', title: 'Ideas', cardIds: [] },
    planned: { id: 'planned', title: 'Planned', cardIds: [] },
    'in-progress': { id: 'in-progress', title: 'In Progress', cardIds: [] },
    shipped: { id: 'shipped', title: 'Shipped', cardIds: [] },
    retrospective: { id: 'retrospective', title: 'Retrospective', cardIds: [] },
  },
  initialized: false,

  initialize: async () => {
    if (get().initialized) return
    // Mark initialized synchronously so a second concurrent call (e.g. React
    // Strict Mode re-running the effect) returns early instead of firing a
    // duplicate request that would later overwrite any optimistic state.
    set({ initialized: true })

    if (config.storageBackend === 'api') {
      try {
        const { cards: loadedCards, columns: loadedColumns } = await storageAdapter.loadBoard()
        // Merge: preserve any cards added optimistically while the GET was in
        // flight (e.g. user creates a card before the initial load returns).
        set((state) => {
          const mergedCards: BoardCards = { ...loadedCards }
          const mergedColumns: BoardColumns = { ...loadedColumns }
          for (const [id, card] of Object.entries(state.cards)) {
            if (!loadedCards[id]) {
              mergedCards[id] = card
              const colId = card.columnId
              if (colId in mergedColumns) {
                mergedColumns[colId] = {
                  ...mergedColumns[colId],
                  cardIds: [...mergedColumns[colId].cardIds, id],
                }
              }
            }
          }
          return { cards: mergedCards, columns: mergedColumns }
        })
      } catch {
        // apiClient already showed an error toast via ToastContext.
        // Reset so a page refresh can retry the load.
        set({ initialized: false })
      }
      return
    }

    // Local mode: seed sample data on first load
    set({ cards: sampleCards, columns: sampleColumns })
  },

  addCard: async (data) => {
    if (config.storageBackend === 'api') {
      // Wait for the API — the server assigns the UUID
      const card = await storageAdapter.addCard(data)
      set((state) => ({
        cards: { ...state.cards, [card.id]: card },
        columns: {
          ...state.columns,
          [card.columnId]: {
            ...state.columns[card.columnId],
            cardIds: [...state.columns[card.columnId].cardIds, card.id],
          },
        },
      }))
      return card.id
    }

    // Local mode: generate ID immediately
    const id = nanoid()
    const now = new Date().toISOString()
    const card: Card = {
      ...data,
      id,
      createdAt: now,
      completedAt: COMPLETED_COLUMNS.includes(data.columnId) ? now : null,
    }
    set((state) => ({
      cards: { ...state.cards, [id]: card },
      columns: {
        ...state.columns,
        [data.columnId]: {
          ...state.columns[data.columnId],
          cardIds: [...state.columns[data.columnId].cardIds, id],
        },
      },
    }))
    return id
  },

  updateCard: async (id, updates) => {
    if (config.storageBackend === 'api') {
      const snapshot = get().cards[id]
      set((state) => ({
        cards: { ...state.cards, [id]: { ...state.cards[id], ...updates } },
      }))
      try {
        await storageAdapter.updateCard(id, updates)
      } catch (err) {
        set((state) => ({ cards: { ...state.cards, [id]: snapshot } }))
        throw err
      }
      return
    }

    set((state) => ({
      cards: { ...state.cards, [id]: { ...state.cards[id], ...updates } },
    }))
  },

  deleteCard: async (id) => {
    const card = get().cards[id]
    if (!card) return

    const columnId = card.columnId
    const prevCardIds = [...get().columns[columnId].cardIds]
    const newCards = { ...get().cards }
    delete newCards[id]

    set({
      cards: newCards,
      columns: {
        ...get().columns,
        [columnId]: {
          ...get().columns[columnId],
          cardIds: prevCardIds.filter((cid) => cid !== id),
        },
      },
    })

    if (config.storageBackend === 'api') {
      try {
        await storageAdapter.deleteCard(id)
      } catch (err) {
        set((state) => ({
          cards: { ...state.cards, [id]: card },
          columns: {
            ...state.columns,
            [columnId]: { ...state.columns[columnId], cardIds: prevCardIds },
          },
        }))
        throw err
      }
    }
  },

  moveCard: async (cardId, toColumnId, toIndex) => {
    const prevCards = get().cards
    const prevColumns = get().columns
    const card = prevCards[cardId]
    if (!card) return

    const fromColumnId = card.columnId
    const fromCardIds = prevColumns[fromColumnId].cardIds.filter((id) => id !== cardId)
    const toCardIds = [...prevColumns[toColumnId].cardIds.filter((id) => id !== cardId)]
    toCardIds.splice(toIndex, 0, cardId)

    const completedAt =
      COMPLETED_COLUMNS.includes(toColumnId) && !card.completedAt
        ? new Date().toISOString()
        : card.completedAt

    set({
      cards: { ...prevCards, [cardId]: { ...card, columnId: toColumnId, completedAt } },
      columns: {
        ...prevColumns,
        [fromColumnId]: { ...prevColumns[fromColumnId], cardIds: fromCardIds },
        [toColumnId]: { ...prevColumns[toColumnId], cardIds: toCardIds },
      },
    })

    if (config.storageBackend === 'api') {
      try {
        await storageAdapter.moveCard(cardId, toColumnId, toIndex)
      } catch (err) {
        set({ cards: prevCards, columns: prevColumns })
      }
    }
  },

  reorderCard: async (columnId, fromIndex, toIndex) => {
    const prevCardIds = [...get().columns[columnId].cardIds]
    const cardId = prevCardIds[fromIndex]

    const newCardIds = [...prevCardIds]
    const [moved] = newCardIds.splice(fromIndex, 1)
    newCardIds.splice(toIndex, 0, moved)

    set((state) => ({
      columns: {
        ...state.columns,
        [columnId]: { ...state.columns[columnId], cardIds: newCardIds },
      },
    }))

    if (config.storageBackend === 'api') {
      try {
        await storageAdapter.moveCard(cardId, columnId, toIndex)
      } catch (err) {
        set((state) => ({
          columns: {
            ...state.columns,
            [columnId]: { ...state.columns[columnId], cardIds: prevCardIds },
          },
        }))
      }
    }
  },
})

/**
 * The primary Zustand store for all board state.
 *
 * In local mode the `persist` middleware serialises state to localStorage under
 * "kanban-board-v1" so the board survives page refreshes.
 *
 * In API mode the persist middleware is omitted — the API is the source of truth
 * and the board is fetched fresh from GET /api/board on every initialisation.
 */
export const useBoardStore =
  config.storageBackend === 'api'
    ? create<BoardState & BoardActions>()(storeFn)
    : create<BoardState & BoardActions>()(persist(storeFn, { name: 'kanban-board-v1' }))
