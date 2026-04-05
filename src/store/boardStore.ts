import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Card, BoardCards, BoardColumns, ColumnId, Priority, CardLink } from '@/types'
import { buildSampleData } from '@/lib/sampleData'
import { COMPLETED_COLUMNS } from '@/lib/constants'

interface BoardState {
  cards: BoardCards
  columns: BoardColumns
  initialized: boolean
}

interface BoardActions {
  initialize: () => void
  addCard: (data: {
    title: string
    description: string
    tags: string[]
    priority: Priority
    category: string
    links: CardLink[]
    notes: string
    columnId: ColumnId
  }) => string
  updateCard: (id: string, updates: Partial<Omit<Card, 'id' | 'createdAt'>>) => void
  deleteCard: (id: string) => void
  moveCard: (cardId: string, toColumnId: ColumnId, toIndex: number) => void
  reorderCard: (columnId: ColumnId, fromIndex: number, toIndex: number) => void
}

const { cards: sampleCards, columns: sampleColumns } = buildSampleData()

export const useBoardStore = create<BoardState & BoardActions>()(
  persist(
    (set, get) => ({
      cards: {},
      columns: {
        ideas: { id: 'ideas', title: 'Ideas', cardIds: [] },
        planned: { id: 'planned', title: 'Planned', cardIds: [] },
        'in-progress': { id: 'in-progress', title: 'In Progress', cardIds: [] },
        shipped: { id: 'shipped', title: 'Shipped', cardIds: [] },
        retrospective: { id: 'retrospective', title: 'Retrospective', cardIds: [] },
      },
      initialized: false,

      initialize: () => {
        if (get().initialized) return
        set({ cards: sampleCards, columns: sampleColumns, initialized: true })
      },

      addCard: (data) => {
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

      updateCard: (id, updates) => {
        set((state) => ({
          cards: {
            ...state.cards,
            [id]: { ...state.cards[id], ...updates },
          },
        }))
      },

      deleteCard: (id) => {
        set((state) => {
          const card = state.cards[id]
          if (!card) return state
          const newCards = { ...state.cards }
          delete newCards[id]
          return {
            cards: newCards,
            columns: {
              ...state.columns,
              [card.columnId]: {
                ...state.columns[card.columnId],
                cardIds: state.columns[card.columnId].cardIds.filter((cid) => cid !== id),
              },
            },
          }
        })
      },

      moveCard: (cardId, toColumnId, toIndex) => {
        set((state) => {
          const card = state.cards[cardId]
          if (!card) return state

          const fromColumnId = card.columnId
          const fromCardIds = state.columns[fromColumnId].cardIds.filter((id) => id !== cardId)
          const toCardIds = [...state.columns[toColumnId].cardIds.filter((id) => id !== cardId)]
          toCardIds.splice(toIndex, 0, cardId)

          const completedAt =
            COMPLETED_COLUMNS.includes(toColumnId) && !card.completedAt
              ? new Date().toISOString()
              : card.completedAt

          return {
            cards: {
              ...state.cards,
              [cardId]: { ...card, columnId: toColumnId, completedAt },
            },
            columns: {
              ...state.columns,
              [fromColumnId]: { ...state.columns[fromColumnId], cardIds: fromCardIds },
              [toColumnId]: { ...state.columns[toColumnId], cardIds: toCardIds },
            },
          }
        })
      },

      reorderCard: (columnId, fromIndex, toIndex) => {
        set((state) => {
          const cardIds = [...state.columns[columnId].cardIds]
          const [moved] = cardIds.splice(fromIndex, 1)
          cardIds.splice(toIndex, 0, moved)
          return {
            columns: {
              ...state.columns,
              [columnId]: { ...state.columns[columnId], cardIds },
            },
          }
        })
      },
    }),
    {
      name: 'kanban-board-v1',
    }
  )
)
