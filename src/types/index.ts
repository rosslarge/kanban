export type ColumnId = 'ideas' | 'planned' | 'in-progress' | 'shipped' | 'retrospective'

export type Priority = 'high' | 'medium' | 'low'

export interface CardLink {
  label: string
  url: string
}

export interface Card {
  id: string
  title: string
  description: string
  tags: string[]
  priority: Priority
  category: string
  links: CardLink[]
  notes: string
  createdAt: string
  completedAt: string | null
  columnId: ColumnId
}

export interface Column {
  id: ColumnId
  title: string
  cardIds: string[]
}

export type BoardColumns = Record<ColumnId, Column>
export type BoardCards = Record<string, Card>
