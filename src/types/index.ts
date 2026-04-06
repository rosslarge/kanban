/** The five fixed column identifiers on the board. */
export type ColumnId = 'ideas' | 'planned' | 'in-progress' | 'shipped' | 'retrospective'

/** Card priority level, used for filtering and visual badge colour. */
export type Priority = 'high' | 'medium' | 'low'

/** An external link attached to a card, e.g. a GitHub repo or live demo. */
export interface CardLink {
  label: string
  url: string
}

/**
 * A single kanban card representing a project or idea.
 * Cards are normalised in the store by ID and referenced by ordered ID arrays in each column.
 */
export interface Card {
  id: string
  title: string
  description: string
  /** Free-form tags used for filtering, e.g. "Web App", "CLI Tool". */
  tags: string[]
  priority: Priority
  category: string
  links: CardLink[]
  /** Freeform retrospective notes — outcome, lessons learned, etc. */
  notes: string
  createdAt: string        // ISO 8601
  /** Set automatically when a card moves to "shipped" or "retrospective". */
  completedAt: string | null
  columnId: ColumnId
}

/**
 * A board column. Stores an ordered array of card IDs rather than
 * embedding cards directly, allowing cards to be updated without touching column state.
 */
export interface Column {
  id: ColumnId
  title: string
  /** Ordered card IDs — the sequence determines display order within the column. */
  cardIds: string[]
}

/** All five board columns keyed by their ColumnId. */
export type BoardColumns = Record<ColumnId, Column>

/** All cards on the board, normalised as a map from card ID to Card. */
export type BoardCards = Record<string, Card>
